import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  Users,
  UserCheck,
  Briefcase,
  Landmark,
  BookOpen,
  Layers,
  ShoppingCart,
  Truck,
  BarChart2,
  Bell,
  Settings
} from 'lucide-react';

export const MODULE_DEFINITIONS = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { id: 'products', path: '/products', label: 'Catalogue', icon: Package },
  { id: 'categories', path: '/categories', label: 'Categories', icon: Tags },
  { id: 'inventory', path: '/inventory', label: 'Inventory', icon: Warehouse },
  { id: 'contacts', path: '/contacts', label: 'Contacts', icon: Users },
  { id: 'crm', path: '/crm', label: 'CRM', icon: UserCheck },
  { id: 'hr', path: '/hr', label: 'HR', icon: Briefcase },
  { id: 'accounting', path: '/accounting', label: 'Accounting', icon: Landmark },
  { id: 'hsn', path: '/hsn', label: 'HSN Library', icon: BookOpen },
  { id: 'bom', path: '/bom', label: 'Bill of Materials', icon: Layers },
  { id: 'orders', path: '/orders', label: 'Orders', icon: ShoppingCart },
  { id: 'inward', path: '/inward', label: 'Inward / GRN', icon: Truck },
  { id: 'reports', path: '/reports', label: 'Reports', icon: BarChart2 },
  { id: 'notifications', path: '/notifications', label: 'Alerts', icon: Bell },
  { id: 'settings', path: '/settings', label: 'Settings', icon: Settings, adminOnly: true, configurable: false }
];
export const MAIN_MENU_SHORTCUT_TOKENS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Q', 'W', 'E', 'R', 'T'];

const CONFIGURABLE_MODULES = MODULE_DEFINITIONS.filter((module) => module.configurable !== false && !module.adminOnly);
const DEFAULT_ENABLED_MODULE_IDS = CONFIGURABLE_MODULES.map((module) => module.id);
const DEFAULT_MAIN_MENU_SHORTCUTS = MODULE_DEFINITIONS.reduce((acc, module, index) => {
  if (MAIN_MENU_SHORTCUT_TOKENS[index]) {
    acc[module.id] = MAIN_MENU_SHORTCUT_TOKENS[index];
  }
  return acc;
}, {});

export function getConfigurableModules() {
  return CONFIGURABLE_MODULES;
}

export function getDefaultEnabledModuleIds() {
  return [...DEFAULT_ENABLED_MODULE_IDS];
}

export function getDefaultMainMenuShortcuts() {
  return { ...DEFAULT_MAIN_MENU_SHORTCUTS };
}

export function normalizeMainMenuShortcutToken(value) {
  return `${value || ''}`.trim().toUpperCase().replace(/\s+/g, '');
}

export function formatMainMenuShortcut(token) {
  const normalized = normalizeMainMenuShortcutToken(token);
  return normalized ? `Ctrl+Alt+${normalized}` : '';
}

export function sanitizeMainMenuShortcuts(shortcuts = {}) {
  const allowedModuleIds = new Set(MODULE_DEFINITIONS.map((module) => module.id));
  return Object.entries(shortcuts || {}).reduce((acc, [moduleId, token]) => {
    if (!allowedModuleIds.has(moduleId)) return acc;
    const normalizedToken = normalizeMainMenuShortcutToken(token);
    if (!normalizedToken) return acc;
    acc[moduleId] = normalizedToken;
    return acc;
  }, {});
}

export function parseMainMenuShortcuts(value, fallback = DEFAULT_MAIN_MENU_SHORTCUTS) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      ...DEFAULT_MAIN_MENU_SHORTCUTS,
      ...sanitizeMainMenuShortcuts(fallback),
      ...sanitizeMainMenuShortcuts(value)
    };
  }

  try {
    const parsed = JSON.parse(`${value || ''}`.trim() || 'null');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        ...DEFAULT_MAIN_MENU_SHORTCUTS,
        ...sanitizeMainMenuShortcuts(fallback),
        ...sanitizeMainMenuShortcuts(parsed)
      };
    }
  } catch {
    // Ignore malformed stored data and fall back to defaults.
  }

  return {
    ...DEFAULT_MAIN_MENU_SHORTCUTS,
    ...sanitizeMainMenuShortcuts(fallback)
  };
}

export function serializeMainMenuShortcuts(shortcuts = {}) {
  return JSON.stringify(sanitizeMainMenuShortcuts(shortcuts));
}

export function getMainMenuShortcutMap(settings = {}) {
  return parseMainMenuShortcuts(settings.main_menu_shortcuts, DEFAULT_MAIN_MENU_SHORTCUTS);
}

export function findDuplicateMainMenuShortcutTokens(shortcuts = {}) {
  const grouped = Object.entries(sanitizeMainMenuShortcuts(shortcuts)).reduce((acc, [moduleId, token]) => {
    if (!acc[token]) acc[token] = [];
    acc[token].push(moduleId);
    return acc;
  }, {});

  return Object.entries(grouped).reduce((acc, [token, moduleIds]) => {
    if (moduleIds.length > 1) acc[token] = moduleIds;
    return acc;
  }, {});
}

function sanitizeModuleIds(moduleIds = [], includeAdminOnly = false) {
  const allowedIds = new Set(
    MODULE_DEFINITIONS
      .filter((module) => includeAdminOnly || !module.adminOnly)
      .map((module) => module.id)
  );

  return Array.from(new Set((moduleIds || []).filter((moduleId) => allowedIds.has(moduleId))));
}

export function parseModuleIds(value, fallback = DEFAULT_ENABLED_MODULE_IDS, includeAdminOnly = false) {
  if (Array.isArray(value)) {
    return sanitizeModuleIds(value, includeAdminOnly);
  }

  try {
    const parsed = JSON.parse(`${value || ''}`.trim() || 'null');
    if (Array.isArray(parsed)) {
      return sanitizeModuleIds(parsed, includeAdminOnly);
    }
  } catch {
    // Ignore malformed stored data and fall back to defaults.
  }

  return sanitizeModuleIds(fallback, includeAdminOnly);
}

export function serializeModuleIds(moduleIds = []) {
  return JSON.stringify(sanitizeModuleIds(moduleIds));
}

export function getEnabledModuleIds(settings = {}) {
  return parseModuleIds(settings.enabled_modules, DEFAULT_ENABLED_MODULE_IDS);
}

export function isDeveloperUser(user) {
  return `${user?.role || ''}`.trim().toLowerCase() === 'developer';
}

export function isAdminUser(user) {
  return `${user?.role || ''}`.trim().toLowerCase() === 'admin';
}

export function canAccessSettings(user) {
  return isDeveloperUser(user) || isAdminUser(user);
}

export function getDelegatableModuleIds(user, settings = {}) {
  if (isDeveloperUser(user)) {
    return getEnabledModuleIds(settings);
  }

  if (isAdminUser(user)) {
    return parseModuleIds(user?.module_access, getEnabledModuleIds(settings));
  }

  return parseModuleIds(user?.module_access, []);
}

export function getUserAssignedModuleIds(user, settings = {}) {
  if (!user) {
    return [];
  }

  if (isDeveloperUser(user)) {
    return MODULE_DEFINITIONS.map((module) => module.id);
  }

  if (isAdminUser(user)) {
    return parseModuleIds(user.module_access, getEnabledModuleIds(settings));
  }

  return parseModuleIds(user.module_access, getEnabledModuleIds(settings));
}

export function getAccessibleModuleIds(user, settings = {}) {
  if (!user) return [];

  if (isDeveloperUser(user)) {
    return MODULE_DEFINITIONS.map((module) => module.id);
  }

  const enabled = new Set(getEnabledModuleIds(settings));
  const accessible = getUserAssignedModuleIds(user, settings).filter((moduleId) => enabled.has(moduleId));
  if (canAccessSettings(user) && !accessible.includes('settings')) {
    return [...accessible, 'settings'];
  }
  return accessible;
}

export function getAccessibleModules(user, settings = {}) {
  const accessibleIds = new Set(getAccessibleModuleIds(user, settings));
  return MODULE_DEFINITIONS.filter((module) => accessibleIds.has(module.id));
}

export function canAccessModule(user, settings = {}, moduleId) {
  if (!moduleId) return true;
  return getAccessibleModuleIds(user, settings).includes(moduleId);
}

export function getFirstAccessibleModule(user, settings = {}) {
  return getAccessibleModules(user, settings)[0] || null;
}

export function getFirstAccessiblePath(user, settings = {}) {
  return getFirstAccessibleModule(user, settings)?.path || '/no-access';
}

export function summarizeModuleAccess(user, settings = {}) {
  if (!user) return 'No access';
  if (isDeveloperUser(user)) return 'Full access';

  const accessibleModules = getAccessibleModules(user, settings);
  if (!accessibleModules.length) return 'No modules assigned';
  const visibleLabels = accessibleModules.filter((module) => module.id !== 'settings').map((module) => module.label);
  const hasSettings = accessibleModules.some((module) => module.id === 'settings');
  if (visibleLabels.length && visibleLabels.length <= 2) {
    return hasSettings ? `${visibleLabels.join(', ')} + Settings` : visibleLabels.join(', ');
  }
  if (!visibleLabels.length && hasSettings) return 'Settings only';
  return hasSettings ? `${visibleLabels.length} modules + Settings` : `${visibleLabels.length} modules assigned`;
}
