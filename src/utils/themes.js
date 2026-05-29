export const DEFAULT_THEME_ID = 'daylight-classic';
export const DEFAULT_DARK_THEME_ID = 'midnight-professional';

export const APP_THEMES = [
  {
    id: 'daylight-classic',
    name: 'Daylight Classic',
    description: 'Crisp white workspace with a trusted blue accent.',
    mode: 'light',
    swatches: ['#2563eb', '#f8fafc', '#cbd5e1']
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    description: 'Cool teal surfaces for long work sessions.',
    mode: 'light',
    swatches: ['#0f766e', '#ecfeff', '#99f6e4']
  },
  {
    id: 'forest-ledger',
    name: 'Forest Ledger',
    description: 'Balanced green palette with calm accounting energy.',
    mode: 'light',
    swatches: ['#2f6f4f', '#f6fbf7', '#bbf7d0']
  },
  {
    id: 'sunset-copper',
    name: 'Sunset Copper',
    description: 'Warm premium neutrals with copper highlights.',
    mode: 'light',
    swatches: ['#c26a2d', '#fffaf5', '#fed7aa']
  },
  {
    id: 'midnight-professional',
    name: 'Midnight Professional',
    description: 'Focused dark cockpit for late-night operations.',
    mode: 'dark',
    swatches: ['#3d7fff', '#0f172a', '#334155']
  },
  {
    id: 'graphite-indigo',
    name: 'Graphite Indigo',
    description: 'Deep graphite base with softer indigo contrast.',
    mode: 'dark',
    swatches: ['#7c8cff', '#111827', '#374151']
  }
];

export function getThemeMeta(themeId) {
  return APP_THEMES.find((theme) => theme.id === themeId) || APP_THEMES[0];
}

export function getThemeMode(themeId) {
  return getThemeMeta(themeId).mode;
}

export function isLightTheme(themeId) {
  return getThemeMode(themeId) === 'light';
}
