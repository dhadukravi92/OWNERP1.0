import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import db, { generateId } from '../utils/database';
import { getErpName } from '../utils/branding';
import {
  Save,
  Database,
  Shield,
  Download,
  Plus,
  Trash2,
  User,
  X,
  SlidersHorizontal,
  Building2,
  Check,
  RefreshCw
} from 'lucide-react';
import {
  canAccessSettings,
  getDelegatableModuleIds,
  getAccessibleModules,
  getConfigurableModules,
  getDefaultMainMenuShortcuts,
  getEnabledModuleIds,
  findDuplicateMainMenuShortcutTokens,
  isAdminUser,
  isDeveloperUser,
  formatMainMenuShortcut,
  getMainMenuShortcutMap,
  MODULE_DEFINITIONS,
  getUserAssignedModuleIds,
  normalizeMainMenuShortcutToken,
  serializeModuleIds,
  serializeMainMenuShortcuts,
  summarizeModuleAccess
} from '../utils/modules';

function looksLikeWebUrl(value) {
  return /^https?:\/\//i.test(`${value || ''}`.trim());
}

function parseGoogleDriveFolderId(value) {
  const trimmed = `${value || ''}`.trim();
  if (!trimmed) return '';

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch?.[1]) return folderMatch[1];

  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch?.[1]) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return '';
}

function getRoleBadgeClass(role) {
  const normalized = `${role || ''}`.trim().toLowerCase();
  if (normalized === 'developer') return 'badge-success';
  if (normalized === 'admin') return 'badge-danger';
  if (normalized === 'manager') return 'badge-warning';
  return 'badge-secondary';
}

function UserModal({ user, enabledModuleIds, roleOptions, currentUser, onClose, onSave, onCreateRole }) {
  const configurableModules = getConfigurableModules();
  const isProtectedUser = Boolean(user?.is_protected);
  const currentUserIsDeveloper = isDeveloperUser(currentUser);
  const assignableModules = useMemo(() => {
    if (currentUserIsDeveloper) return enabledModuleIds;
    return getDelegatableModuleIds(currentUser, { enabled_modules: serializeModuleIds(enabledModuleIds) });
  }, [currentUser, currentUserIsDeveloper, enabledModuleIds]);
  const [showRoleCreator, setShowRoleCreator] = useState(false);
  const [newRole, setNewRole] = useState({ role_name: '', description: '' });
  const [form, setForm] = useState({
    username: user?.username || '',
    password: '',
    role: user?.role || 'operator',
    full_name: user?.full_name || '',
    email: user?.email || '',
    module_access: isDeveloperUser(user)
      ? enabledModuleIds
      : getUserAssignedModuleIds(user, { enabled_modules: serializeModuleIds(enabledModuleIds) }).filter((moduleId) => assignableModules.includes(moduleId))
  });

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const sortedRoleOptions = useMemo(() => {
    const fallbackRoles = currentUserIsDeveloper ? ['admin', 'manager', 'operator', 'user'] : ['manager', 'operator', 'user'];
    const merged = new Set([
      ...fallbackRoles,
      ...roleOptions
        .map((entry) => `${entry.role_name || ''}`.trim())
        .filter((roleName) => {
          if (!roleName) return false;
          if (currentUserIsDeveloper) return true;
          return !['developer', 'admin'].includes(roleName.toLowerCase());
        }),
      `${form.role || ''}`.trim()
    ]);

    return Array.from(merged).filter(Boolean).sort((a, b) => {
      const order = ['developer', 'admin', 'manager', 'operator', 'user'];
      const aIndex = order.indexOf(a.toLowerCase());
      const bIndex = order.indexOf(b.toLowerCase());
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });
  }, [currentUserIsDeveloper, form.role, roleOptions]);

  useEffect(() => {
    setForm((prev) => {
      if (isDeveloperUser({ role: prev.role })) {
        return { ...prev, module_access: enabledModuleIds };
      }

      return {
        ...prev,
        module_access: prev.module_access.filter((moduleId) => enabledModuleIds.includes(moduleId) && assignableModules.includes(moduleId))
      };
    });
  }, [form.role, enabledModuleIds, assignableModules]);

  const toggleModule = (moduleId) => {
    setForm((prev) => ({
      ...prev,
      module_access: prev.module_access.includes(moduleId)
        ? prev.module_access.filter((id) => id !== moduleId)
        : [...prev.module_access, moduleId]
    }));
  };

  const handleCreateRole = async () => {
    const roleName = `${newRole.role_name || ''}`.trim();
    if (!roleName) {
      alert('Enter a role name first.');
      return;
    }

    const result = await onCreateRole(roleName, newRole.description);
    if (!result?.success) {
      alert(result?.error || 'Unable to create role.');
      return;
    }

    updateField('role', result.roleName);
    setNewRole({ role_name: '', description: '' });
    setShowRoleCreator(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedRole = `${form.role || ''}`.trim().toLowerCase();
    const sanitizedModuleAccess = normalizedRole === 'developer'
      ? enabledModuleIds
      : form.module_access.filter((moduleId) => assignableModules.includes(moduleId));
    const serializedAccess = normalizedRole === 'developer' ? null : serializeModuleIds(sanitizedModuleAccess);

    if (user?.id) {
      const sql = form.password
        ? 'UPDATE users SET username=?, password=?, role=?, full_name=?, email=?, password_reset_email=?, module_access=? WHERE id=?'
        : 'UPDATE users SET username=?, role=?, full_name=?, email=?, password_reset_email=?, module_access=? WHERE id=?';
      const params = form.password
        ? [form.username, form.password, form.role, form.full_name, form.email, form.email, serializedAccess, user.id]
        : [form.username, form.role, form.full_name, form.email, form.email, serializedAccess, user.id];
      await db.run(sql, params);
    } else {
      await db.run(
        'INSERT INTO users (id, username, password, role, full_name, email, password_reset_email, module_access, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), form.username, form.password, form.role, form.full_name, form.email, form.email, serializedAccess, currentUser?.id || null]
      );
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h3>{user ? 'Edit User Access' : 'Create User'}</h3>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} required readOnly={isProtectedUser} />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-control" value={form.username} onChange={(e) => updateField('username', e.target.value)} required readOnly={isProtectedUser} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{user ? 'New Password' : 'Password'}</label>
                <input type="password" className="form-control" value={form.password} onChange={(e) => updateField('password', e.target.value)} required={!user && !isProtectedUser} readOnly={isProtectedUser} placeholder={isProtectedUser ? 'Reset from login using registered email' : ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
                  <select className="form-control" value={form.role} onChange={(e) => updateField('role', e.target.value)} disabled={isProtectedUser}>
                    {sortedRoleOptions.map((roleName) => (
                      <option key={roleName} value={roleName}>{roleName.charAt(0).toUpperCase() + roleName.slice(1)}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRoleCreator((prev) => !prev)} disabled={isProtectedUser}>
                    <Plus size={14} /> New Role
                  </button>
                </div>
                {showRoleCreator && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'grid', gap: 10 }}>
                    <div className="text-secondary" style={{ fontSize: 12 }}>
                      Create a reusable role like <strong>Senior</strong>, <strong>Team Lead</strong>, or any custom designation.
                    </div>
                    <div className="grid-2">
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Role Name</label>
                        <input
                          className="form-control"
                          value={newRole.role_name}
                          onChange={(e) => setNewRole((prev) => ({ ...prev, role_name: e.target.value }))}
                          placeholder="Senior"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Description</label>
                        <input
                          className="form-control"
                          value={newRole.description}
                          onChange={(e) => setNewRole((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Senior user with custom module access"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowRoleCreator(false)}>Close</button>
                      <button type="button" className="btn btn-primary" onClick={handleCreateRole}>
                        <Save size={14} /> Save Role
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.email} onChange={(e) => updateField('email', e.target.value)} readOnly={isProtectedUser} />
            </div>

            <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Module Access</div>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    {isDeveloperUser({ role: form.role })
                      ? 'Developer keeps protected full access across the ERP.'
                      : isAdminUser({ role: form.role })
                        ? 'Choose the business modules this admin can manage. Settings stays available automatically.'
                        : 'Choose exactly which modules this user can see and open.'}
                  </div>
                </div>
                {!isDeveloperUser({ role: form.role }) && (
                  <span className="badge badge-secondary">{form.module_access.length} selected</span>
                )}
              </div>

              {isDeveloperUser({ role: form.role }) ? (
                <div className="badge badge-success">Developer access is protected and always enabled for all modules.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  {configurableModules.map((module) => {
                    const checked = form.module_access.includes(module.id);
                    const available = enabledModuleIds.includes(module.id) && assignableModules.includes(module.id);
                    return (
                      <button
                        key={module.id}
                        type="button"
                        className="btn"
                        onClick={() => available && !isProtectedUser && toggleModule(module.id)}
                        style={{
                          justifyContent: 'space-between',
                          border: '1px solid var(--border)',
                          background: checked ? 'var(--accent-dim)' : 'var(--bg-card)',
                          color: checked ? 'var(--accent)' : available ? 'var(--text-primary)' : 'var(--text-muted)',
                          opacity: available ? 1 : 0.55,
                          cursor: available && !isProtectedUser ? 'pointer' : 'not-allowed'
                        }}
                        disabled={isProtectedUser}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <module.icon size={14} />
                          {module.label}
                        </span>
                        {checked ? <Check size={14} /> : <span style={{ fontSize: 11 }}>{available ? 'Allow' : 'Not allowed'}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {isProtectedUser && (
              <div className="badge badge-warning" style={{ width: 'fit-content' }}>
                Protected account: username and password can only be recovered through the registered email from the login page.
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Save size={14} /> {user ? 'Update User' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsWorkbench() {
  const { settings, updateSetting, currentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState('company');
  const [form, setForm] = useState({});
  const [googleDriveConfig, setGoogleDriveConfig] = useState({
    clientId: '',
    clientSecret: '',
    folderInput: ''
  });
  const [googleDriveStatus, setGoogleDriveStatus] = useState({
    configured: false,
    connected: false,
    clientId: '',
    clientSecret: '',
    folderId: '',
    folderInput: '',
    email: '',
    tokenStoragePath: ''
  });
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userModal, setUserModal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [moduleSaved, setModuleSaved] = useState(false);
  const [enabledModules, setEnabledModules] = useState(getEnabledModuleIds(settings));
  const [mainMenuShortcuts, setMainMenuShortcuts] = useState(getMainMenuShortcutMap(settings));
  const [dbInfo, setDbInfo] = useState({ folderPath: '', dbPath: '' });
  const [accountingDbInfo, setAccountingDbInfo] = useState({ folderPath: '', dbPath: '' });
  const [updateStatus, setUpdateStatus] = useState({
    available: false,
    downloaded: false,
    checking: false,
    downloading: false,
    enabled: false,
    configured: false,
    version: '1.0.0',
    availableVersion: '',
    downloadedVersion: '',
    progressPercent: 0,
    message: 'Updates are not configured yet.',
    channel: 'latest',
    updateUrl: '',
    lastCheckedAt: '',
    lastDownloadedAt: ''
  });
  const [dbActionLoading, setDbActionLoading] = useState(false);
  const [backupSaved, setBackupSaved] = useState(false);
  const [cloudBackupBusy, setCloudBackupBusy] = useState(false);
  const [googleDriveBusy, setGoogleDriveBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);

  const configurableModules = getConfigurableModules();
  const appName = getErpName(settings);
  const manageableModuleIds = useMemo(() => {
    if (isDeveloperUser(currentUser)) return configurableModules.map((module) => module.id);
    return getDelegatableModuleIds(currentUser, settings).filter((moduleId) =>
      configurableModules.some((module) => module.id === moduleId)
    );
  }, [configurableModules, currentUser, settings]);
  const visibleConfigurableModules = useMemo(
    () => configurableModules.filter((module) => manageableModuleIds.includes(module.id)),
    [configurableModules, manageableModuleIds]
  );
  const visibleShortcutModules = useMemo(
    () => MODULE_DEFINITIONS.filter((module) => module.id === 'settings' || manageableModuleIds.includes(module.id)),
    [manageableModuleIds]
  );
  useEffect(() => {
    setForm({
      company_name: settings.company_name || '',
      company_address: settings.company_address || '',
      company_phone: settings.company_phone || '',
      company_email: settings.company_email || '',
      company_gst: settings.company_gst || '',
      currency_symbol: settings.currency_symbol || '\u20B9',
      low_stock_threshold: settings.low_stock_threshold || '10',
      work_hours_per_day: settings.work_hours_per_day || '9',
      auto_backup: settings.auto_backup || 'true',
      cloud_backup_enabled: settings.cloud_backup_enabled || 'false',
      cloud_backup_provider: settings.cloud_backup_provider || 'local_folder',
      cloud_backup_destination: settings.cloud_backup_destination || '',
      cloud_backup_interval: settings.cloud_backup_interval || 'daily',
      cloud_backup_last_run_at: settings.cloud_backup_last_run_at || '',
      cloud_backup_last_file: settings.cloud_backup_last_file || '',
      cloud_backup_last_error: settings.cloud_backup_last_error || '',
      app_update_enabled: settings.app_update_enabled || 'false',
      app_update_url: settings.app_update_url || '',
      app_update_channel: settings.app_update_channel || 'latest'
    });
    setEnabledModules(getEnabledModuleIds(settings));
    setMainMenuShortcuts(getMainMenuShortcutMap(settings));
    loadUsers();
    loadRoles();
    loadDatabaseInfo();
    loadGoogleDriveStatus();
    loadUpdateStatus();
  }, [settings, currentUser]);

  const moduleStats = useMemo(() => {
    const totalUsers = users.filter((user) => !isAdminUser(user) && !isDeveloperUser(user)).length;
    const totalEnabled = enabledModules.length;
    const restrictedUsers = users.filter((user) => !canAccessSettings(user) && getAccessibleModules(user, settings).length < totalEnabled).length;
    return { totalUsers, totalEnabled, restrictedUsers };
  }, [users, enabledModules, settings]);
  const mainMenuShortcutDuplicates = useMemo(() => {
    const visibleModuleIds = new Set(visibleShortcutModules.map((module) => module.id));
    const duplicates = findDuplicateMainMenuShortcutTokens(mainMenuShortcuts);
    return Object.entries(duplicates).reduce((acc, [token, moduleIds]) => {
      const visibleDuplicates = moduleIds.filter((moduleId) => visibleModuleIds.has(moduleId));
      if (visibleDuplicates.length > 1) {
        acc[token] = visibleDuplicates;
      }
      return acc;
    }, {});
  }, [mainMenuShortcuts, visibleShortcutModules]);
  const hasMainMenuShortcutDuplicates = Object.keys(mainMenuShortcutDuplicates).length > 0;

  const loadUsers = async () => {
    const data = isDeveloperUser(currentUser)
      ? await db.all('SELECT * FROM users WHERE is_active = 1 ORDER BY full_name, username')
      : await db.all(`
          SELECT *
          FROM users
          WHERE is_active = 1
            AND COALESCE(is_hidden, 0) = 0
            AND COALESCE(is_protected, 0) = 0
            AND LOWER(COALESCE(role, '')) <> 'developer'
            AND LOWER(COALESCE(username, '')) <> 'developer'
          ORDER BY full_name, username
        `);
    setUsers(data);
  };

  const loadRoles = async () => {
    try {
      const data = await db.all('SELECT * FROM user_roles ORDER BY is_system DESC, role_name ASC');
      setRoles(data);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setRoles([]);
    }
  };

  const createRole = async (roleName, description = '') => {
    const normalized = `${roleName || ''}`.trim();
    if (!normalized) return { success: false, error: 'Role name is required.' };

    const existing = await db.get(
      'SELECT id, role_name FROM user_roles WHERE LOWER(TRIM(role_name)) = LOWER(TRIM(?))',
      [normalized]
    );

    if (existing) {
      await loadRoles();
      return { success: true, roleName: existing.role_name };
    }

    await db.run(
      'INSERT INTO user_roles (id, role_name, description, is_system, updated_at) VALUES (?, ?, ?, 0, datetime(\'now\'))',
      [generateId(), normalized, `${description || ''}`.trim() || `Custom role: ${normalized}`]
    );

    await loadRoles();
    return { success: true, roleName: normalized };
  };

  const loadDatabaseInfo = async () => {
    if (!window.electronAPI?.getDatabaseInfo) return;

    try {
      const info = await window.electronAPI.getDatabaseInfo();
      if (info) setDbInfo(info);

      if (window.electronAPI?.getAccountingDatabaseInfo) {
        const accountingInfo = await window.electronAPI.getAccountingDatabaseInfo();
        if (accountingInfo) setAccountingDbInfo(accountingInfo);
      }
    } catch (err) {
      console.error('Failed to load database info:', err);
    }
  };

  const loadGoogleDriveStatus = async () => {
    if (!window.electronAPI?.getGoogleDriveStatus) return;

    try {
      const status = await window.electronAPI.getGoogleDriveStatus();
      if (!status?.success) return;

      setGoogleDriveStatus(status);
      setGoogleDriveConfig({
        clientId: status.clientId || '',
        clientSecret: status.clientSecret || '',
        folderInput: status.folderInput || ''
      });
    } catch (err) {
      console.error('Failed to load Google Drive status:', err);
    }
  };

  const loadUpdateStatus = async () => {
    if (!window.electronAPI?.getUpdateStatus) return;

    try {
      const result = await window.electronAPI.getUpdateStatus();
      if (result) {
        setUpdateStatus((prev) => ({ ...prev, ...result }));
      }
    } catch (err) {
      console.error('Failed to load update status:', err);
    }
  };

  useEffect(() => {
    if (!window.electronAPI?.onAppUpdateStatus) return undefined;

    const unsubscribe = window.electronAPI.onAppUpdateStatus((payload) => {
      if (payload) {
        setUpdateStatus((prev) => ({ ...prev, ...payload }));
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const flashSaved = (setter) => {
    setter(true);
    setTimeout(() => setter(false), 2200);
  };

  const handleSaveCompany = async () => {
    for (const [key, val] of Object.entries(form)) {
      await updateSetting(key, val);
    }
    flashSaved(setSaved);
  };

  const handleSaveModules = async () => {
    if (hasMainMenuShortcutDuplicates) {
      alert('Main menu shortcuts contain duplicates. Please make each shortcut unique before saving.');
      return;
    }
    const currentEnabledModules = getEnabledModuleIds(settings);
    const mergedEnabledModules = Array.from(new Set([
      ...currentEnabledModules.filter((moduleId) => !manageableModuleIds.includes(moduleId)),
      ...enabledModules.filter((moduleId) => manageableModuleIds.includes(moduleId))
    ]));
    const currentShortcuts = getMainMenuShortcutMap(settings);
    const mergedShortcuts = {
      ...currentShortcuts,
      ...Object.fromEntries(
        Object.entries(mainMenuShortcuts).filter(([moduleId]) =>
          moduleId === 'settings' || manageableModuleIds.includes(moduleId)
        )
      )
    };

    await updateSetting('enabled_modules', serializeModuleIds(mergedEnabledModules));
    await updateSetting('main_menu_shortcuts', serializeMainMenuShortcuts(mergedShortcuts));
    flashSaved(setModuleSaved);
    await loadUsers();
  };

  const toggleGlobalModule = (moduleId) => {
    if (!manageableModuleIds.includes(moduleId)) return;
    setEnabledModules((prev) => (
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    ));
  };

  const updateMainMenuShortcut = (moduleId, value) => {
    if (moduleId !== 'settings' && !manageableModuleIds.includes(moduleId)) return;
    setMainMenuShortcuts((prev) => ({
      ...prev,
      [moduleId]: normalizeMainMenuShortcutToken(value)
    }));
  };

  const handleBackup = async () => {
    if (!window.electronAPI) {
      alert('Backup is only available in the desktop app.');
      return;
    }

    const result = await window.electronAPI.backupDatabase();
    if (result.success) {
      await loadDatabaseInfo();
      alert(`Backup saved to:\n${result.path}`);
      return;
    }

    alert('Backup failed: ' + result.error);
  };

  const handleAccountingBackup = async () => {
    if (!window.electronAPI?.backupAccountingDatabase) {
      alert('Accounting backup is only available in the desktop app.');
      return;
    }

    const result = await window.electronAPI.backupAccountingDatabase();
    if (result.success) {
      await loadDatabaseInfo();
      alert(`Accounting backup saved to:\n${result.path}`);
      return;
    }

    alert('Accounting backup failed: ' + result.error);
  };

  const handleSelectCloudBackupFolder = async () => {
    if (!window.electronAPI?.selectFile) {
      alert('Folder selection is only available in the desktop app.');
      return;
    }

    const result = await window.electronAPI.selectFile({
      title: 'Select Backup Destination Folder',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result?.canceled || !result?.filePaths?.length) return;

    setForm((prev) => ({
      ...prev,
      cloud_backup_destination: result.filePaths[0]
    }));
  };

  const handleSaveGoogleDriveConfig = async () => {
    if (!window.electronAPI?.saveGoogleDriveConfig) {
      alert('Google Drive setup is only available in the desktop app.');
      return null;
    }

    setGoogleDriveBusy(true);
    try {
      const result = await window.electronAPI.saveGoogleDriveConfig({
        clientId: googleDriveConfig.clientId,
        clientSecret: googleDriveConfig.clientSecret,
        folderInput: googleDriveConfig.folderInput
      });

      if (!result?.success) {
        alert('Could not save Google Drive settings: ' + (result?.error || 'Unknown error'));
        return null;
      }

      setGoogleDriveStatus(result);
      return result;
    } finally {
      setGoogleDriveBusy(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    if (!window.electronAPI?.connectGoogleDrive) {
      alert('Google Drive login is only available in the desktop app.');
      return;
    }

    const savedConfig = await handleSaveGoogleDriveConfig();
    if (!savedConfig?.configured) return;

    setGoogleDriveBusy(true);
    try {
      const result = await window.electronAPI.connectGoogleDrive();
      if (!result?.success) {
        alert('Google Drive connection failed: ' + (result?.error || 'Unknown error'));
        return;
      }

      setGoogleDriveStatus(result);
      alert('Google Drive connected successfully. Scheduled backups can now upload automatically.');
    } finally {
      setGoogleDriveBusy(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    if (!window.electronAPI?.disconnectGoogleDrive) {
      alert('Google Drive login is only available in the desktop app.');
      return;
    }

    setGoogleDriveBusy(true);
    try {
      const result = await window.electronAPI.disconnectGoogleDrive();
      if (!result?.success) {
        alert('Google Drive disconnect failed: ' + (result?.error || 'Unknown error'));
        return;
      }

      setGoogleDriveStatus(result);
      alert('Saved Google Drive login has been removed from this PC.');
    } finally {
      setGoogleDriveBusy(false);
    }
  };

  const handleSaveUpdateSettings = async () => {
    setUpdateBusy(true);
    try {
      await updateSetting('app_update_enabled', form.app_update_enabled || 'false');
      await updateSetting('app_update_url', (form.app_update_url || '').trim());
      await updateSetting('app_update_channel', form.app_update_channel || 'latest');

      if (window.electronAPI?.refreshUpdateConfig) {
        const result = await window.electronAPI.refreshUpdateConfig();
        if (result) {
          setUpdateStatus((prev) => ({ ...prev, ...result }));
        }
      }

      flashSaved(setBackupSaved);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI?.checkForAppUpdates) {
      alert('Software update checks are only available in the desktop app.');
      return;
    }

    setUpdateBusy(true);
    try {
      await handleSaveUpdateSettings();
      const result = await window.electronAPI.checkForAppUpdates();
      if (result) {
        setUpdateStatus((prev) => ({ ...prev, ...result }));
      }

      if (result?.success === false && result?.error) {
        alert('Update check failed: ' + result.error);
      }
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!window.electronAPI?.downloadAppUpdate) {
      alert('Software update download is only available in the desktop app.');
      return;
    }

    setUpdateBusy(true);
    try {
      const result = await window.electronAPI.downloadAppUpdate();
      if (result) {
        setUpdateStatus((prev) => ({ ...prev, ...result }));
      }

      if (result?.success === false && result?.error) {
        alert('Update download failed: ' + result.error);
      }
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.electronAPI?.installAppUpdate) {
      alert('Software update installation is only available in the desktop app.');
      return;
    }

    const confirmed = window.confirm(
      'OWNERP will create a backup of both databases and then restart to install the downloaded update. Continue?'
    );
    if (!confirmed) return;

    setUpdateBusy(true);
    try {
      const result = await window.electronAPI.installAppUpdate();
      if (result) {
        setUpdateStatus((prev) => ({ ...prev, ...result }));
      }

      if (result?.success === false && result?.error) {
        alert('Update installation failed: ' + result.error);
        return;
      }

      if (result?.backupFiles?.length) {
        alert(`Pre-update backup completed:\n${result.backupFiles.join('\n')}\n\nOWNERP will now restart to install the new version.`);
      }
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleSaveCloudBackupSettings = async () => {
    const enabled = form.cloud_backup_enabled === 'true';
    const provider = form.cloud_backup_provider || 'local_folder';
    const destination = (form.cloud_backup_destination || '').trim();

    if (enabled && provider === 'local_folder' && !destination) {
      alert('Please choose a backup destination folder first.');
      return;
    }

    if (enabled && provider === 'local_folder' && looksLikeWebUrl(destination)) {
      alert('Choose a local synced folder on this PC, not a Google Drive web link.');
      return;
    }

    setCloudBackupBusy(true);
    try {
      if (provider === 'google_drive_api') {
        const savedConfig = await handleSaveGoogleDriveConfig();
        if (!savedConfig?.configured) return;
      }

      await updateSetting('cloud_backup_enabled', form.cloud_backup_enabled || 'false');
      await updateSetting('cloud_backup_provider', provider);
      await updateSetting('cloud_backup_destination', destination);
      await updateSetting('cloud_backup_interval', form.cloud_backup_interval || 'daily');

      if (window.electronAPI?.refreshAutoBackup) {
        await window.electronAPI.refreshAutoBackup();
      }

      flashSaved(setBackupSaved);
    } finally {
      setCloudBackupBusy(false);
    }
  };

  const handleRunCloudBackupNow = async () => {
    if (!window.electronAPI?.runCloudBackup) {
      alert('Automatic backup is only available in the desktop app.');
      return;
    }

    const provider = form.cloud_backup_provider || 'local_folder';
    const destination = (form.cloud_backup_destination || '').trim();
    if (form.cloud_backup_enabled !== 'true') {
      alert('Enable automatic backup first.');
      return;
    }

    if (provider === 'local_folder' && !destination) {
      alert('Enable automatic backup and choose a destination folder first.');
      return;
    }

    if (provider === 'local_folder' && looksLikeWebUrl(destination)) {
      alert('Choose a local synced folder on this PC, not a Google Drive web link.');
      return;
    }

    setCloudBackupBusy(true);
    try {
      if (provider === 'google_drive_api') {
        const savedConfig = await handleSaveGoogleDriveConfig();
        if (!savedConfig?.configured) return;
        if (!googleDriveStatus.connected) {
          alert('Connect Google Drive first so the app can save the login token on this PC.');
          return;
        }
      }

      await updateSetting('cloud_backup_enabled', 'true');
      await updateSetting('cloud_backup_provider', provider);
      await updateSetting('cloud_backup_destination', destination);
      await updateSetting('cloud_backup_interval', form.cloud_backup_interval || 'daily');
      if (window.electronAPI?.refreshAutoBackup) {
        await window.electronAPI.refreshAutoBackup();
      }

      const nowIso = new Date().toISOString();
      const result = await window.electronAPI.runCloudBackup();
      if (result.success) {
        await updateSetting('cloud_backup_last_run_at', nowIso);
        await updateSetting('cloud_backup_last_file', result.path);
        await updateSetting('cloud_backup_last_error', '');
        setForm((prev) => ({
          ...prev,
          cloud_backup_last_run_at: nowIso,
          cloud_backup_last_file: result.path,
          cloud_backup_last_error: ''
        }));
        const savedPaths = Array.isArray(result.files) && result.files.length
          ? result.files.join('\n')
          : result.path;
        alert(`Backup saved successfully.\n\nFiles created:\n${savedPaths}`);
        return;
      }

      if (!result.canceled) {
        await updateSetting('cloud_backup_last_error', result.error || 'Backup failed');
        setForm((prev) => ({ ...prev, cloud_backup_last_error: result.error || 'Backup failed' }));
      }

      alert('Automatic backup failed: ' + (result.error || 'Unknown error'));
    } finally {
      setCloudBackupBusy(false);
    }
  };

  const handleRestoreDatabaseBackup = async () => {
    if (!window.electronAPI?.restoreDatabaseBackup) {
      alert('Restore is only available in the desktop app.');
      return;
    }

    const confirmed = window.confirm(
      'This will replace the current live ERP database with the selected backup file. Continue?'
    );

    if (!confirmed) return;

    setCloudBackupBusy(true);
    try {
      const result = await window.electronAPI.restoreDatabaseBackup();
      if (!result || result.canceled) return;

      if (result.success) {
        alert(`Database restored successfully from:\n${result.sourceFile}\n\nThe app will now reload.`);
        window.location.reload();
        return;
      }

      alert('Restore failed: ' + (result.error || 'Unknown error'));
    } finally {
      setCloudBackupBusy(false);
    }
  };

  const handleChangeDatabaseLocation = async () => {
    if (!window.electronAPI?.changeDatabaseLocation) {
      alert('Database location changes are only available in the desktop app.');
      return;
    }

    setDbActionLoading(true);
    try {
      const result = await window.electronAPI.changeDatabaseLocation();
      if (!result || result.canceled) return;

      if (result.success) {
        setDbInfo(result);

        if (result.unchanged) {
          alert(result.message);
          return;
        }

        alert(`${result.message}\n\nNew database path:\n${result.dbPath}\n\n${appName} will now reload so the updated database is used everywhere.`);
        window.location.reload();
        return;
      }

      alert('Could not change database location: ' + (result.error || 'Unknown error'));
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleChangeAccountingDatabaseLocation = async () => {
    if (!window.electronAPI?.changeAccountingDatabaseLocation) {
      alert('Accounting database location changes are only available in the desktop app.');
      return;
    }

    setDbActionLoading(true);
    try {
      const result = await window.electronAPI.changeAccountingDatabaseLocation();
      if (!result || result.canceled) return;

      if (result.success) {
        setAccountingDbInfo(result);
        alert(result.message);
        return;
      }

      alert('Could not change accounting database location: ' + (result.error || 'Unknown error'));
    } finally {
      setDbActionLoading(false);
    }
  };

  const deactivateUser = async (id) => {
    if (id === currentUser?.id) {
      alert('Cannot deactivate your own account.');
      return;
    }

    const targetUser = users.find((entry) => entry.id === id);
    if (targetUser?.is_protected) {
      alert('Protected accounts cannot be deactivated.');
      return;
    }

    if (window.confirm('Deactivate this user?')) {
      await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
      loadUsers();
    }
  };

  const canViewBackupData = isDeveloperUser(currentUser) || isAdminUser(currentUser);
  const tabs = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'modules', label: 'Module Access', icon: SlidersHorizontal },
    { id: 'users', label: 'Users', icon: User },
    ...(canViewBackupData ? [{ id: 'backup', label: 'Backup & Data', icon: Database }] : [])
  ];

  useEffect(() => {
    if (activeTab === 'backup' && !canViewBackupData) {
      setActiveTab('company');
    }
  }, [activeTab, canViewBackupData]);

  const cloudBackupEnabled = form.cloud_backup_enabled === 'true';
  const cloudBackupProvider = form.cloud_backup_provider || 'local_folder';
  const cloudBackupUsesGoogleDriveApi = cloudBackupProvider === 'google_drive_api';
  const cloudBackupDestination = (form.cloud_backup_destination || '').trim();
  const cloudBackupDestinationIsUrl = looksLikeWebUrl(cloudBackupDestination);
  const currentBackupMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const currentMonthlyBackupFolder = !cloudBackupUsesGoogleDriveApi && cloudBackupDestination && !cloudBackupDestinationIsUrl
    ? `${cloudBackupDestination}\\${currentBackupMonth}`
    : '';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Settings</h2>
          <span className="page-subtitle">Admin controls for company setup, module access, users, and data safety</span>
        </div>
      </div>

      <div style={{ padding: '0 24px 12px' }}>
        <div className="tabs" style={{ width: 'fit-content', flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <tab.icon size={13} style={{ marginRight: 6 }} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {activeTab === 'company' && (
          <div style={{ maxWidth: 860 }}>
            <div className="card">
              <div className="card-header">
                <h4>Company Information</h4>
                {saved && <span className="badge badge-success">Saved</span>}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input className="form-control" value={form.company_name || ''} onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <input className="form-control" value={form.company_gst || ''} onChange={(e) => setForm((prev) => ({ ...prev, company_gst: e.target.value }))} placeholder="15-digit GSTIN" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-control" rows={3} value={form.company_address || ''} onChange={(e) => setForm((prev) => ({ ...prev, company_address: e.target.value }))} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={form.company_phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, company_phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={form.company_email || ''} onChange={(e) => setForm((prev) => ({ ...prev, company_email: e.target.value }))} />
                  </div>
                </div>

                <div className="divider" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0 }}>Inventory Preferences</h4>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    Branding is now system-managed, so only operating preferences live here.
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Currency Symbol</label>
                    <select className="form-control" value={form.currency_symbol || '\u20B9'} onChange={(e) => setForm((prev) => ({ ...prev, currency_symbol: e.target.value }))}>
                      <option value="\u20B9">&#8377; (INR)</option>
                      <option value="$">$ (USD)</option>
                      <option value="€">€ (EUR)</option>
                      <option value="£">£ (GBP)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Low Stock Threshold</label>
                    <input type="number" min="0" className="form-control" value={form.low_stock_threshold || '10'} onChange={(e) => setForm((prev) => ({ ...prev, low_stock_threshold: e.target.value }))} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Daily Working Hours</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      className="form-control"
                      value={form.work_hours_per_day || '9'}
                      onChange={(e) => setForm((prev) => ({ ...prev, work_hours_per_day: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Attendance Logic</label>
                    <div className="form-control" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      Present only when worked hours meet the required daily hours.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}><Save size={14} /> Save Company Settings</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'modules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div className="card">
                <div className="card-body" style={{ padding: 18 }}>
                  <div className="text-secondary text-sm">Enabled Modules</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{moduleStats.totalEnabled}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ padding: 18 }}>
                  <div className="text-secondary text-sm">Non-admin Users</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{moduleStats.totalUsers}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ padding: 18 }}>
                  <div className="text-secondary text-sm">Restricted Users</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{moduleStats.restrictedUsers}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4>System Module Switchboard</h4>
                {moduleSaved && <span className="badge badge-success">Saved</span>}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="text-secondary" style={{ fontSize: 13 }}>
                  {isDeveloperUser(currentUser)
                    ? 'Enable the modules your business actually uses. Admins and users can only access modules that are both enabled here and assigned on their profile.'
                    : 'This list only shows the modules Developer delegated to your account. Your changes apply only inside that delegated scope.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {visibleConfigurableModules.map((module) => {
                    const active = enabledModules.includes(module.id);
                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => toggleGlobalModule(module.id)}
                        className="btn"
                        style={{
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                          color: active ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <module.icon size={16} />
                          <span>{module.label}</span>
                        </span>
                        <span className={`badge ${active ? 'badge-success' : 'badge-secondary'}`}>
                          {active ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    );
                  })}
                  {!visibleConfigurableModules.length ? (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: 16,
                        borderRadius: 14,
                        border: '1px dashed var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        fontSize: 13
                      }}
                    >
                      No module management permission is assigned to this login. Ask Developer to delegate module control first.
                    </div>
                  ) : null}
                </div>

                <div className="divider" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Main Menu Shortcuts</div>
                    <div className="text-secondary" style={{ fontSize: 12 }}>
                      Edit the sidebar shortcuts here. The app uses the format <span className="font-mono">Ctrl+Alt+Key</span> and prevents duplicate assignments.
                    </div>
                  </div>
                  {hasMainMenuShortcutDuplicates ? (
                    <span className="badge badge-danger">Duplicate shortcuts found</span>
                  ) : (
                    <span className="badge badge-success">All shortcuts unique</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {visibleShortcutModules.map((module) => {
                    const token = mainMenuShortcuts[module.id] || getDefaultMainMenuShortcuts()[module.id] || '';
                    const duplicateToken = Object.entries(mainMenuShortcutDuplicates).find(([, moduleIds]) => moduleIds.includes(module.id))?.[0] || '';
                    return (
                      <div
                        key={module.id}
                        style={{
                          border: `1px solid ${duplicateToken ? 'var(--danger)' : 'var(--border)'}`,
                          borderRadius: 14,
                          padding: 14,
                          background: 'var(--bg-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                            <module.icon size={15} />
                            {module.label}
                          </span>
                          <span className={`badge ${module.adminOnly ? 'badge-warning' : 'badge-secondary'}`}>
                            {module.adminOnly ? 'Admin only' : 'Visible menu'}
                          </span>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Shortcut Key</label>
                          <input
                            className="form-control"
                            value={token}
                            onChange={(e) => updateMainMenuShortcut(module.id, e.target.value)}
                            placeholder="1 / Q / W"
                            maxLength={2}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className="text-secondary text-sm">Final shortcut: <span className="font-mono">{formatMainMenuShortcut(token) || 'Not set'}</span></span>
                          {duplicateToken ? <span className="badge badge-danger">Duplicate with {duplicateToken}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    Developer keeps protected full access. Shortcut changes apply after save, duplicate shortcuts are blocked, and delegated admins can manage only the modules Developer assigned to them.
                  </div>
                  <button className="btn btn-primary" onClick={handleSaveModules} disabled={hasMainMenuShortcutDuplicates}><Save size={14} /> Save Module Configuration</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>Access Matrix</h4></div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>User</th><th>Role</th><th>Access</th><th>Visible Modules</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const accessibleModules = getAccessibleModules(user, settings);
                      return (
                        <tr key={user.id}>
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span>{user.full_name || user.username}</span>
                              {user.is_protected ? <span className="badge badge-warning" style={{ fontSize: 9 }}>Protected</span> : null}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getRoleBadgeClass(user.role)}`}>{user.role}</span>
                          </td>
                          <td className="text-secondary">{summarizeModuleAccess(user, settings)}</td>
                          <td className="text-secondary text-sm">{accessibleModules.length ? accessibleModules.map((module) => module.label).join(', ') : 'No modules'}</td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => setUserModal(user)}>
                              <Shield size={13} /> Manage Access
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>System Users</h4>
                <div className="text-secondary" style={{ fontSize: 13 }}>
                  {isDeveloperUser(currentUser)
                    ? 'Create admins or staff users and control their module visibility from one place.'
                    : 'Create staff users and control their module visibility only within the modules assigned to your account.'}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setUserModal({})}><Plus size={13} /> Add User</button>
            </div>

            <div className="card">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Module Access</th><th>Last Login</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td style={{ fontWeight: 500 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                              {user.full_name?.[0] || user.username[0].toUpperCase()}
                            </div>
                            {user.full_name || user.username}
                            {user.id === currentUser?.id && <span className="badge badge-success" style={{ fontSize: 9 }}>You</span>}
                            {user.is_protected ? <span className="badge badge-warning" style={{ fontSize: 9 }}>Protected</span> : null}
                          </div>
                        </td>
                        <td><span className="font-mono text-secondary">{user.username}</span></td>
                        <td className="text-secondary">{user.email || '-'}</td>
                        <td>
                          <span className={`badge ${getRoleBadgeClass(user.role)}`}>{user.role}</span>
                        </td>
                        <td className="text-secondary">{summarizeModuleAccess(user, settings)}</td>
                        <td className="text-secondary text-sm">{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setUserModal(user)} title={user.is_protected ? 'View protected account' : 'Edit'}><Shield size={13} /></button>
                            {user.id !== currentUser?.id && !user.is_protected && (
                              <button className="btn btn-danger btn-icon btn-sm" onClick={() => deactivateUser(user.id)} title="Remove"><Trash2 size={13} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'backup' && (
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <h4>Google Drive / Cloud Backup</h4>
                {backupSaved && <span className="badge badge-success">Saved</span>}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p className="text-secondary" style={{ fontSize: 13 }}>
                  {appName} can either upload backups directly to Google Drive using a saved Google login, or write them into a local synced folder. Both ERP master and accounting backups run together on the selected schedule.
                </p>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Automatic Backup</label>
                    <select
                      className="form-control"
                      value={form.cloud_backup_enabled || 'false'}
                      onChange={(e) => setForm((prev) => ({ ...prev, cloud_backup_enabled: e.target.value }))}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Backup Provider</label>
                    <select
                      className="form-control"
                      value={form.cloud_backup_provider || 'local_folder'}
                      onChange={(e) => setForm((prev) => ({ ...prev, cloud_backup_provider: e.target.value }))}
                    >
                      <option value="google_drive_api">Google Drive API Login</option>
                      <option value="local_folder">Local Synced Folder</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Backup Interval</label>
                    <select
                      className="form-control"
                      value={form.cloud_backup_interval || 'daily'}
                      onChange={(e) => setForm((prev) => ({ ...prev, cloud_backup_interval: e.target.value }))}
                    >
                      <option value="daily">Every Day</option>
                      <option value="weekly">Every Week</option>
                      <option value="monthly">Every Month</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Login Storage</label>
                    <div className="form-control" style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
                      {googleDriveStatus.tokenStoragePath || 'Stored in local desktop app config on this PC'}
                    </div>
                  </div>
                </div>

                {cloudBackupUsesGoogleDriveApi ? (
                  <>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Google Client ID</label>
                        <input
                          className="form-control"
                          value={googleDriveConfig.clientId}
                          onChange={(e) => setGoogleDriveConfig((prev) => ({ ...prev, clientId: e.target.value }))}
                          placeholder="OAuth client ID from Google Cloud"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Google Client Secret</label>
                        <input
                          className="form-control"
                          type="password"
                          value={googleDriveConfig.clientSecret}
                          onChange={(e) => setGoogleDriveConfig((prev) => ({ ...prev, clientSecret: e.target.value }))}
                          placeholder="OAuth client secret"
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Drive Folder URL / Folder ID</label>
                      <input
                        className="form-control"
                        value={googleDriveConfig.folderInput}
                        onChange={(e) => setGoogleDriveConfig((prev) => ({ ...prev, folderInput: e.target.value }))}
                        placeholder="Paste Google Drive folder URL or folder ID"
                      />
                      <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                        Save the Google Drive client settings, then click Connect Google Drive. The app stores the reusable login token in its local config on this PC and will reuse it for scheduled uploads.
                      </div>
                    </div>

                    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>Google Drive login status</div>
                        <div className="text-secondary" style={{ fontSize: 12 }}>
                          {googleDriveStatus.connected
                            ? `Connected${googleDriveStatus.email ? ` as ${googleDriveStatus.email}` : ''}`
                            : 'Not connected yet'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>Saved folder ID</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {googleDriveStatus.folderId || 'No Google Drive folder saved yet'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>How it works</div>
                        <div className="text-secondary" style={{ fontSize: 12 }}>
                          OWNERP creates the backup files locally, uploads both databases to the selected Google Drive folder through the Drive API, and reuses the saved login token for manual and scheduled backups.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" type="button" onClick={handleSaveGoogleDriveConfig} disabled={googleDriveBusy || cloudBackupBusy}>
                        <Save size={14} /> {googleDriveBusy ? 'Saving...' : 'Save Drive Login Settings'}
                      </button>
                      <button className="btn btn-primary" type="button" onClick={handleConnectGoogleDrive} disabled={googleDriveBusy || cloudBackupBusy}>
                        <Shield size={14} /> {googleDriveBusy ? 'Connecting...' : 'Connect Google Drive'}
                      </button>
                      <button className="btn btn-danger" type="button" onClick={handleDisconnectGoogleDrive} disabled={googleDriveBusy || cloudBackupBusy || !googleDriveStatus.connected}>
                        <Trash2 size={14} /> Remove Saved Login
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Backup Destination Folder</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        className="form-control"
                        value={form.cloud_backup_destination || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, cloud_backup_destination: e.target.value }))}
                        placeholder="Example: C:\\Users\\YourName\\Google Drive\\OWNERP Backups"
                      />
                      <button type="button" className="btn btn-secondary" onClick={handleSelectCloudBackupFolder}>
                        <Database size={14} /> Browse
                      </button>
                    </div>
                    <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      Use this option only when a desktop sync client already mirrors that folder to the cloud. Paste a Windows folder path only, not a Google Drive website link.
                    </div>
                    {cloudBackupDestinationIsUrl ? (
                      <div style={{ fontSize: 12, marginTop: 8, color: 'var(--danger)' }}>
                        This looks like a web link. Select the synced Google Drive folder from this PC instead.
                      </div>
                    ) : null}
                  </div>
                )}

                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{cloudBackupUsesGoogleDriveApi ? 'Current month Drive folder' : 'Current month backup folder'}</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                      {cloudBackupUsesGoogleDriveApi
                        ? ((googleDriveStatus.folderId || parseGoogleDriveFolderId(googleDriveConfig.folderInput))
                          ? `${googleDriveStatus.folderId || parseGoogleDriveFolderId(googleDriveConfig.folderInput)} / ${currentBackupMonth}`
                          : 'Save a Google Drive folder URL/ID to preview the Drive month folder.')
                        : (cloudBackupDestinationIsUrl
                          ? 'Select a local synced folder to preview the monthly backup path.'
                          : (currentMonthlyBackupFolder || 'Choose a destination folder to preview the monthly backup path.'))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Last successful backup</div>
                    <div className="text-secondary" style={{ fontSize: 12 }}>
                      {form.cloud_backup_last_run_at ? new Date(form.cloud_backup_last_run_at).toLocaleString() : 'No automatic backup has been created yet.'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Last backup output</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                      {form.cloud_backup_last_file || 'No file saved yet'}
                    </div>
                  </div>
                  {form.cloud_backup_last_error ? (
                    <div>
                      <div style={{ fontSize: 13, marginBottom: 4, color: 'var(--danger)' }}>Last backup error</div>
                      <div style={{ fontSize: 12, color: 'var(--danger)', wordBreak: 'break-word' }}>{form.cloud_backup_last_error}</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleSaveCloudBackupSettings} disabled={cloudBackupBusy}>
                    <Save size={14} /> {cloudBackupBusy ? 'Saving...' : 'Save Auto Backup Settings'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleRunCloudBackupNow}
                    disabled={
                      cloudBackupBusy ||
                      !cloudBackupEnabled ||
                      (cloudBackupUsesGoogleDriveApi
                        ? !googleDriveStatus.connected
                        : !cloudBackupDestination)
                    }
                  >
                    <Download size={14} /> Run Backup Now
                  </button>
                  <button className="btn btn-danger" onClick={handleRestoreDatabaseBackup} disabled={cloudBackupBusy}>
                    <Database size={14} /> Restore Database
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>Database Backup</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p className="text-secondary" style={{ fontSize: 13 }}>
                  Create a backup copy of your database, or move the live database to a different folder whenever needed.
                </p>
                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Database folder</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', wordBreak: 'break-all' }}>{dbInfo.folderPath || 'Loading...'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Database file</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{dbInfo.dbPath || 'Loading...'}</div>
                  </div>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    When you change the location, {appName} will ask whether to copy the old database to the new path or create a brand-new database there.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={handleChangeDatabaseLocation} disabled={dbActionLoading}>
                    <Database size={14} /> {dbActionLoading ? 'Updating...' : 'Change Location'}
                  </button>
                  <button className="btn btn-primary" onClick={handleBackup}>
                    <Download size={14} /> Create Backup Now
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>Accounting Database</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p className="text-secondary" style={{ fontSize: 13 }}>
                  Accounting stays in a separate database so books remain isolated while still linking back to ERP masters.
                </p>
                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Accounting folder</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', wordBreak: 'break-all' }}>{accountingDbInfo.folderPath || 'Loading...'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Accounting database file</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{accountingDbInfo.dbPath || 'Loading...'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={handleChangeAccountingDatabaseLocation} disabled={dbActionLoading}>
                    <Database size={14} /> {dbActionLoading ? 'Updating...' : 'Change Accounting Location'}
                  </button>
                  <button className="btn btn-primary" onClick={handleAccountingBackup}>
                    <Download size={14} /> Backup Accounting DB
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>About {appName}</h4></div>
              <div className="card-body" style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  ['Version', updateStatus.version || '1.0.0'],
                  ['Database', 'SQLite (via better-sqlite3)'],
                  ['Framework', 'Electron + React'],
                  ['Access model', 'Role + module-based'],
                  ['Platform', 'Windows 10/11 (x64)']
                ].map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="text-secondary">{key}</span>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}

                <div className="divider" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0 }}>Software Updates</h4>
                  <span className={`badge ${
                    updateStatus.downloaded
                      ? 'badge-success'
                      : updateStatus.available
                        ? 'badge-warning'
                        : 'badge-secondary'
                  }`}>
                    {updateStatus.downloaded
                      ? 'Ready to install'
                      : updateStatus.available
                        ? 'Update available'
                        : 'No pending update'}
                  </span>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Enable Software Updates</label>
                    <select
                      className="form-control"
                      value={form.app_update_enabled || 'false'}
                      onChange={(e) => setForm((prev) => ({ ...prev, app_update_enabled: e.target.value }))}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Update Channel</label>
                    <input
                      className="form-control"
                      value={form.app_update_channel || 'latest'}
                      onChange={(e) => setForm((prev) => ({ ...prev, app_update_channel: e.target.value }))}
                      placeholder="latest"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Update Feed URL</label>
                  <input
                    className="form-control"
                    value={form.app_update_url || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, app_update_url: e.target.value }))}
                    placeholder="Example: https://updates.yourdomain.com/ownerp/win"
                  />
                  <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                    Publish each release to this update endpoint. The packaged app will check it, notify users when a new version is available, download it, run a backup of both databases, and then restart into the new version.
                  </div>
                </div>

                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Update status</div>
                    <div className="text-secondary" style={{ fontSize: 12 }}>{updateStatus.message || 'No update activity yet.'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Configured feed</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                      {updateStatus.updateUrl || (form.app_update_url || '').trim() || 'No update feed configured yet'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Available version</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {updateStatus.availableVersion || updateStatus.downloadedVersion || 'No new version detected'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Download progress</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                      {updateStatus.downloading ? `${Math.round(Number(updateStatus.progressPercent || 0))}%` : 'Idle'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Last checked</div>
                    <div className="text-secondary" style={{ fontSize: 12 }}>
                      {updateStatus.lastCheckedAt ? new Date(updateStatus.lastCheckedAt).toLocaleString() : 'Not checked yet'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleSaveUpdateSettings} disabled={updateBusy}>
                    <Save size={14} /> {updateBusy ? 'Working...' : 'Save Update Settings'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleCheckForUpdates} disabled={updateBusy}>
                    <RefreshCw size={14} /> Check for Updates
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleDownloadUpdate}
                    disabled={updateBusy || !updateStatus.available || updateStatus.downloaded}
                  >
                    <Download size={14} /> {updateStatus.downloading ? 'Downloading...' : 'Download Update'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleInstallUpdate}
                    disabled={updateBusy || !updateStatus.downloaded}
                  >
                    <Database size={14} /> Install Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {userModal !== null && (
        <UserModal
          user={userModal?.id ? userModal : null}
          enabledModuleIds={enabledModules}
          roleOptions={roles}
          currentUser={currentUser}
          onCreateRole={createRole}
          onClose={() => setUserModal(null)}
          onSave={() => {
            setUserModal(null);
            loadUsers();
            loadRoles();
          }}
        />
      )}
    </div>
  );
}
