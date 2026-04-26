const { app, BrowserWindow, ipcMain, dialog, Menu, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const Store = require('electron-store');

const DB_FILE_NAME = 'ownerp.db';
const LEGACY_DB_FILE_NAME = 'panelerp.db';
const ACCOUNTING_DB_FILE_NAME = 'ownerp-accounting.db';
const LEGACY_ACCOUNTING_DB_FILE_NAME = 'panelerp-accounting.db';
const APP_DATA_DIR_NAME = 'OWNERP';
const LEGACY_APP_DATA_DIR_NAME = 'PanelERP';
const DEFAULT_DB_FOLDER = 'C:\\OWNERP\\database';
const DEFAULT_ACCOUNTING_DB_FOLDER = 'C:\\OWNERP\\accounting';
const DEFAULT_ERP_NAME = 'OWNERP';
const DEVELOPER_USERNAME = 'Developer';
const DEVELOPER_PASSWORD = 'ElectroT@123';
const DEVELOPER_RESET_EMAIL = 'Dhadukravi92@gmail.com';
const HR_CONNECT_PORT = 4860;
const HR_CONNECT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let mainWindow;
let db;
let accountingDb;
let currentDbFolder = null;
let currentDbPath = null;
let currentAccountingDbFolder = null;
let currentAccountingDbPath = null;
let autoBackupTimer = null;
let hrConnectServer = null;
let hrConnectStatus = {
  running: false,
  port: HR_CONNECT_PORT,
  origin: '',
  localUrls: [],
  error: ''
};
const hrConnectSessions = new Map();
let updaterModule = null;
let updateState = {
  available: false,
  downloaded: false,
  checking: false,
  downloading: false,
  enabled: false,
  configured: false,
  version: app.getVersion(),
  availableVersion: '',
  downloadedVersion: '',
  progressPercent: 0,
  message: 'Updates are not configured yet.',
  channel: 'latest',
  updateUrl: '',
  lastCheckedAt: '',
  lastDownloadedAt: ''
};

const AUTO_BACKUP_CHECK_MS = 60 * 1000;
const AUTO_BACKUP_INTERVALS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000
};
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const GOOGLE_DRIVE_AUTH_TIMEOUT_MS = 3 * 60 * 1000;
const LICENSE_ACTIVATION_WINDOW_MS = 60 * 60 * 1000;
const LICENSE_DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAXlCnhPgQMekFrOKgd+pyZuw02Ix6iM2dg9drSE9ErkA=
-----END PUBLIC KEY-----`;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const appStore = new Store({
  name: 'panelerp-config',
  defaults: {
    database: {
      folderPath: ''
    },
    accountingDatabase: {
      folderPath: ''
    },
    googleDrive: {
      clientId: '',
      clientSecret: '',
      folderId: '',
      folderInput: '',
      refreshToken: '',
      email: ''
    },
    license: {
      activationKey: '',
      activatedAt: '',
      machineIdAtActivation: ''
    }
  }
});

function canonicalizeLicensePayload(payload = {}) {
  return JSON.stringify(
    Object.keys(payload).sort().reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {})
  );
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = `${value || ''}`.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function normalizeLicenseKeyInput(licenseKey) {
  const raw = `${licenseKey || ''}`.trim();
  if (!raw) return '';

  const compact = raw.replace(/\s+/g, '');
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(compact)) {
    return compact;
  }

  const labelIndex = raw.search(/License Key\s*:/i);
  if (labelIndex >= 0) {
    const labeledSection = raw.slice(labelIndex).replace(/^[\s\S]*?License Key\s*:/i, '');
    const isolatedSection = labeledSection.split(/\n\s*\n|Payload\s*:/i, 1)[0];
    const normalizedSection = isolatedSection.replace(/\s+/g, '');
    const labeledTokenMatch = normalizedSection.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (labeledTokenMatch) {
      return labeledTokenMatch[0];
    }
  }

  const tokenMatch = raw.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return tokenMatch ? tokenMatch[0] : compact;
}

function normalizePublicKeyPem(publicKeyPem) {
  return `${publicKeyPem || ''}`.trim();
}

function getPublicKeyFingerprint(publicKeyPem) {
  return crypto.createHash('sha256').update(normalizePublicKeyPem(publicKeyPem)).digest('hex');
}

function parseLicenseActivationBundle(value) {
  const raw = `${value || ''}`.trim();
  if (!raw.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.licenseKey) {
      return null;
    }

    return {
      licenseKey: normalizeLicenseKeyInput(parsed.licenseKey),
      publicKeyPem: normalizePublicKeyPem(parsed.publicKeyPem),
      bundle: parsed
    };
  } catch (_error) {
    return null;
  }
}

function normalizeActivationRequest(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const bundle = parseLicenseActivationBundle(input.licenseKey || '');
    return {
      licenseKey: bundle?.licenseKey || normalizeLicenseKeyInput(input.licenseKey || ''),
      publicKeyPem: normalizePublicKeyPem(input.publicKeyPem || bundle?.publicKeyPem || ''),
      bundle: bundle?.bundle || null
    };
  }

  const bundle = parseLicenseActivationBundle(input);
  return {
    licenseKey: bundle?.licenseKey || normalizeLicenseKeyInput(input),
    publicKeyPem: normalizePublicKeyPem(bundle?.publicKeyPem || ''),
    bundle: bundle?.bundle || null
  };
}

function getMachineId() {
  const interfaces = os.networkInterfaces();
  const macs = Object.values(interfaces)
    .flat()
    .filter((entry) => entry && !entry.internal && entry.mac && entry.mac !== '00:00:00:00:00:00')
    .map((entry) => entry.mac.toLowerCase())
    .sort()
    .join('|');
  const fingerprint = [
    os.hostname(),
    os.platform(),
    os.arch(),
    macs
  ].join('::');
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

function getLicensePublicKeyPem(overridePem = '') {
  const configured = normalizePublicKeyPem(process.env.OWNERP_LICENSE_PUBLIC_KEY || appStore.get('license.publicKeyPem', ''));
  return normalizePublicKeyPem(overridePem) || configured || LICENSE_DEFAULT_PUBLIC_KEY;
}

function parseLicenseKey(licenseKey) {
  const raw = normalizeLicenseKeyInput(licenseKey);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid license key format.');
  }

  const payloadJson = fromBase64Url(parts[0]).toString('utf8');
  const payload = JSON.parse(payloadJson);
  const signature = fromBase64Url(parts[1]);

  return { raw, payload, signature };
}

function verifyLicenseSignature(payload, signature, overridePublicKeyPem = '') {
  const publicKey = getLicensePublicKeyPem(overridePublicKeyPem);
  const message = Buffer.from(canonicalizeLicensePayload(payload));
  return crypto.verify(null, message, publicKey, signature);
}

function evaluateLicenseKey(licenseKey, nowMs = Date.now(), options = {}) {
  const normalizedKey = normalizeLicenseKeyInput(licenseKey);
  const trustedPublicKeyPem = normalizePublicKeyPem(options.publicKeyPem);
  if (!normalizedKey) {
    return {
      activated: false,
      valid: false,
      mode: 'locked',
      reason: 'License key is not configured.'
    };
  }

  try {
    const { payload, signature } = parseLicenseKey(normalizedKey);
    if (!verifyLicenseSignature(payload, signature, trustedPublicKeyPem)) {
      return {
        activated: true,
        valid: false,
        mode: 'locked',
        reason: trustedPublicKeyPem
          ? 'License signature verification failed for the provided trusted public key.'
          : 'License signature verification failed. The app is still trusting a different public key than the one used to sign this license.'
      };
    }

    const now = new Date(nowMs);
    const validFrom = payload.validFrom ? new Date(payload.validFrom) : new Date(payload.issuedAt || now);
    const validUntil = new Date(payload.validUntil);
    const machineId = getMachineId();

    if (!payload.validUntil || Number.isNaN(validUntil.getTime())) {
      return { activated: true, valid: false, mode: 'locked', reason: 'License expiry date is invalid.' };
    }

    if (payload.machineId && `${payload.machineId}` !== machineId) {
      return { activated: true, valid: false, mode: 'locked', reason: 'License key does not belong to this device.' };
    }

    if (!Number.isNaN(validFrom.getTime()) && now < validFrom) {
      return { activated: true, valid: false, mode: 'locked', reason: `License starts on ${validFrom.toISOString()}.` };
    }

    const remainingMs = validUntil.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    if (remainingMs <= 0) {
      return {
        activated: true,
        valid: false,
        mode: 'read_only',
        reason: 'License has expired. Application is in view-only mode.',
        expiresAt: validUntil.toISOString(),
        daysRemaining: 0,
        payload
      };
    }

    return {
      activated: true,
      valid: true,
      mode: 'full',
      reason: '',
      expiresAt: validUntil.toISOString(),
      daysRemaining,
      payload,
      publicKeyFingerprint: getPublicKeyFingerprint(getLicensePublicKeyPem(trustedPublicKeyPem))
    };
  } catch (err) {
    return {
      activated: true,
      valid: false,
      mode: 'locked',
      reason: `License parsing failed: ${err.message}`
    };
  }
}

function getRuntimeLicenseStatus(nowMs = Date.now()) {
  return {
    activated: true,
    valid: true,
    mode: 'full',
    reason: '',
    machineId: getMachineId(),
    activatedAt: ''
  };
}

function activateLicenseKey(licenseKey) {
  const request = normalizeActivationRequest(licenseKey);
  const trimmedKey = `${request.licenseKey || ''}`.trim();
  const trustedPublicKeyPem = normalizePublicKeyPem(request.publicKeyPem);
  const fail = (errorMessage, payload = null) => {
    logLicenseActivationEvent({
      status: 'failed',
      reason: errorMessage,
      payload,
      licenseKey: trimmedKey
    });
    return { success: false, error: errorMessage };
  };

  if (!trimmedKey) {
    return fail('License key is required.');
  }

  let parsed;
  try {
    parsed = parseLicenseKey(trimmedKey);
  } catch (err) {
    return fail(err.message || 'Invalid license key.');
  }

  if (!verifyLicenseSignature(parsed.payload, parsed.signature, trustedPublicKeyPem)) {
    return fail(
      trustedPublicKeyPem
        ? 'License key signature is invalid for the provided trusted public key.'
        : 'License key signature is invalid. Paste the activation bundle JSON from the generator, not only the raw key.',
      parsed.payload
    );
  }

  const nowMs = Date.now();
  const issuedAtMs = new Date(parsed.payload.issuedAt || 0).getTime();
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) {
    return fail('License issued time is invalid.', parsed.payload);
  }

  if (nowMs - issuedAtMs > LICENSE_ACTIVATION_WINDOW_MS) {
    return fail('This activation key is older than 1 hour. Generate a fresh key and try again.', parsed.payload);
  }

  const runtime = evaluateLicenseKey(trimmedKey, nowMs, { publicKeyPem: trustedPublicKeyPem });
  if (runtime.mode === 'locked' || !runtime.activated) {
    return fail(runtime.reason || 'License validation failed.', parsed.payload);
  }

  if (trustedPublicKeyPem) {
    appStore.set('license.publicKeyPem', trustedPublicKeyPem);
  }
  appStore.set('license.activationKey', trimmedKey);
  appStore.set('license.activatedAt', new Date(nowMs).toISOString());
  appStore.set('license.machineIdAtActivation', getMachineId());

  logLicenseActivationEvent({
    status: 'success',
    reason: '',
    payload: parsed.payload,
    licenseKey: trimmedKey
  });

  return { success: true, status: getRuntimeLicenseStatus(nowMs) };
}

function clearLicenseActivation() {
  appStore.set('license.activationKey', '');
  appStore.set('license.activatedAt', '');
  appStore.set('license.machineIdAtActivation', '');
  return { success: true, status: getRuntimeLicenseStatus() };
}

function isMutatingSql(sql = '') {
  const stripped = `${sql || ''}`.trim().replace(/^\/\*[\s\S]*?\*\//, '').replace(/^--.*$/gm, '').trim();
  if (!stripped) return false;
  const first = stripped.split(/\s+/)[0].toUpperCase();
  if (['INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'VACUUM'].includes(first)) {
    return true;
  }
  if (first === 'PRAGMA') {
    return /=/.test(stripped);
  }
  if (first === 'WITH') {
    return /\b(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(stripped);
  }
  return false;
}

function isSystemWriteAllowedInReadOnly(sql = '') {
  const normalized = `${sql || ''}`.replace(/\s+/g, ' ').trim().toUpperCase();
  return normalized.startsWith('UPDATE USERS SET LAST_LOGIN');
}

function normalizeDbFolder(folderPath, defaultFolder = DEFAULT_DB_FOLDER) {
  const trimmed = `${folderPath || ''}`.trim().replace(/[\\/]+$/, '');
  return trimmed || defaultFolder;
}

function ensureDirectory(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function tryMigrateLegacyFolderPath(folderPath, leafFolderName) {
  const normalizedPath = normalizeDbFolder(folderPath, '');
  if (!normalizedPath) return folderPath;

  const parsed = path.parse(normalizedPath);
  const leafName = path.basename(normalizedPath);
  const parentPath = path.dirname(normalizedPath);
  const parentName = path.basename(parentPath);

  if (
    leafName.toLowerCase() !== `${leafFolderName || ''}`.toLowerCase()
    || parentName.toLowerCase() !== LEGACY_APP_DATA_DIR_NAME.toLowerCase()
  ) {
    return normalizedPath;
  }

  const targetRoot = path.join(parsed.root, DEFAULT_ERP_NAME);
  const targetPath = path.join(targetRoot, leafFolderName);

  if (normalizedPath.toLowerCase() === targetPath.toLowerCase()) {
    return normalizedPath;
  }

  try {
    if (!fs.existsSync(normalizedPath)) {
      return targetPath;
    }

    if (!fs.existsSync(targetPath)) {
      ensureDirectory(targetRoot);
      fs.cpSync(normalizedPath, targetPath, { recursive: true, force: false });
    }

    return targetPath;
  } catch (err) {
    console.warn(`Legacy ${leafFolderName} folder migration skipped:`, err.message);
    return normalizedPath;
  }
}

function migrateLegacyDbFiles(folderPath, preferredFileName, legacyFileName) {
  const preferredPath = path.join(folderPath, preferredFileName);
  const legacyPath = path.join(folderPath, legacyFileName);

  if (fs.existsSync(preferredPath) || !fs.existsSync(legacyPath)) {
    return preferredPath;
  }

  fs.renameSync(legacyPath, preferredPath);
  ['-wal', '-shm'].forEach((suffix) => {
    const legacySidecar = `${legacyPath}${suffix}`;
    const preferredSidecar = `${preferredPath}${suffix}`;
    if (fs.existsSync(legacySidecar) && !fs.existsSync(preferredSidecar)) {
      fs.renameSync(legacySidecar, preferredSidecar);
    }
  });

  return preferredPath;
}

function formatBackupMonthFolder(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatBackupDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeBackupDestination(folderPath) {
  return `${folderPath || ''}`.trim().replace(/[\\/]+$/, '');
}

function getRuntimeUpdateConfig() {
  const enabled = getSettingValue('app_update_enabled', 'false') === 'true';
  const updateUrl = `${getSettingValue('app_update_url', process.env.OWNERP_UPDATE_URL || '')}`.trim().replace(/[\\/]+$/, '');
  const channel = `${getSettingValue('app_update_channel', process.env.OWNERP_UPDATE_CHANNEL || 'latest')}`.trim() || 'latest';

  return {
    enabled,
    updateUrl,
    channel,
    configured: Boolean(updateUrl)
  };
}

function broadcastUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-update-status', updateState);
  }
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch
  };
  broadcastUpdateState();
}

function isWebUrlPath(folderPath) {
  return /^https?:\/\//i.test(`${folderPath || ''}`.trim());
}

function validateBackupDestination(folderPath) {
  const normalized = normalizeBackupDestination(folderPath);

  if (!normalized) {
    throw new Error('Backup destination is not configured.');
  }

  if (isWebUrlPath(normalized)) {
    throw new Error('Select a local synced folder path on this PC, not a Google Drive web link.');
  }

  if (!path.isAbsolute(normalized)) {
    throw new Error('Backup destination must be a local folder path on this PC.');
  }

  return normalized;
}

function escapeDriveQueryValue(value) {
  return `${value || ''}`.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function parseGoogleDriveFolderId(folderInput) {
  const trimmed = `${folderInput || ''}`.trim();
  if (!trimmed) return '';

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch?.[1]) return folderMatch[1];

  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch?.[1]) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return '';
}

function getGoogleDriveStoreConfig() {
  const config = appStore.get('googleDrive') || {};
  return {
    clientId: `${config.clientId || ''}`.trim(),
    clientSecret: `${config.clientSecret || ''}`.trim(),
    folderId: `${config.folderId || ''}`.trim(),
    folderInput: `${config.folderInput || ''}`.trim(),
    refreshToken: `${config.refreshToken || ''}`.trim(),
    email: `${config.email || ''}`.trim()
  };
}

function saveGoogleDriveStoreConfig(partialConfig) {
  const currentConfig = getGoogleDriveStoreConfig();
  appStore.set('googleDrive', {
    ...currentConfig,
    ...partialConfig
  });
  return getGoogleDriveStoreConfig();
}

function clearGoogleDriveTokens() {
  return saveGoogleDriveStoreConfig({
    refreshToken: '',
    email: ''
  });
}

function getGoogleDriveStatus() {
  const config = getGoogleDriveStoreConfig();
  return {
    configured: Boolean(config.clientId && config.clientSecret && config.folderId),
    connected: Boolean(config.refreshToken),
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    folderId: config.folderId,
    folderInput: config.folderInput,
    email: config.email,
    tokenStoragePath: path.join(app.getPath('userData'), 'panelerp-config.json')
  };
}

function ensureGoogleDriveConfigured() {
  const config = getGoogleDriveStoreConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error('Google Drive Client ID and Client Secret are required.');
  }

  if (!config.folderId) {
    throw new Error('Google Drive folder URL or folder ID is required.');
  }

  return config;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  let data = null;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (err) {
    data = { raw: responseText };
  }

  if (!response.ok) {
    const message = data?.error_description || data?.error?.message || data?.error || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return data;
}

async function exchangeGoogleAuthCode({ code, redirectUri, clientId, clientSecret }) {
  const formData = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  return fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
}

async function refreshGoogleAccessToken({ clientId, clientSecret, refreshToken }) {
  const formData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  return fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
}

async function fetchGoogleAccountEmail(accessToken) {
  try {
    const profile = await fetchJson('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return `${profile?.email || ''}`.trim();
  } catch (err) {
    console.warn('Unable to fetch Google account email:', err.message);
    return '';
  }
}

async function getGoogleDriveAccessToken() {
  const config = ensureGoogleDriveConfigured();

  if (!config.refreshToken) {
    throw new Error('Google Drive is not connected yet. Click Connect Google Drive first.');
  }

  const tokenPayload = await refreshGoogleAccessToken(config);
  return {
    accessToken: tokenPayload.access_token,
    email: config.email || await fetchGoogleAccountEmail(tokenPayload.access_token),
    folderId: config.folderId
  };
}

async function openGoogleOAuthFlow() {
  const config = ensureGoogleDriveConfigured();
  const state = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    let finished = false;
    const complete = (handler) => {
      if (finished) return;
      finished = true;
      oauthServer.close(() => handler());
    };

    const oauthServer = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url, 'http://127.0.0.1');
        if (requestUrl.pathname !== '/google-drive/oauth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }

        const receivedState = requestUrl.searchParams.get('state');
        const code = requestUrl.searchParams.get('code');
        const error = requestUrl.searchParams.get('error');

        if (receivedState !== state) {
          throw new Error('Google Drive login state did not match.');
        }

        if (error) {
          throw new Error(`Google Drive login was not completed: ${error}`);
        }

        if (!code) {
          throw new Error('Google Drive login did not return an authorization code.');
        }

        const address = oauthServer.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const redirectUri = `http://127.0.0.1:${port}/google-drive/oauth/callback`;
        const tokenPayload = await exchangeGoogleAuthCode({
          code,
          redirectUri,
          clientId: config.clientId,
          clientSecret: config.clientSecret
        });

        const refreshToken = `${tokenPayload.refresh_token || ''}`.trim();
        if (!refreshToken) {
          throw new Error('Google did not return a refresh token. Remove access and try connecting again.');
        }

        const email = await fetchGoogleAccountEmail(tokenPayload.access_token);
        saveGoogleDriveStoreConfig({ refreshToken, email });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body style="font-family:Segoe UI,sans-serif;padding:24px;">Google Drive connected. You can close this window and return to OWNERP.</body></html>');
        complete(() => resolve(getGoogleDriveStatus()));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:Segoe UI,sans-serif;padding:24px;">Google Drive connection failed: ${err.message}</body></html>`);
        complete(() => reject(err));
      }
    });

    oauthServer.listen(0, '127.0.0.1', async () => {
      try {
        const address = oauthServer.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const redirectUri = `http://127.0.0.1:${port}/google-drive/oauth/callback`;
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', config.clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', GOOGLE_DRIVE_SCOPE);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', state);

        await shell.openExternal(authUrl.toString());
      } catch (err) {
        complete(() => reject(err));
      }
    });

    setTimeout(() => {
      complete(() => reject(new Error('Google Drive login timed out. Please try again.')));
    }, GOOGLE_DRIVE_AUTH_TIMEOUT_MS);
  });
}

async function driveApiRequest(url, { method = 'GET', accessToken, headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers
    },
    body
  });

  const responseText = await response.text();
  let data = null;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (err) {
    data = { raw: responseText };
  }

  if (!response.ok) {
    const message = data?.error?.message || response.statusText || 'Google Drive request failed';
    throw new Error(message);
  }

  return data;
}

async function ensureGoogleDriveMonthFolder({ accessToken, parentFolderId, monthFolderName }) {
  const query = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${escapeDriveQueryValue(monthFolderName)}'`,
    `'${escapeDriveQueryValue(parentFolderId)}' in parents`,
    'trashed = false'
  ].join(' and ');

  const listResponse = await driveApiRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`,
    { accessToken }
  );

  if (Array.isArray(listResponse.files) && listResponse.files.length) {
    return listResponse.files[0];
  }

  return driveApiRequest('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: monthFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    })
  });
}

async function uploadFileToGoogleDrive({ accessToken, parentFolderId, localFilePath, fileName }) {
  const boundary = `ownerp-${crypto.randomBytes(12).toString('hex')}`;
  const metadata = {
    name: fileName,
    parents: [parentFolderId]
  };
  const fileBuffer = fs.readFileSync(localFilePath);
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf8'
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([preamble, fileBuffer, closing]);

  return driveApiRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    accessToken,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
}

function createTempBackupFile(fileName, writer) {
  const tempDir = path.join(os.tmpdir(), 'ownerp-google-drive-backups');
  ensureDirectory(tempDir);
  const tempFilePath = path.join(tempDir, fileName);
  writer(tempFilePath);
  return tempFilePath;
}

function upsertSystemNotification(id, type, title, message, referenceType = 'app_update') {
  if (!db) return;

  try {
    db.prepare(`
      INSERT OR REPLACE INTO notifications (id, type, title, message, reference_id, reference_type, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, title, message, id, referenceType, null);
  } catch (err) {
    console.error('Unable to create system notification:', err);
  }
}

function showDesktopNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch (err) {
    console.warn('Desktop notification skipped:', err.message);
  }
}

function createPreUpdateBackup() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const { folderPath: masterFolder } = getDatabaseInfo();
  const backupFolder = path.join(masterFolder, 'backups', 'pre-update', timestamp);
  ensureDirectory(backupFolder);

  const masterBackupFile = path.join(backupFolder, `panelerp_preupdate_${timestamp}_master.db`);
  const accountingBackupFile = path.join(backupFolder, `panelerp_preupdate_${timestamp}_accounting.db`);

  createDatabaseBackupFile(masterBackupFile);
  createAccountingDatabaseBackupFile(accountingBackupFile);

  return {
    backupFolder,
    files: [masterBackupFile, accountingBackupFile]
  };
}

function getAutoUpdater() {
  if (updaterModule) return updaterModule;

  try {
    updaterModule = require('electron-updater').autoUpdater;
    updaterModule.autoDownload = false;
    updaterModule.autoInstallOnAppQuit = false;
    return updaterModule;
  } catch (err) {
    console.warn('electron-updater is not installed yet:', err.message);
    return null;
  }
}

function configureAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  const runtimeConfig = getRuntimeUpdateConfig();

  setUpdateState({
    enabled: runtimeConfig.enabled,
    configured: runtimeConfig.configured,
    channel: runtimeConfig.channel,
    updateUrl: runtimeConfig.updateUrl
  });

  if (!autoUpdater) {
    setUpdateState({
      message: 'electron-updater dependency is missing. Run npm install after pulling this version.'
    });
    return null;
  }

  if (!app.isPackaged) {
    setUpdateState({
      message: 'App updates are available only in the installed packaged app.'
    });
    return autoUpdater;
  }

  if (!runtimeConfig.enabled || !runtimeConfig.configured) {
    setUpdateState({
      message: runtimeConfig.enabled
        ? 'Set the update URL to enable market updates.'
        : 'Software updates are currently disabled.'
    });
    return autoUpdater;
  }

  autoUpdater.channel = runtimeConfig.channel;
  autoUpdater.allowDowngrade = false;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: runtimeConfig.updateUrl,
    channel: runtimeConfig.channel
  });

  setUpdateState({
    message: 'Update service is ready.'
  });
  return autoUpdater;
}

function attachAutoUpdaterListeners() {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater || autoUpdater.__ownerpListenersAttached) return;

  autoUpdater.__ownerpListenersAttached = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      checking: true,
      downloading: false,
      progressPercent: 0,
      message: 'Checking for updates...',
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on('update-available', (info) => {
    const version = `${info?.version || ''}`.trim();
    const title = 'Software update available';
    const message = `OWNERP ${version || 'new version'} is available. Review and download it from Settings.`;

    setUpdateState({
      checking: false,
      available: true,
      downloaded: false,
      availableVersion: version,
      message
    });
    upsertSystemNotification(`notif_update_available_${version || 'latest'}`, 'info', title, message);
    showDesktopNotification(title, message);
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      checking: false,
      available: false,
      downloaded: false,
      downloading: false,
      availableVersion: '',
      downloadedVersion: '',
      progressPercent: 0,
      message: 'You are already on the latest version.'
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      checking: false,
      downloading: true,
      progressPercent: Number(progress?.percent || 0),
      message: `Downloading update... ${Math.round(Number(progress?.percent || 0))}%`
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = `${info?.version || ''}`.trim();
    const title = 'Update ready to install';
    const message = `OWNERP ${version || 'new version'} is downloaded. The app will create a backup before installing.`;

    setUpdateState({
      checking: false,
      downloading: false,
      downloaded: true,
      downloadedVersion: version,
      progressPercent: 100,
      lastDownloadedAt: new Date().toISOString(),
      message
    });
    upsertSystemNotification(`notif_update_downloaded_${version || 'latest'}`, 'success', title, message);
    showDesktopNotification(title, message);
  });

  autoUpdater.on('error', (err) => {
    const message = err?.message || 'Update service failed.';
    setUpdateState({
      checking: false,
      downloading: false,
      message
    });
    upsertSystemNotification(`notif_update_error_${Date.now()}`, 'error', 'Software update error', message);
  });
}

async function checkForAppUpdates() {
  const autoUpdater = configureAutoUpdater();
  if (!autoUpdater) {
    return { success: false, error: updateState.message };
  }

  const runtimeConfig = getRuntimeUpdateConfig();
  if (!app.isPackaged || !runtimeConfig.enabled || !runtimeConfig.configured) {
    return { success: false, error: updateState.message, ...updateState };
  }

  await autoUpdater.checkForUpdates();
  return { success: true, ...updateState };
}

async function downloadAppUpdate() {
  const autoUpdater = configureAutoUpdater();
  if (!autoUpdater) {
    return { success: false, error: updateState.message };
  }

  if (!updateState.available) {
    return { success: false, error: 'No downloaded update is pending. Check for updates first.' };
  }

  await autoUpdater.downloadUpdate();
  return { success: true, ...updateState };
}

function installDownloadedUpdate() {
  const autoUpdater = configureAutoUpdater();
  if (!autoUpdater) {
    return { success: false, error: updateState.message };
  }

  if (!updateState.downloaded) {
    return { success: false, error: 'No downloaded update is ready to install.' };
  }

  const backupResult = createPreUpdateBackup();
  const backupMessage = `Pre-update backup completed:\n${backupResult.files.join('\n')}`;
  upsertSystemNotification(`notif_preupdate_backup_${Date.now()}`, 'success', 'Pre-update backup completed', backupMessage);

  setUpdateState({
    message: 'Backup completed. Installing update and restarting...'
  });

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });

  return {
    success: true,
    backupFolder: backupResult.backupFolder,
    backupFiles: backupResult.files
  };
}

function getSettingValue(key, fallback = '') {
  if (!db) return fallback;

  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value ?? fallback;
  } catch (err) {
    console.error(`Failed to read setting "${key}":`, err);
    return fallback;
  }
}

function setSettingValue(key, value) {
  if (!db) return;

  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
  ).run(key, value);
}

function getInstallerCompanySeedPath() {
  return path.join(app.getPath('appData'), DEFAULT_ERP_NAME, 'company-seed.txt');
}

function readInstallerCompanySeed() {
  const seedPath = getInstallerCompanySeedPath();
  if (!fs.existsSync(seedPath)) {
    return {};
  }

  try {
    const lines = fs.readFileSync(seedPath, 'utf8').split(/\r?\n/);
    const parsed = {};
    lines.forEach((line) => {
      const trimmed = `${line || ''}`.trim();
      if (!trimmed || !trimmed.includes('=')) return;
      const eqIndex = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key) parsed[key] = value;
    });
    return parsed;
  } catch (err) {
    console.warn('Unable to read installer company seed:', err.message);
    return {};
  }
}

function applyInstallerCompanySeedIfNeeded() {
  const seed = readInstallerCompanySeed();
  if (!Object.keys(seed).length) return;

  const mapping = [
    ['company_name', 'company_name'],
    ['company_email', 'company_email'],
    ['company_phone', 'company_phone'],
    ['company_gst', 'company_gst'],
    ['company_address', 'company_address']
  ];

  mapping.forEach(([settingKey, seedKey]) => {
    const existing = `${getSettingValue(settingKey, '')}`.trim();
    const incoming = `${seed[seedKey] || ''}`.trim();
    if (!existing && incoming) {
      setSettingValue(settingKey, incoming);
    }
  });
}

function ensureSystemSettings() {
  if (!db) return;

  const defaultSettings = [
    ['erp_name', DEFAULT_ERP_NAME],
    ['company_name', 'Panel Manufacturing Co.'],
    ['company_address', ''],
    ['company_phone', ''],
    ['company_email', ''],
    ['company_gst', ''],
    ['company_logo', '/ownerp-logo.png'],
    ['enabled_modules', JSON.stringify(['dashboard', 'products', 'categories', 'inventory', 'contacts', 'crm', 'hr', 'accounting', 'bom', 'orders', 'inward', 'reports', 'notifications'])],
    ['currency', 'INR'],
    ['currency_symbol', 'â‚¹'],
    ['low_stock_threshold', '10'],
    ['work_hours_per_day', '9'],
    ['auto_backup', 'true'],
    ['theme', 'dark'],
    ['cloud_backup_enabled', 'false'],
    ['cloud_backup_provider', 'local_folder'],
    ['cloud_backup_destination', ''],
    ['cloud_backup_interval', 'daily'],
    ['cloud_backup_last_run_at', ''],
    ['cloud_backup_last_file', ''],
    ['cloud_backup_last_error', ''],
    ['app_update_enabled', 'false'],
    ['app_update_url', ''],
    ['app_update_channel', 'latest']
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(([key, value]) => stmt.run(key, value));

  const categoriesModuleMigrationKey = 'module_categories_enabled_v1';
  const migrationState = db.prepare('SELECT value FROM settings WHERE key = ?').get(categoriesModuleMigrationKey);
  if (!migrationState) {
    const currentEnabledModules = parseModuleAccess(getSettingValue('enabled_modules', '[]'), []);
    if (!currentEnabledModules.includes('categories')) {
      const mergedEnabledModules = [...currentEnabledModules, 'categories'];
      db.prepare(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
      ).run('enabled_modules', JSON.stringify(mergedEnabledModules));
    }
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    ).run(categoriesModuleMigrationKey, 'done');
  }

  applyInstallerCompanySeedIfNeeded();
}

function getCompanyProfileSnapshot() {
  const seed = readInstallerCompanySeed();
  return {
    companyName: `${getSettingValue('company_name', seed.company_name || '')}`.trim(),
    companyEmail: `${getSettingValue('company_email', seed.company_email || '')}`.trim(),
    companyPhone: `${getSettingValue('company_phone', seed.company_phone || '')}`.trim(),
    companyGst: `${getSettingValue('company_gst', seed.company_gst || '')}`.trim(),
    companyAddress: `${getSettingValue('company_address', seed.company_address || '')}`.trim()
  };
}

function logLicenseActivationEvent({
  status = 'failed',
  reason = '',
  payload = null,
  licenseKey = ''
} = {}) {
  if (!db) return;
  try {
    const company = getCompanyProfileSnapshot();
    const machineId = getMachineId();
    const keyFingerprint = crypto.createHash('sha256').update(`${licenseKey || ''}`).digest('hex');
    db.prepare(`
      INSERT INTO license_activation_logs (
        id, activated_at, status, reason, license_id, customer, plan, valid_until, machine_id,
        company_name, company_email, company_phone, company_gst, company_address, key_fingerprint
      ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      status,
      reason || '',
      payload?.licenseId || '',
      payload?.customer || '',
      payload?.plan || '',
      payload?.validUntil || '',
      machineId,
      company.companyName,
      company.companyEmail,
      company.companyPhone,
      company.companyGst,
      company.companyAddress,
      keyFingerprint
    );
  } catch (err) {
    console.warn('Unable to write license activation log:', err.message);
  }
}

function getCloudBackupSettings() {
  const interval = getSettingValue('cloud_backup_interval', 'daily');
  const provider = getSettingValue('cloud_backup_provider', 'local_folder');

  return {
    enabled: getSettingValue('cloud_backup_enabled', 'false') === 'true',
    provider: provider === 'google_drive_api' ? 'google_drive_api' : 'local_folder',
    destination: normalizeBackupDestination(getSettingValue('cloud_backup_destination', '')),
    interval: AUTO_BACKUP_INTERVALS[interval] ? interval : 'daily',
    lastRunAt: getSettingValue('cloud_backup_last_run_at', ''),
    lastFile: getSettingValue('cloud_backup_last_file', ''),
    lastError: getSettingValue('cloud_backup_last_error', '')
  };
}

function getCloudBackupMonthFolder(destination, date = new Date()) {
  return path.join(destination, formatBackupMonthFolder(date));
}

function checkpointDatabase(databaseHandle, label) {
  if (!databaseHandle) return;

  try {
    databaseHandle.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn(`${label} backup checkpoint skipped:`, err.message);
  }
}

function createBackupFileFromSource(sourcePath, targetFile, { databaseHandle = null, missingMessage, label }) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(missingMessage);
  }

  checkpointDatabase(databaseHandle, label);
  ensureDirectory(path.dirname(targetFile));
  fs.copyFileSync(sourcePath, targetFile);
}

function createDatabaseBackupFile(targetFile) {
  const { dbPath } = getDatabaseInfo();

  createBackupFileFromSource(dbPath, targetFile, {
    databaseHandle: db,
    missingMessage: 'Live database file was not found.',
    label: 'ERP'
  });
}

function createAccountingDatabaseBackupFile(targetFile) {
  const { dbPath } = getAccountingDatabaseInfo();

  createBackupFileFromSource(dbPath, targetFile, {
    databaseHandle: accountingDb,
    missingMessage: 'Live accounting database file was not found.',
    label: 'Accounting'
  });
}

async function runGoogleDriveCloudBackup({ reason = 'manual', config, now }) {
  const googleDriveToken = await getGoogleDriveAccessToken();
  const monthFolderName = formatBackupMonthFolder(now);
  const monthFolder = await ensureGoogleDriveMonthFolder({
    accessToken: googleDriveToken.accessToken,
    parentFolderId: googleDriveToken.folderId,
    monthFolderName
  });
  const dateStamp = formatBackupDate(now);
  const masterFileName = `panelerp_${config.interval}_${dateStamp}_master.db`;
  const accountingFileName = `panelerp_${config.interval}_${dateStamp}_accounting.db`;
  const masterTempFile = createTempBackupFile(masterFileName, createDatabaseBackupFile);
  const accountingTempFile = createTempBackupFile(accountingFileName, createAccountingDatabaseBackupFile);

  try {
    const [masterUpload, accountingUpload] = await Promise.all([
      uploadFileToGoogleDrive({
        accessToken: googleDriveToken.accessToken,
        parentFolderId: monthFolder.id,
        localFilePath: masterTempFile,
        fileName: masterFileName
      }),
      uploadFileToGoogleDrive({
        accessToken: googleDriveToken.accessToken,
        parentFolderId: monthFolder.id,
        localFilePath: accountingTempFile,
        fileName: accountingFileName
      })
    ]);

    const savedFiles = [masterUpload.webViewLink || masterUpload.id, accountingUpload.webViewLink || accountingUpload.id];
    return {
      success: true,
      path: savedFiles.join('\n'),
      files: savedFiles,
      reason,
      monthFolder: monthFolder.webViewLink || monthFolder.id,
      provider: 'google_drive_api'
    };
  } finally {
    [masterTempFile, accountingTempFile].forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { force: true });
        }
      } catch (err) {
        console.warn('Temp backup cleanup skipped:', err.message);
      }
    });
  }
}

function runLocalFolderCloudBackup({ reason = 'manual', config, now }) {
  const destination = validateBackupDestination(config.destination);
  const monthFolder = getCloudBackupMonthFolder(destination, now);
  const dateStamp = formatBackupDate(now);
  const masterBackupFile = path.join(monthFolder, `panelerp_${config.interval}_${dateStamp}_master.db`);
  const accountingBackupFile = path.join(monthFolder, `panelerp_${config.interval}_${dateStamp}_accounting.db`);

  createDatabaseBackupFile(masterBackupFile);
  createAccountingDatabaseBackupFile(accountingBackupFile);

  const savedFiles = [masterBackupFile, accountingBackupFile];
  return {
    success: true,
    path: savedFiles.join('\n'),
    files: savedFiles,
    reason,
    monthFolder,
    provider: 'local_folder'
  };
}

async function runConfiguredCloudBackup({ reason = 'manual' } = {}) {
  const config = getCloudBackupSettings();

  if (!config.enabled) {
    throw new Error('Automatic backup is disabled.');
  }

  const now = new Date();
  const result = config.provider === 'google_drive_api'
    ? await runGoogleDriveCloudBackup({ reason, config, now })
    : runLocalFolderCloudBackup({ reason, config, now });
  setSettingValue('cloud_backup_last_run_at', now.toISOString());
  setSettingValue('cloud_backup_last_file', result.path);
  setSettingValue('cloud_backup_last_error', '');
  return result;
}

function shouldRunAutoBackup(config, now = new Date()) {
  if (!config.enabled) return false;
  if (config.provider === 'local_folder' && !config.destination) return false;
  if (config.provider === 'google_drive_api' && !getGoogleDriveStatus().connected) return false;

  if (!config.lastRunAt) return true;

  const lastRun = new Date(config.lastRunAt);
  if (Number.isNaN(lastRun.getTime())) return true;

  const intervalMs = AUTO_BACKUP_INTERVALS[config.interval] || AUTO_BACKUP_INTERVALS.daily;
  return now.getTime() - lastRun.getTime() >= intervalMs;
}

function stopAutoBackupScheduler() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

function startAutoBackupScheduler() {
  stopAutoBackupScheduler();

  autoBackupTimer = setInterval(async () => {
    try {
      const config = getCloudBackupSettings();
      if (!shouldRunAutoBackup(config)) return;
      await runConfiguredCloudBackup({ reason: 'scheduled' });
    } catch (err) {
      console.error('Scheduled cloud backup failed:', err);
      setSettingValue('cloud_backup_last_error', err.message || 'Automatic backup failed.');
    }
  }, AUTO_BACKUP_CHECK_MS);
}

function restoreDatabaseFromBackupFile(sourceFile) {
  const normalizedSource = `${sourceFile || ''}`.trim();
  if (!normalizedSource || !fs.existsSync(normalizedSource)) {
    throw new Error('Selected backup file was not found.');
  }

  const { folderPath, dbPath } = getDatabaseInfo();
  closeDatabaseConnection();
  ensureDirectory(folderPath);
  backupExistingTargetDatabase(dbPath);
  fs.copyFileSync(normalizedSource, dbPath);
  initDatabase(folderPath);

  return {
    success: true,
    sourceFile: normalizedSource,
    dbPath
  };
}

function getInstallerDbFolder() {
  try {
    const installerConfigPaths = [
      path.join(app.getPath('appData'), APP_DATA_DIR_NAME, 'db-folder.txt'),
      path.join(app.getPath('appData'), LEGACY_APP_DATA_DIR_NAME, 'db-folder.txt')
    ];

    for (const installerConfigPath of installerConfigPaths) {
      if (!fs.existsSync(installerConfigPath)) continue;

      const savedPath = fs.readFileSync(installerConfigPath, 'utf8').trim();
      if (savedPath) {
        return normalizeDbFolder(savedPath, DEFAULT_DB_FOLDER);
      }
    }

    return null;
  } catch (err) {
    console.error('Unable to read installer database location:', err);
    return null;
  }
}

function saveDatabaseFolder(folderPath) {
  const normalizedPath = tryMigrateLegacyFolderPath(
    normalizeDbFolder(folderPath, DEFAULT_DB_FOLDER),
    'database'
  );
  const installerConfigPath = path.join(app.getPath('appData'), APP_DATA_DIR_NAME, 'db-folder.txt');

  ensureDirectory(path.dirname(installerConfigPath));
  fs.writeFileSync(installerConfigPath, normalizedPath, 'utf8');

  appStore.set('database.folderPath', normalizedPath);
  currentDbFolder = normalizedPath;
  currentDbPath = path.join(normalizedPath, DB_FILE_NAME);
  return normalizedPath;
}

function saveAccountingDatabaseFolder(folderPath) {
  const normalizedPath = tryMigrateLegacyFolderPath(
    normalizeDbFolder(folderPath, DEFAULT_ACCOUNTING_DB_FOLDER),
    'accounting'
  );
  appStore.set('accountingDatabase.folderPath', normalizedPath);
  currentAccountingDbFolder = normalizedPath;
  currentAccountingDbPath = path.join(normalizedPath, ACCOUNTING_DB_FILE_NAME);
  return normalizedPath;
}

function getDatabaseFolder() {
  return currentDbFolder || normalizeDbFolder(
    getInstallerDbFolder() || appStore.get('database.folderPath') || DEFAULT_DB_FOLDER
  , DEFAULT_DB_FOLDER);
}

function getAccountingDatabaseFolder() {
  return currentAccountingDbFolder || normalizeDbFolder(
    appStore.get('accountingDatabase.folderPath') || DEFAULT_ACCOUNTING_DB_FOLDER,
    DEFAULT_ACCOUNTING_DB_FOLDER
  );
}

function getDatabaseInfo() {
  const folderPath = getDatabaseFolder();
  ensureDirectory(folderPath);
  const dbPath = migrateLegacyDbFiles(folderPath, DB_FILE_NAME, LEGACY_DB_FILE_NAME);
  return {
    folderPath,
    dbPath
  };
}

function getAccountingDatabaseInfo() {
  const folderPath = getAccountingDatabaseFolder();
  ensureDirectory(folderPath);
  const dbPath = migrateLegacyDbFiles(folderPath, ACCOUNTING_DB_FILE_NAME, LEGACY_ACCOUNTING_DB_FILE_NAME);
  return {
    folderPath,
    dbPath
  };
}

function closeDatabaseConnection() {
  if (!db) return;

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('WAL checkpoint skipped:', err.message);
  }

  try {
    db.close();
  } catch (err) {
    console.error('Database close error:', err);
  }

  db = null;
}

function closeAccountingDatabaseConnection() {
  if (!accountingDb) return;

  try {
    accountingDb.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('Accounting WAL checkpoint skipped:', err.message);
  }

  try {
    accountingDb.close();
  } catch (err) {
    console.error('Accounting database close error:', err);
  }

  accountingDb = null;
}

function backupExistingTargetDatabase(targetDbPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (fs.existsSync(targetDbPath)) {
    const backupFile = path.join(path.dirname(targetDbPath), `panelerp_existing_${timestamp}.db`);
    fs.copyFileSync(targetDbPath, backupFile);
  }

  ['', '-wal', '-shm'].forEach((suffix) => {
    const filePath = `${targetDbPath}${suffix}`;
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

function copyDatabaseFiles(sourceDbPath, targetDbPath) {
  if (!fs.existsSync(sourceDbPath)) {
    return false;
  }

  ensureDirectory(path.dirname(targetDbPath));

  ['', '-wal', '-shm'].forEach((suffix) => {
    const sourceFile = `${sourceDbPath}${suffix}`;
    const targetFile = `${targetDbPath}${suffix}`;

    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, targetFile);
    }
  });

  const sourceBackupDir = path.join(path.dirname(sourceDbPath), 'backups');
  const targetBackupDir = path.join(path.dirname(targetDbPath), 'backups');
  if (fs.existsSync(sourceBackupDir)) {
    fs.cpSync(sourceBackupDir, targetBackupDir, { recursive: true, force: true });
  }

  return true;
}

async function promptForDatabaseFolder(browserWindow = null, defaultPath = getDatabaseFolder()) {
  const result = await dialog.showOpenDialog(browserWindow || mainWindow || undefined, {
    title: 'Select Database Folder',
    defaultPath: normalizeDbFolder(defaultPath, DEFAULT_DB_FOLDER),
    buttonLabel: 'Select Folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return normalizeDbFolder(result.filePaths[0], DEFAULT_DB_FOLDER);
}

async function promptForAccountingDatabaseFolder(browserWindow = null, defaultPath = getAccountingDatabaseFolder()) {
  const result = await dialog.showOpenDialog(browserWindow || mainWindow || undefined, {
    title: 'Select Accounting Database Folder',
    defaultPath: normalizeDbFolder(defaultPath, DEFAULT_ACCOUNTING_DB_FOLDER),
    buttonLabel: 'Select Folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return normalizeDbFolder(result.filePaths[0], DEFAULT_ACCOUNTING_DB_FOLDER);
}

async function ensureDatabaseLocationConfigured() {
  const installerFolderPath = getInstallerDbFolder();
  let folderPath = installerFolderPath || appStore.get('database.folderPath');

  if (!folderPath) {
    const choice = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Choose Folder', 'Use Default'],
      defaultId: 0,
      cancelId: 1,
      title: `${DEFAULT_ERP_NAME} Database Setup`,
      message: `Choose where ${DEFAULT_ERP_NAME} should save its database files.`,
      detail: `Default location: ${DEFAULT_DB_FOLDER}\n\nYou can change this later from Settings → Backup & Data.`
    });

    if (choice.response === 0) {
      folderPath = await promptForDatabaseFolder(null, DEFAULT_DB_FOLDER);
    }
  }

  return saveDatabaseFolder(folderPath || DEFAULT_DB_FOLDER);
}

function ensureAccountingDatabaseLocationConfigured() {
  return saveAccountingDatabaseFolder(
    appStore.get('accountingDatabase.folderPath') || DEFAULT_ACCOUNTING_DB_FOLDER
  );
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function textResponse(res, statusCode, content, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(content);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

function getLocalIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = new Set(['127.0.0.1']);

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry && entry.family === 'IPv4' && !entry.internal && entry.address) {
        addresses.add(entry.address);
      }
    });
  });

  return Array.from(addresses);
}

function getHrConnectStatus() {
  return {
    ...hrConnectStatus,
    localUrls: [...hrConnectStatus.localUrls]
  };
}

function getSettingsObject() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function parseModuleAccess(value, fallback = []) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(`${value || ''}`.trim() || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function canAccessHrConnect(user, settingsMap) {
  if (!user) return false;
  const role = `${user.role || ''}`.trim().toLowerCase();
  if (role === 'developer') return true;

  const enabledModules = new Set(parseModuleAccess(settingsMap.enabled_modules, []));
  if (!enabledModules.has('hr')) return false;
  if (role === 'admin') return true;

  const assignedModules = parseModuleAccess(user.module_access, []);
  return assignedModules.includes('hr');
}

function resolveEmployeeForUser(user) {
  if (!user?.id) return null;

  return db.prepare('SELECT * FROM hr_employees WHERE user_id = ? LIMIT 1').get(user.id) || null;
}

function currentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeKey() {
  return new Date().toTimeString().slice(0, 5);
}

function calculateWorkedHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = `${checkIn}`.split(':').map(Number);
  const [outHour, outMinute] = `${checkOut}`.split(':').map(Number);
  const start = (inHour * 60) + inMinute;
  const end = (outHour * 60) + outMinute;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Number(((end - start) / 60).toFixed(2));
}

function getRequiredWorkHoursFromSettings() {
  const settings = getSettingsObject();
  const parsed = Number(settings.work_hours_per_day || 9);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 9;
}

function createHrConnectSession(user, employee) {
  const token = crypto.randomBytes(24).toString('hex');
  hrConnectSessions.set(token, {
    userId: user.id,
    employeeId: employee.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + HR_CONNECT_SESSION_TTL_MS
  });
  return token;
}

function getHrConnectSession(req) {
  const authHeader = `${req.headers.authorization || ''}`.trim();
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const session = hrConnectSessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    hrConnectSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function cleanupHrConnectSessions() {
  const now = Date.now();
  Array.from(hrConnectSessions.entries()).forEach(([token, session]) => {
    if (!session || session.expiresAt < now) {
      hrConnectSessions.delete(token);
    }
  });
}

function getHrConnectContextFromRequest(req) {
  const session = getHrConnectSession(req);
  if (!session) return null;

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1 LIMIT 1').get(session.userId);
  if (!user) {
    hrConnectSessions.delete(session.token);
    return null;
  }

  const employee = db.prepare('SELECT * FROM hr_employees WHERE id = ? LIMIT 1').get(session.employeeId);
  if (!employee) {
    hrConnectSessions.delete(session.token);
    return null;
  }

  return { session, user, employee };
}

function getHrConnectPortalHtml() {
  const filePath = path.join(app.getAppPath(), 'public', 'hr-connect.html');
  return fs.readFileSync(filePath, 'utf8');
}

function getEmployeeAttendanceSummary(employeeId) {
  const todayKey = currentDateKey();
  const todayAttendance = db.prepare(`
    SELECT *
    FROM hr_attendance
    WHERE employee_id = ? AND attendance_date = ?
    LIMIT 1
  `).get(employeeId, todayKey) || null;

  const history = db.prepare(`
    SELECT attendance_date, check_in, check_out, status, work_mode, hours_worked, notes
    FROM hr_attendance
    WHERE employee_id = ?
    ORDER BY attendance_date DESC, COALESCE(check_in, '23:59') DESC
    LIMIT 14
  `).all(employeeId);

  return { todayAttendance, history };
}

function punchHrConnectAttendance({ user, employee, mode }) {
  const stamp = currentTimeKey();
  const todayKey = currentDateKey();
  const requiredWorkHours = getRequiredWorkHoursFromSettings();
  const existing = db.prepare('SELECT * FROM hr_attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1').get(employee.id, todayKey);

  if (mode === 'in') {
    if (existing?.check_in) {
      return { ok: false, message: `Already punched in at ${existing.check_in}.` };
    }

    if (existing?.id) {
      db.prepare(`
        UPDATE hr_attendance
        SET check_in = ?, check_out = NULL, status = 'in_progress', work_mode = COALESCE(work_mode, 'onsite'),
            hours_worked = 0, notes = ?, created_by = ?, created_at = datetime('now')
        WHERE id = ?
      `).run(stamp, `Punch in via ${DEFAULT_ERP_NAME} HR Connect`, user.id || 'system', existing.id);
    } else {
      db.prepare(`
        INSERT INTO hr_attendance (
          id, employee_id, attendance_date, check_in, check_out, status, work_mode, hours_worked, overtime_hours, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), employee.id, todayKey, stamp, null, 'in_progress', 'onsite', 0, 0, `Punch in via ${DEFAULT_ERP_NAME} HR Connect`, user.id || 'system');
    }

    return { ok: true, message: `Punch in recorded at ${stamp}.` };
  }

  if (!existing?.check_in) {
    return { ok: false, message: 'Punch in first before punching out.' };
  }

  if (existing?.check_out) {
    return { ok: false, message: `Already punched out at ${existing.check_out}.` };
  }

  const workedHours = calculateWorkedHours(existing.check_in, stamp);
  const computedStatus = workedHours >= requiredWorkHours ? 'present' : 'regularize_required';

  db.prepare(`
    UPDATE hr_attendance
    SET check_out = ?, status = ?,
        hours_worked = ?, notes = ?, created_by = ?
    WHERE id = ?
  `).run(
    stamp,
    computedStatus,
    workedHours,
    `${existing.notes ? `${existing.notes} | ` : ''}Punch out via ${DEFAULT_ERP_NAME} HR Connect`,
    user.id || 'system',
    existing.id
  );

  return { ok: true, message: `Punch out recorded at ${stamp}.` };
}

async function handleHrConnectApi(req, res, requestUrl) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === '/api/hr-connect/status' && req.method === 'GET') {
    jsonResponse(res, 200, getHrConnectStatus());
    return;
  }

  if (requestUrl.pathname === '/api/hr-connect/login' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const username = `${body.username || ''}`.trim();
    const password = `${body.password || ''}`;
    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE username = ? AND password = ? AND is_active = 1
      LIMIT 1
    `).get(username, password);

    if (!user) {
      jsonResponse(res, 401, { success: false, error: 'Invalid credentials.' });
      return;
    }

    const settingsMap = getSettingsObject();
    if (!canAccessHrConnect(user, settingsMap)) {
      jsonResponse(res, 403, { success: false, error: 'This login does not have HR access.' });
      return;
    }

    const employee = resolveEmployeeForUser(user);
    if (!employee) {
      jsonResponse(res, 403, { success: false, error: 'This login is not linked to an employee profile yet.' });
      return;
    }

    const token = createHrConnectSession(user, employee);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    jsonResponse(res, 200, {
      success: true,
      token,
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        employee_code: employee.employee_code,
        designation: employee.designation,
        department: employee.department
      }
    });
    return;
  }

  if (requestUrl.pathname === '/api/hr-connect/logout' && req.method === 'POST') {
    const session = getHrConnectSession(req);
    if (session?.token) hrConnectSessions.delete(session.token);
    jsonResponse(res, 200, { success: true });
    return;
  }

  const context = getHrConnectContextFromRequest(req);
  if (!context) {
    jsonResponse(res, 401, { success: false, error: 'Session expired. Please sign in again.' });
    return;
  }

  if (requestUrl.pathname === '/api/hr-connect/me' && req.method === 'GET') {
    const { todayAttendance, history } = getEmployeeAttendanceSummary(context.employee.id);
    jsonResponse(res, 200, {
      success: true,
      user: {
        username: context.user.username,
        full_name: context.user.full_name,
        email: context.user.email
      },
      employee: {
        id: context.employee.id,
        full_name: context.employee.full_name,
        employee_code: context.employee.employee_code,
        designation: context.employee.designation,
        department: context.employee.department,
        shift_name: context.employee.shift_name
      },
      todayAttendance,
      history
    });
    return;
  }

  if (requestUrl.pathname === '/api/hr-connect/punch' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const mode = `${body.mode || ''}`.trim().toLowerCase();
    if (!['in', 'out'].includes(mode)) {
      jsonResponse(res, 400, { success: false, error: 'Punch mode must be "in" or "out".' });
      return;
    }

    const result = punchHrConnectAttendance({ user: context.user, employee: context.employee, mode });
    const { todayAttendance, history } = getEmployeeAttendanceSummary(context.employee.id);
    jsonResponse(res, result.ok ? 200 : 400, {
      success: result.ok,
      message: result.message,
      todayAttendance,
      history
    });
    return;
  }

  jsonResponse(res, 404, { success: false, error: 'API route not found.' });
}

function startHrConnectServer() {
  if (hrConnectServer) return;

  hrConnectServer = http.createServer(async (req, res) => {
    try {
      cleanupHrConnectSessions();
      const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

      if (requestUrl.pathname.startsWith('/api/hr-connect/')) {
        await handleHrConnectApi(req, res, requestUrl);
        return;
      }

      if (requestUrl.pathname === '/' || requestUrl.pathname === '/hr-connect' || requestUrl.pathname === '/hr-connect/') {
        textResponse(res, 200, getHrConnectPortalHtml(), 'text/html; charset=utf-8');
        return;
      }

      textResponse(res, 404, 'Not found');
    } catch (error) {
      console.error('HR Connect request failed:', error);
      jsonResponse(res, 500, { success: false, error: error.message || 'Unexpected error.' });
    }
  });

  hrConnectServer.on('error', (error) => {
    console.error('HR Connect server failed:', error);
    hrConnectStatus = {
      running: false,
      port: HR_CONNECT_PORT,
      origin: '',
      localUrls: [],
      error: error.message || 'Unable to start server.'
    };
  });

  hrConnectServer.listen(HR_CONNECT_PORT, '0.0.0.0', () => {
    const localUrls = getLocalIpv4Addresses().map((address) => `http://${address}:${HR_CONNECT_PORT}/hr-connect/`);
    hrConnectStatus = {
      running: true,
      port: HR_CONNECT_PORT,
      origin: `http://127.0.0.1:${HR_CONNECT_PORT}`,
      localUrls,
      error: ''
    };
    console.log('HR Connect server started:', localUrls.join(', '));
  });
}

function stopHrConnectServer() {
  if (!hrConnectServer) return;
  hrConnectServer.close();
  hrConnectServer = null;
  hrConnectStatus = {
    running: false,
    port: HR_CONNECT_PORT,
    origin: '',
    localUrls: [],
    error: ''
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: DEFAULT_ERP_NAME,
    icon: path.join(app.getAppPath(), 'public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'electron/preload.js'),
      webSecurity: false
    },
    backgroundColor: '#0f1117',
    show: true,
    titleBarStyle: 'default'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'build', 'index.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.show();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(null);
}

// Database initialization
function initDatabase(folderPath = getDatabaseFolder()) {
  try {
    const Database = require('better-sqlite3');
    const dbFolder = saveDatabaseFolder(folderPath);

    closeDatabaseConnection();
    ensureDirectory(dbFolder);

    const dbPath = migrateLegacyDbFiles(dbFolder, DB_FILE_NAME, LEGACY_DB_FILE_NAME);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    createTables();
    ensureQuotationSchema();
    ensureContactsSchema();
    ensureUserSchema();
    ensureSystemSettings();
    insertDefaultData();
    migrateBrandingSettings();

    currentDbPath = dbPath;
    console.log('Database initialized at:', dbPath);
    return dbPath;
  } catch (err) {
    console.error('Database init error:', err);
    return null;
  }
}

function ensureColumnExists(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function normalizeErpNameValue(value) {
  const normalized = `${value || ''}`.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!normalized || normalized === 'ucserp' || normalized === 'panelerp') {
    return DEFAULT_ERP_NAME;
  }
  return `${value || ''}`.trim();
}

function isLegacyLogoValue(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) return true;

  return (
    normalized.includes('ucs')
    || normalized.includes('ultimate')
    || normalized.includes('panelerp')
  );
}

function migrateBrandingSettings() {
  const currentErpSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('erp_name');
  const normalizedErpName = normalizeErpNameValue(currentErpSetting?.value);

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `).run('erp_name', normalizedErpName);

  const currentLogoSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('company_logo');
  if (isLegacyLogoValue(currentLogoSetting?.value)) {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `).run('company_logo', '/ownerp-logo.png');
  }
}

function ensureQuotationSchema() {
  ensureColumnExists('quotations', 'subject', 'TEXT');
  ensureColumnExists('quotations', 'mail_draft', 'TEXT');
}

function ensureContactsSchema() {
  ensureColumnExists('contacts', 'account_holder_name', 'TEXT');
  ensureColumnExists('contacts', 'bank_name', 'TEXT');
  ensureColumnExists('contacts', 'branch_name', 'TEXT');
  ensureColumnExists('contacts', 'account_number', 'TEXT');
  ensureColumnExists('contacts', 'account_type', "TEXT DEFAULT 'current'");
  ensureColumnExists('contacts', 'ifsc_code', 'TEXT');
  ensureColumnExists('contacts', 'swift_code', 'TEXT');
  ensureColumnExists('contacts', 'iban', 'TEXT');
  ensureColumnExists('contacts', 'upi_id', 'TEXT');
  ensureColumnExists('contacts', 'preferred_payment_method', "TEXT DEFAULT 'bank_transfer'");
  ensureColumnExists('contacts', 'payment_terms_days', 'INTEGER DEFAULT 0');
  ensureColumnExists('contacts', 'bank_address', 'TEXT');
}

function ensureUserSchema() {
  ensureColumnExists('users', 'module_access', 'TEXT');
  ensureColumnExists('users', 'created_by_user_id', 'TEXT');
  ensureColumnExists('users', 'password_reset_email', 'TEXT');
  ensureColumnExists('users', 'is_hidden', 'INTEGER DEFAULT 0');
  ensureColumnExists('users', 'is_protected', 'INTEGER DEFAULT 0');
  ensureColumnExists('notifications', 'assigned_to', 'TEXT');
}

function initAccountingDatabase(folderPath = getAccountingDatabaseFolder()) {
  try {
    const Database = require('better-sqlite3');
    const dbFolder = saveAccountingDatabaseFolder(folderPath);

    closeAccountingDatabaseConnection();
    ensureDirectory(dbFolder);

    const accountingDbPath = migrateLegacyDbFiles(dbFolder, ACCOUNTING_DB_FILE_NAME, LEGACY_ACCOUNTING_DB_FILE_NAME);

    accountingDb = new Database(accountingDbPath);
    accountingDb.pragma('journal_mode = WAL');
    accountingDb.pragma('foreign_keys = ON');

    createAccountingTables();
    insertAccountingDefaultData();

    currentAccountingDbPath = accountingDbPath;
    console.log('Accounting database initialized at:', accountingDbPath);
    return accountingDbPath;
  } catch (err) {
    console.error('Accounting database init error:', err);
    return null;
  }
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      full_name TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      role_name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      category_id TEXT,
      description TEXT,
      unit TEXT DEFAULT 'PCS',
      hsn_code TEXT,
      gst_rate REAL DEFAULT 18,
      selling_price REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      image_path TEXT,
      specifications TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      reserved_qty REAL DEFAULT 0,
      location TEXT,
      last_updated TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'customer',
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      gst_number TEXT,
      pan_number TEXT,
      credit_limit REAL DEFAULT 0,
      account_holder_name TEXT,
      bank_name TEXT,
      branch_name TEXT,
      account_number TEXT,
      account_type TEXT DEFAULT 'current',
      ifsc_code TEXT,
      swift_code TEXT,
      iban TEXT,
      upi_id TEXT,
      preferred_payment_method TEXT DEFAULT 'bank_transfer',
      payment_terms_days INTEGER DEFAULT 0,
      bank_address TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_employees (
      id TEXT PRIMARY KEY,
      employee_code TEXT UNIQUE NOT NULL,
      user_id TEXT,
      full_name TEXT NOT NULL,
      work_email TEXT,
      personal_email TEXT,
      phone TEXT,
      department TEXT,
      designation TEXT,
      employment_type TEXT DEFAULT 'full_time',
      joining_date TEXT,
      reporting_manager_id TEXT,
      work_location TEXT,
      shift_name TEXT,
      status TEXT DEFAULT 'active',
      basic_salary REAL DEFAULT 0,
      hra_amount REAL DEFAULT 0,
      allowance_amount REAL DEFAULT 0,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      pf_number TEXT,
      esi_number TEXT,
      pan_number TEXT,
      aadhaar_number TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      leave_balance REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reporting_manager_id) REFERENCES hr_employees(id)
    );

    CREATE TABLE IF NOT EXISTS hr_attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      attendance_date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT DEFAULT 'present',
      work_mode TEXT DEFAULT 'onsite',
      hours_worked REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, attendance_date)
    );

    CREATE TABLE IF NOT EXISTS hr_leave_requests (
      id TEXT PRIMARY KEY,
      leave_number TEXT UNIQUE NOT NULL,
      employee_id TEXT NOT NULL,
      leave_type TEXT DEFAULT 'casual',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days REAL DEFAULT 1,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      comments TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS hr_attendance_regularizations (
      id TEXT PRIMARY KEY,
      request_number TEXT UNIQUE NOT NULL,
      employee_id TEXT NOT NULL,
      attendance_date TEXT NOT NULL,
      requested_check_in TEXT,
      requested_check_out TEXT,
      requested_status TEXT DEFAULT 'present',
      reason TEXT,
      comments TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS hr_payroll_runs (
      id TEXT PRIMARY KEY,
      payroll_number TEXT UNIQUE NOT NULL,
      employee_id TEXT NOT NULL,
      payroll_month INTEGER NOT NULL,
      payroll_year INTEGER NOT NULL,
      basic_amount REAL DEFAULT 0,
      hra_amount REAL DEFAULT 0,
      allowance_amount REAL DEFAULT 0,
      bonus_amount REAL DEFAULT 0,
      deduction_amount REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'draft',
      payment_date TEXT,
      posted_to_accounting INTEGER DEFAULT 0,
      accounting_journal_id TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hr_employee_documents (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      document_type TEXT DEFAULT 'Other',
      document_title TEXT NOT NULL,
      document_url TEXT NOT NULL,
      issued_on TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quotation_number TEXT UNIQUE,
      customer_id TEXT,
      status TEXT DEFAULT 'draft',
      valid_till TEXT,
      discount_percent REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      subject TEXT,
      mail_draft TEXT,
      notes TEXT,
      terms TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      product_id TEXT,
      description TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      total REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bom (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_id TEXT,
      version TEXT DEFAULT '1.0',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS bom_items (
      id TEXT PRIMARY KEY,
      bom_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT,
      notes TEXT,
      FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE,
      vendor_id TEXT,
      status TEXT DEFAULT 'pending',
      order_date TEXT DEFAULT (date('now')),
      expected_date TEXT,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL,
      product_id TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grn (
      id TEXT PRIMARY KEY,
      grn_number TEXT UNIQUE,
      po_id TEXT,
      vendor_id TEXT,
      received_date TEXT DEFAULT (date('now')),
      invoice_number TEXT,
      invoice_date TEXT,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    );

    CREATE TABLE IF NOT EXISTS grn_items (
      id TEXT PRIMARY KEY,
      grn_id TEXT NOT NULL,
      product_id TEXT,
      ordered_qty REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (grn_id) REFERENCES grn(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE,
      customer_id TEXT,
      quotation_id TEXT,
      status TEXT DEFAULT 'pending',
      order_date TEXT DEFAULT (date('now')),
      delivery_date TEXT,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT,
      description TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS proforma_invoices (
      id TEXT PRIMARY KEY,
      proforma_number TEXT UNIQUE,
      customer_id TEXT,
      source_order_id TEXT,
      sender_type TEXT DEFAULT 'company',
      sender_id TEXT,
      sender_name TEXT,
      sender_email TEXT,
      issue_date TEXT DEFAULT (date('now')),
      valid_till TEXT,
      status TEXT DEFAULT 'draft',
      subject TEXT,
      mail_draft TEXT,
      notes TEXT,
      terms TEXT,
      subtotal_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES contacts(id),
      FOREIGN KEY (source_order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS proforma_invoice_items (
      id TEXT PRIMARY KEY,
      proforma_invoice_id TEXT NOT NULL,
      product_id TEXT,
      description TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      total REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (proforma_invoice_id) REFERENCES proforma_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      price REAL NOT NULL,
      price_type TEXT DEFAULT 'cost',
      changed_by TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      reference_id TEXT,
      reference_type TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS license_activation_logs (
      id TEXT PRIMARY KEY,
      activated_at TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL, -- success | failed
      reason TEXT,
      license_id TEXT,
      customer TEXT,
      plan TEXT,
      valid_until TEXT,
      machine_id TEXT,
      company_name TEXT,
      company_email TEXT,
      company_phone TEXT,
      company_gst TEXT,
      company_address TEXT,
      key_fingerprint TEXT
    );

    -- CRM Module Tables
    CREATE TABLE IF NOT EXISTS crm_inquiries (
      id TEXT PRIMARY KEY,
      inquiry_number TEXT UNIQUE,
      source TEXT DEFAULT 'manual', -- indiamart, manual, website
      customer_name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      product_interest TEXT,
      quantity REAL,
      requirements TEXT,
      status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
      priority TEXT DEFAULT 'medium', -- low, medium, high
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_leads (
      id TEXT PRIMARY KEY,
      lead_number TEXT UNIQUE,
      inquiry_id TEXT,
      customer_id TEXT,
      status TEXT DEFAULT 'new', -- new, contacted, qualified, proposal, negotiation, closed_won, closed_lost
      value REAL DEFAULT 0,
      probability INTEGER DEFAULT 0, -- 0-100
      expected_close_date TEXT,
      industry TEXT,
      lead_source TEXT,
      notes TEXT,
      assigned_to TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inquiry_id) REFERENCES crm_inquiries(id),
      FOREIGN KEY (customer_id) REFERENCES contacts(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_followups (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      followup_type TEXT NOT NULL, -- call, email, meeting, demo, site_visit
      scheduled_date TEXT NOT NULL,
      actual_date TEXT,
      duration INTEGER, -- minutes
      notes TEXT,
      outcome TEXT, -- interested, not_interested, follow_up_needed, meeting_scheduled
      next_followup_date TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_quotations (
      id TEXT PRIMARY KEY,
      quotation_number TEXT UNIQUE,
      lead_id TEXT NOT NULL,
      customer_id TEXT,
      revision_number INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft', -- draft, sent, revised, approved, rejected, expired
      valid_till TEXT,
      discount_percent REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      terms TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
      FOREIGN KEY (customer_id) REFERENCES contacts(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_quotation_items (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      product_id TEXT,
      description TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      total REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES crm_quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS crm_quotation_revisions (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      changes TEXT,
      revised_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (quotation_id) REFERENCES crm_quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (revised_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- followup, quotation_expiry, lead_review, custom
      title TEXT NOT NULL,
      message TEXT,
      scheduled_date TEXT,
      is_active INTEGER DEFAULT 1,
      is_completed INTEGER DEFAULT 0,
      lead_id TEXT,
      followup_id TEXT,
      quotation_id TEXT,
      priority TEXT DEFAULT 'medium', -- low, medium, high
      assigned_to TEXT,
      created_by TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
      FOREIGN KEY (followup_id) REFERENCES crm_followups(id),
      FOREIGN KEY (quotation_id) REFERENCES crm_quotations(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      inquiry_id TEXT,
      activity_type TEXT NOT NULL, -- created, updated, followup, quotation_sent, etc.
      description TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
      FOREIGN KEY (inquiry_id) REFERENCES crm_inquiries(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crm_indiamart_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      api_key TEXT,
      api_secret TEXT,
      is_active INTEGER DEFAULT 0,
      last_sync TEXT,
      sync_interval INTEGER DEFAULT 15, -- minutes
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function insertDefaultData() {
  const { v4: uuidv4 } = require('uuid');
  const roleStmt = db.prepare(`
    INSERT OR IGNORE INTO user_roles (id, role_name, description, is_system, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  [
    ['admin', 'Full system access across all ERP modules', 1],
    ['developer', 'Protected system owner with hidden access management rights', 1],
    ['manager', 'Team supervision with approvals and broad module access', 1],
    ['operator', 'Daily operational access based on assigned modules', 1],
    ['user', 'Standard user access based on assigned modules', 1]
  ].forEach(([roleName, description, isSystem]) => {
    roleStmt.run(uuidv4(), roleName, description, isSystem);
  });

  db.prepare("SELECT DISTINCT role FROM users WHERE role IS NOT NULL AND TRIM(role) <> ''").all().forEach((row) => {
    roleStmt.run(uuidv4(), `${row.role}`.trim(), `Imported from existing users (${`${row.role}`.trim()})`, 0);
  });

  const defaultSettings = [
    ['erp_name', DEFAULT_ERP_NAME],
    ['company_name', ''],
    ['company_address', ''],
    ['company_phone', ''],
    ['company_email', ''],
    ['company_gst', ''],
    ['company_logo', '/ownerp-logo.png'],
    ['enabled_modules', JSON.stringify(['dashboard', 'products', 'categories', 'inventory', 'contacts', 'crm', 'hr', 'accounting', 'bom', 'orders', 'inward', 'reports', 'notifications'])],
    ['currency', 'INR'],
    ['currency_symbol', 'Rs.'],
    ['low_stock_threshold', '10'],
    ['work_hours_per_day', '9'],
    ['auto_backup', 'true'],
    ['theme', 'dark']
  ];

  const settingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(([key, value]) => settingStmt.run(key, value));

  const existingDeveloper = db.prepare('SELECT id FROM users WHERE username = ?').get(DEVELOPER_USERNAME);
  if (!existingDeveloper) {
    db.prepare(`
      INSERT INTO users (
        id, username, password, role, full_name, email, password_reset_email,
        is_hidden, is_protected, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1)
    `).run(
      uuidv4(),
      DEVELOPER_USERNAME,
      DEVELOPER_PASSWORD,
      'developer',
      'Developer',
      DEVELOPER_RESET_EMAIL,
      DEVELOPER_RESET_EMAIL
    );
  } else {
    db.prepare(`
      UPDATE users
      SET role = 'developer',
          full_name = 'Developer',
          email = ?,
          password_reset_email = ?,
          is_hidden = 1,
          is_protected = 1,
          is_active = 1
      WHERE username = ?
    `).run(DEVELOPER_RESET_EMAIL, DEVELOPER_RESET_EMAIL, DEVELOPER_USERNAME);
  }
}

function createAccountingTables() {
  accountingDb.exec(`
    CREATE TABLE IF NOT EXISTS accounting_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fiscal_periods (
      id TEXT PRIMARY KEY,
      period_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coa_accounts (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      group_name TEXT NOT NULL,
      parent_code TEXT,
      is_system INTEGER DEFAULT 1,
      allow_manual_posting INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      posting_status TEXT DEFAULT 'posted',
      reference_type TEXT,
      reference_id TEXT,
      narration TEXT,
      source_module TEXT,
      auto_posted INTEGER DEFAULT 0,
      created_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id TEXT PRIMARY KEY,
      journal_id TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      account_id TEXT,
      account_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      cost_center TEXT,
      profit_center TEXT,
      branch_name TEXT,
      description TEXT,
      debit_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      FOREIGN KEY (journal_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tax_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      tax_type TEXT NOT NULL,
      rate REAL DEFAULT 0,
      hsn_sac TEXT,
      return_bucket TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_gst TEXT,
      source_order_id TEXT,
      source_module TEXT DEFAULT 'sales',
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'open',
      place_of_supply TEXT,
      supply_type TEXT DEFAULT 'intra-state',
      subtotal_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      outstanding_amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales_invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      hsn_sac TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT,
      rate REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      gst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      line_total REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_bills (
      id TEXT PRIMARY KEY,
      bill_number TEXT UNIQUE NOT NULL,
      vendor_id TEXT,
      vendor_name TEXT NOT NULL,
      vendor_gst TEXT,
      source_grn_id TEXT,
      source_module TEXT DEFAULT 'purchase',
      bill_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'open',
      place_of_supply TEXT,
      supply_type TEXT DEFAULT 'intra-state',
      subtotal_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      outstanding_amount REAL DEFAULT 0,
      itc_eligible INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      hsn_sac TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT,
      rate REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      gst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      line_total REAL DEFAULT 0,
      FOREIGN KEY (bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      account_number TEXT,
      bank_name TEXT,
      ifsc_code TEXT,
      account_type TEXT DEFAULT 'current',
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_transactions (
      id TEXT PRIMARY KEY,
      bank_account_id TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      transaction_date TEXT NOT NULL,
      description TEXT,
      transaction_type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      payment_mode TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS receipt_vouchers (
      id TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      bank_account_id TEXT,
      receipt_date TEXT NOT NULL,
      amount REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'bank_transfer',
      reference_number TEXT,
      narration TEXT,
      status TEXT DEFAULT 'posted',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS receipt_voucher_allocations (
      id TEXT PRIMARY KEY,
      receipt_voucher_id TEXT NOT NULL,
      sales_invoice_id TEXT NOT NULL,
      invoice_number TEXT,
      allocated_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (receipt_voucher_id) REFERENCES receipt_vouchers(id) ON DELETE CASCADE,
      FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_vouchers (
      id TEXT PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      vendor_id TEXT,
      vendor_name TEXT NOT NULL,
      bank_account_id TEXT,
      payment_date TEXT NOT NULL,
      amount REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'bank_transfer',
      reference_number TEXT,
      narration TEXT,
      status TEXT DEFAULT 'posted',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS payment_voucher_allocations (
      id TEXT PRIMARY KEY,
      payment_voucher_id TEXT NOT NULL,
      purchase_bill_id TEXT NOT NULL,
      bill_number TEXT,
      allocated_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (payment_voucher_id) REFERENCES payment_vouchers(id) ON DELETE CASCADE,
      FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bank_reconciliation_lines (
      id TEXT PRIMARY KEY,
      bank_account_id TEXT NOT NULL,
      statement_date TEXT NOT NULL,
      reference_number TEXT,
      description TEXT,
      entry_type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      bank_transaction_id TEXT,
      status TEXT DEFAULT 'unmatched',
      notes TEXT,
      matched_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
      FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id)
    );

    CREATE TABLE IF NOT EXISTS party_followups (
      id TEXT PRIMARY KEY,
      party_type TEXT NOT NULL,
      party_id TEXT NOT NULL,
      party_name TEXT NOT NULL,
      document_type TEXT,
      document_id TEXT,
      document_number TEXT,
      followup_type TEXT NOT NULL,
      subject TEXT,
      notes TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'open',
      assigned_to TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS document_dispatch_logs (
      id TEXT PRIMARY KEY,
      document_type TEXT NOT NULL,
      document_id TEXT,
      document_number TEXT,
      recipient_email TEXT NOT NULL,
      sender_email TEXT,
      channel TEXT DEFAULT 'email',
      status TEXT DEFAULT 'queued',
      subject TEXT,
      error_message TEXT,
      sent_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fixed_assets (
      id TEXT PRIMARY KEY,
      asset_code TEXT UNIQUE NOT NULL,
      asset_name TEXT NOT NULL,
      category TEXT,
      capitalization_date TEXT NOT NULL,
      gross_value REAL DEFAULT 0,
      salvage_value REAL DEFAULT 0,
      useful_life_months INTEGER DEFAULT 60,
      depreciation_method TEXT DEFAULT 'SLM',
      accumulated_depreciation REAL DEFAULT 0,
      carrying_value REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      linked_purchase_bill_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounting_vouchers (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_label TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      party_type TEXT,
      party_id TEXT,
      party_name TEXT,
      status TEXT DEFAULT 'posted',
      reference_number TEXT,
      narration TEXT,
      from_account_id TEXT,
      from_account_name TEXT,
      to_account_id TEXT,
      to_account_name TEXT,
      related_reference_type TEXT,
      related_reference_id TEXT,
      total_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      metadata_json TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounting_voucher_items (
      id TEXT PRIMARY KEY,
      voucher_id TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      product_id TEXT,
      product_name TEXT,
      description TEXT,
      quantity REAL DEFAULT 0,
      unit TEXT,
      rate REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      line_total REAL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (voucher_id) REFERENCES accounting_vouchers(id) ON DELETE CASCADE
    );
  `);
}

function insertAccountingDefaultData() {
  const existingSettings = accountingDb.prepare('SELECT key FROM accounting_settings WHERE key = ?').get('default_currency');

  const { v4: uuidv4 } = require('uuid');
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const nextYear = currentYear + 1;

  const defaultSettings = [
    ['default_currency', 'INR'],
    ['default_currency_symbol', 'Rs.'],
    ['financial_year_label', `${currentYear}-${nextYear}`],
    ['financial_year_start', `${currentYear}-04-01`],
    ['financial_year_end', `${nextYear}-03-31`],
    ['default_company_state', 'Gujarat'],
    ['gst_return_frequency', 'monthly'],
    ['sales_invoice_prefix', 'INV'],
    ['purchase_bill_prefix', 'BILL'],
    ['receipt_prefix', 'RCPT'],
    ['payment_prefix', 'PAY'],
    ['journal_prefix', 'JV'],
    ['smtp_host', ''],
    ['smtp_port', '587'],
    ['smtp_secure', 'false'],
    ['smtp_user', ''],
    ['smtp_pass', ''],
    ['smtp_from_email', ''],
    ['smtp_from_name', ''],
    ['advisor_mode', 'conservative-compliance'],
    ['auto_posting_enabled', 'true']
  ];

  const fiscalPeriods = [
    [uuidv4(), `FY ${currentYear}-${nextYear}`, `${currentYear}-04-01`, `${nextYear}-03-31`, 'open']
  ];

  const coaAccounts = [
    ['1000', 'Cash in Hand', 'asset', 'cash-bank'],
    ['1010', 'Main Current Account', 'asset', 'cash-bank'],
    ['1100', 'Accounts Receivable', 'asset', 'receivable'],
    ['1200', 'Input CGST', 'asset', 'gst-input'],
    ['1210', 'Input SGST', 'asset', 'gst-input'],
    ['1220', 'Input IGST', 'asset', 'gst-input'],
    ['1300', 'Inventory', 'asset', 'inventory'],
    ['1500', 'Fixed Assets', 'asset', 'fixed-assets'],
    ['2000', 'Accounts Payable', 'liability', 'payable'],
    ['2100', 'Output CGST', 'liability', 'gst-output'],
    ['2110', 'Output SGST', 'liability', 'gst-output'],
    ['2120', 'Output IGST', 'liability', 'gst-output'],
    ['2200', 'GST Payable', 'liability', 'gst-settlement'],
    ['2300', 'TDS Payable', 'liability', 'statutory'],
    ['2310', 'Payroll Payable', 'liability', 'payroll'],
    ['2320', 'Payroll Deductions Payable', 'liability', 'payroll'],
    ['3000', 'Capital', 'equity', 'equity'],
    ['4000', 'Sales Revenue', 'income', 'operating-income'],
    ['4010', 'Service Revenue', 'income', 'operating-income'],
    ['5000', 'Cost of Goods Sold', 'expense', 'direct-expense'],
    ['5100', 'Purchase Expense', 'expense', 'direct-expense'],
    ['5200', 'Payroll Expense', 'expense', 'operating-expense'],
    ['5300', 'Administrative Expense', 'expense', 'operating-expense'],
    ['5400', 'Depreciation Expense', 'expense', 'operating-expense']
  ];

  const taxCodes = [
    ['GST0', 'GST Nil Rated', 'gst', 0, '', 'GSTR-1'],
    ['GST5', 'GST 5%', 'gst', 5, '', 'GSTR-1'],
    ['GST12', 'GST 12%', 'gst', 12, '', 'GSTR-1'],
    ['GST18', 'GST 18%', 'gst', 18, '', 'GSTR-1'],
    ['GST28', 'GST 28%', 'gst', 28, '', 'GSTR-1'],
    ['GST40', 'GST 40%', 'gst', 40, '', 'GSTR-1'],
    ['EXPORT0', 'Export / Zero Rated', 'gst', 0, '', 'GSTR-1'],
    ['RCM', 'Reverse Charge', 'gst', 18, '', 'GSTR-3B']
  ];

  const bankAccounts = [
    [uuidv4(), 'Main Current Account', '0000000000', 'Your Bank', 'IFSC0000001', 'current', 0, 0],
    [uuidv4(), 'Cash in Hand', '', 'Cash', '', 'cash', 0, 0]
  ];

  if (!existingSettings) {
    const settingsStmt = accountingDb.prepare(
      'INSERT OR IGNORE INTO accounting_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
    );
    defaultSettings.forEach(([key, value]) => settingsStmt.run(key, value));

    const periodStmt = accountingDb.prepare(
      'INSERT OR IGNORE INTO fiscal_periods (id, period_name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)'
    );
    fiscalPeriods.forEach(period => periodStmt.run(...period));

    const bankStmt = accountingDb.prepare(
      'INSERT OR IGNORE INTO bank_accounts (id, account_name, account_number, bank_name, ifsc_code, account_type, opening_balance, current_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    bankAccounts.forEach(account => bankStmt.run(...account));
  }

  const accountStmt = accountingDb.prepare(
    'INSERT OR IGNORE INTO coa_accounts (id, code, name, account_type, group_name) VALUES (?, ?, ?, ?, ?)'
  );
  coaAccounts.forEach(([code, name, accountType, groupName]) => {
    accountStmt.run(uuidv4(), code, name, accountType, groupName);
  });

  const taxStmt = accountingDb.prepare(
    'INSERT OR IGNORE INTO tax_codes (id, code, label, tax_type, rate, hsn_sac, return_bucket) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  taxCodes.forEach(([code, label, taxType, rate, hsnSac, returnBucket]) => {
    taxStmt.run(uuidv4(), code, label, taxType, rate, hsnSac, returnBucket);
  });

}

// IPC Handlers
ipcMain.handle('db-query', (event, { sql, params, method }) => {
  try {
    const stmt = db.prepare(sql);
    if (method === 'run') return stmt.run(...(params || []));
    if (method === 'get') return stmt.get(...(params || []));
    return stmt.all(...(params || []));
  } catch (err) {
    console.error('DB Error:', err.message, sql);
    throw err;
  }
});

ipcMain.handle('accounting-query', (event, { sql, params, method }) => {
  try {
    const stmt = accountingDb.prepare(sql);
    if (method === 'run') return stmt.run(...(params || []));
    if (method === 'get') return stmt.get(...(params || []));
    return stmt.all(...(params || []));
  } catch (err) {
    console.error('Accounting DB Error:', err.message, sql);
    throw err;
  }
});

ipcMain.handle('get-app-path', () => app.getPath('userData'));
ipcMain.handle('get-database-info', () => getDatabaseInfo());
ipcMain.handle('get-accounting-database-info', () => getAccountingDatabaseInfo());
ipcMain.handle('get-hr-connect-status', () => getHrConnectStatus());
ipcMain.handle('set-window-title', (event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(`${`${title || ''}`.trim() || DEFAULT_ERP_NAME}`);
  }
});

ipcMain.handle('send-document-email', async (event, payload) => {
  try {
    const nodemailer = require('nodemailer');
    const transport = payload?.transport || {};
    const smtpHost = `${transport.host || ''}`.trim();
    const smtpPort = Number(transport.port || 587);
    const smtpUser = `${transport.user || ''}`.trim();
    const smtpPass = `${transport.pass || ''}`;
    const fromEmail = `${payload?.fromEmail || transport.fromEmail || smtpUser || ''}`.trim();

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      throw new Error('SMTP settings are incomplete. Configure host, port, user, password, and from email.');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: transport.secure === true || `${transport.secure}` === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const attachments = (payload?.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(`${attachment.contentBase64 || ''}`, 'base64'),
      contentType: attachment.contentType || 'application/octet-stream'
    }));

    const info = await transporter.sendMail({
      from: payload?.fromName ? `"${payload.fromName}" <${fromEmail}>` : fromEmail,
      to: payload?.to,
      cc: payload?.cc || undefined,
      bcc: payload?.bcc || undefined,
      subject: payload?.subject || 'Document Dispatch',
      text: payload?.text || '',
      html: payload?.html || undefined,
      attachments
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted || []
    };
  } catch (err) {
    console.error('Document email dispatch error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('save-file', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('change-database-location', async () => {
  const previousInfo = getDatabaseInfo();
  const selectedFolder = await promptForDatabaseFolder(mainWindow, previousInfo.folderPath);

  if (!selectedFolder) {
    return { success: false, canceled: true };
  }

  if (path.resolve(selectedFolder) === path.resolve(previousInfo.folderPath)) {
    return {
      success: true,
      unchanged: true,
      ...previousInfo,
      message: 'Database location was not changed.'
    };
  }

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes, copy old data', 'No, create new database', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Change Database Location',
    message: 'Do you want to copy the old database to the new location?',
    detail: `Old location:\n${previousInfo.dbPath}\n\nNew location:\n${path.join(selectedFolder, DB_FILE_NAME)}\n\nChoose Yes to keep your existing data, or No to start with a fresh database.`
  });

  if (choice.response === 2) {
    return { success: false, canceled: true };
  }

  const newDbPath = path.join(selectedFolder, DB_FILE_NAME);
  const shouldCopy = choice.response === 0;

  try {
    closeDatabaseConnection();
    ensureDirectory(selectedFolder);
    backupExistingTargetDatabase(newDbPath);

    const copied = shouldCopy ? copyDatabaseFiles(previousInfo.dbPath, newDbPath) : false;

    saveDatabaseFolder(selectedFolder);
    initDatabase(selectedFolder);

    return {
      success: true,
      copied,
      createdNew: !copied,
      folderPath: selectedFolder,
      dbPath: newDbPath,
      message: copied
        ? 'Old database copied successfully to the new location.'
        : 'A new database has been created at the selected location.'
    };
  } catch (err) {
    console.error('Change database location error:', err);
    saveDatabaseFolder(previousInfo.folderPath);
    initDatabase(previousInfo.folderPath);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('change-accounting-database-location', async () => {
  const previousInfo = getAccountingDatabaseInfo();
  const selectedFolder = await promptForAccountingDatabaseFolder(mainWindow, previousInfo.folderPath);

  if (!selectedFolder) {
    return { success: false, canceled: true };
  }

  if (path.resolve(selectedFolder) === path.resolve(previousInfo.folderPath)) {
    return {
      success: true,
      unchanged: true,
      ...previousInfo,
      message: 'Accounting database location was not changed.'
    };
  }

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes, copy old data', 'No, create new database', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Change Accounting Database Location',
    message: 'Do you want to copy the old accounting database to the new location?',
    detail: `Old location:\n${previousInfo.dbPath}\n\nNew location:\n${path.join(selectedFolder, ACCOUNTING_DB_FILE_NAME)}\n\nChoose Yes to keep your accounting history, or No to start with a fresh accounting database.`
  });

  if (choice.response === 2) {
    return { success: false, canceled: true };
  }

  const newDbPath = path.join(selectedFolder, ACCOUNTING_DB_FILE_NAME);
  const shouldCopy = choice.response === 0;

  try {
    closeAccountingDatabaseConnection();
    ensureDirectory(selectedFolder);
    backupExistingTargetDatabase(newDbPath);

    const copied = shouldCopy ? copyDatabaseFiles(previousInfo.dbPath, newDbPath) : false;

    saveAccountingDatabaseFolder(selectedFolder);
    initAccountingDatabase(selectedFolder);

    return {
      success: true,
      copied,
      createdNew: !copied,
      folderPath: selectedFolder,
      dbPath: newDbPath,
      message: copied
        ? 'Old accounting database copied successfully to the new location.'
        : 'A new accounting database has been created at the selected location.'
    };
  } catch (err) {
    console.error('Change accounting database location error:', err);
    saveAccountingDatabaseFolder(previousInfo.folderPath);
    initAccountingDatabase(previousInfo.folderPath);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup-database', async () => {
  try {
    const { folderPath, dbPath } = getDatabaseInfo();
    const backupPath = path.join(folderPath, 'backups');

    ensureDirectory(backupPath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupPath, `backup_${timestamp}.db`);

    createBackupFileFromSource(dbPath, backupFile, {
      databaseHandle: db,
      missingMessage: 'Live database file was not found.',
      label: 'ERP'
    });
    return { success: true, path: backupFile };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup-accounting-database', async () => {
  try {
    const { folderPath, dbPath } = getAccountingDatabaseInfo();
    const backupPath = path.join(folderPath, 'backups');

    ensureDirectory(backupPath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupPath, `accounting_backup_${timestamp}.db`);

    createBackupFileFromSource(dbPath, backupFile, {
      databaseHandle: accountingDb,
      missingMessage: 'Live accounting database file was not found.',
      label: 'Accounting'
    });
    return { success: true, path: backupFile };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-update-status', async () => {
  try {
    configureAutoUpdater();
    return { success: true, ...updateState };
  } catch (err) {
    return { success: false, error: err.message, ...updateState };
  }
});

ipcMain.handle('refresh-update-config', async () => {
  try {
    configureAutoUpdater();
    return { success: true, ...updateState };
  } catch (err) {
    return { success: false, error: err.message, ...updateState };
  }
});

ipcMain.handle('check-for-app-updates', async () => {
  try {
    return await checkForAppUpdates();
  } catch (err) {
    return { success: false, error: err.message, ...updateState };
  }
});

ipcMain.handle('download-app-update', async () => {
  try {
    return await downloadAppUpdate();
  } catch (err) {
    return { success: false, error: err.message, ...updateState };
  }
});

ipcMain.handle('install-app-update', async () => {
  try {
    return installDownloadedUpdate();
  } catch (err) {
    upsertSystemNotification(`notif_preupdate_backup_failed_${Date.now()}`, 'error', 'Pre-update backup failed', err.message || 'Backup failed before update install.');
    return { success: false, error: err.message, ...updateState };
  }
});

ipcMain.handle('get-google-drive-status', async () => {
  try {
    return { success: true, ...getGoogleDriveStatus() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-google-drive-config', async (event, payload) => {
  try {
    const nextClientId = `${payload?.clientId || ''}`.trim();
    const nextClientSecret = `${payload?.clientSecret || ''}`.trim();
    const nextFolderInput = `${payload?.folderInput || ''}`.trim();
    const nextFolderId = parseGoogleDriveFolderId(nextFolderInput);

    if (nextFolderInput && !nextFolderId) {
      throw new Error('Enter a valid Google Drive folder URL or folder ID.');
    }

    const currentConfig = getGoogleDriveStoreConfig();
    const credentialsChanged =
      currentConfig.clientId !== nextClientId ||
      currentConfig.clientSecret !== nextClientSecret;

    const savedConfig = saveGoogleDriveStoreConfig({
      clientId: nextClientId,
      clientSecret: nextClientSecret,
      folderInput: nextFolderInput,
      folderId: nextFolderId,
      refreshToken: credentialsChanged ? '' : currentConfig.refreshToken,
      email: credentialsChanged ? '' : currentConfig.email
    });

    return {
      success: true,
      ...getGoogleDriveStatus(),
      configuredData: {
        clientId: savedConfig.clientId,
        clientSecret: savedConfig.clientSecret,
        folderInput: savedConfig.folderInput,
        folderId: savedConfig.folderId
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('connect-google-drive', async () => {
  try {
    const status = await openGoogleOAuthFlow();
    return { success: true, ...status };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disconnect-google-drive', async () => {
  try {
    clearGoogleDriveTokens();
    return { success: true, ...getGoogleDriveStatus() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('refresh-auto-backup', async () => {
  try {
    startAutoBackupScheduler();
    return { success: true, ...getCloudBackupSettings() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('run-cloud-backup', async () => {
  try {
    return runConfiguredCloudBackup({ reason: 'manual' });
  } catch (err) {
    setSettingValue('cloud_backup_last_error', err.message || 'Backup failed.');
    return { success: false, error: err.message };
  }
});

ipcMain.handle('restore-database-backup', async () => {
  try {
    const config = getCloudBackupSettings();
    const lastBackupPath = `${config.lastFile || ''}`
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
    const defaultPath = lastBackupPath && !isWebUrlPath(lastBackupPath)
      ? path.dirname(lastBackupPath)
      : (config.destination || getDatabaseFolder());

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Database Backup File',
      defaultPath,
      buttonLabel: 'Restore Backup',
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    return restoreDatabaseFromBackupFile(result.filePaths[0]);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-excel', async (event, { data, fileName }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: fileName,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!result.canceled) {
      fs.writeFileSync(result.filePath, Buffer.from(data));
      return { success: true, path: result.filePath };
    }
    return { success: false, canceled: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  await ensureDatabaseLocationConfigured();
  ensureAccountingDatabaseLocationConfigured();
  initDatabase();
  initAccountingDatabase();
  startHrConnectServer();
  attachAutoUpdaterListeners();
  configureAutoUpdater();
  startAutoBackupScheduler();
  createWindow();
  if (app.isPackaged && getRuntimeUpdateConfig().enabled && getRuntimeUpdateConfig().configured) {
    setTimeout(() => {
      checkForAppUpdates().catch((err) => {
        console.error('Background update check failed:', err);
      });
    }, 8000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopAutoBackupScheduler();
    stopHrConnectServer();
    closeDatabaseConnection();
    closeAccountingDatabaseConnection();
    app.quit();
  }
});
