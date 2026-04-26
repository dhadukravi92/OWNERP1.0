export const DEFAULT_ERP_NAME = 'OWNERP';
export const DEFAULT_COMPANY_LOGO = '/ownerp-logo.png';

function cleanValue(value) {
  return `${value || ''}`.trim();
}

function isLegacyErpName(value) {
  const normalized = cleanValue(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return normalized === 'ucserp' || normalized === 'panelerp';
}

function isAbsoluteFilePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('/');
}

function toFileUrl(value) {
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('//')) {
    return `file:${encodeURI(normalized)}`;
  }
  return `file:///${encodeURI(normalized.replace(/^\/+/, ''))}`;
}

function resolvePublicAssetUrl(value) {
  const normalized = cleanValue(value).replace(/^\/+/, '');
  if (!normalized) return '';

  const publicBase = cleanValue(process.env.PUBLIC_URL).replace(/[\\/]+$/, '');
  if (publicBase === '.') return `./${normalized}`;
  if (publicBase) return `${publicBase}/${normalized}`;

  if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
    return `./${normalized}`;
  }

  return `/${normalized}`;
}

export function getErpName(settings = {}) {
  const erpName = cleanValue(settings.erp_name);
  if (!erpName || isLegacyErpName(erpName)) {
    return DEFAULT_ERP_NAME;
  }
  return erpName;
}

export function getErpNameParts(settings = {}) {
  const erpName = getErpName(settings);

  if (erpName.length > 3 && erpName.toUpperCase().endsWith('ERP')) {
    return {
      primary: erpName.slice(0, -3),
      accent: erpName.slice(-3)
    };
  }

  return {
    primary: erpName,
    accent: ''
  };
}

export function getCompanyLogoUrl(settings = {}) {
  const value = cleanValue(settings.company_logo);
  if (!value) return resolvePublicAssetUrl(DEFAULT_COMPANY_LOGO);
  if (/^(https?:|data:|blob:|file:)/i.test(value)) return value;
  if (isAbsoluteFilePath(value)) return toFileUrl(value);
  return resolvePublicAssetUrl(value);
}

export function getAppBrandLogoUrl() {
  return resolvePublicAssetUrl(DEFAULT_COMPANY_LOGO);
}
