export const MAP_STYLE_KEY = 'app360_map_style';
export const NAV_THEME_KEY   = 'app360_theme';

/** Base map styles that follow app dark/light theme. */
export const BASE_MAP_STYLES = ['dark', 'light'];

/** Independent map styles (persist across nav theme changes). */
export const EXTRA_MAP_STYLES = ['satellite', 'terrain', 'streets'];

export function getSavedMapStyle() {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(MAP_STYLE_KEY) || 'dark';
}

export function saveMapStyle(style) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MAP_STYLE_KEY, style);
}

/** When nav theme toggles, sync only if user chose a base dark/light style. */
export function mapStyleForNavTheme(navTheme, savedStyle) {
  if (EXTRA_MAP_STYLES.includes(savedStyle)) return savedStyle;
  return navTheme === 'light' ? 'light' : 'dark';
}

export function getInitialMapStyle() {
  if (typeof window === 'undefined') return 'dark';
  const saved = getSavedMapStyle();
  const nav   = localStorage.getItem(NAV_THEME_KEY) || 'dark';
  return mapStyleForNavTheme(nav, saved);
}
