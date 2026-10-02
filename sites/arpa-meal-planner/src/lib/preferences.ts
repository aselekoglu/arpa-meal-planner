const STORAGE_KEY = 'appPreferences';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppPreferencesBlob {
  defaultServings?: number;
  weekStartsOn?: 0 | 1;
  themeMode?: ThemeMode;
}

function readBlob(): AppPreferencesBlob {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AppPreferencesBlob;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBlob(patch: Partial<AppPreferencesBlob>): void {
  const next = { ...readBlob(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('arpa-preferences-updated'));
}

/** One-time migration: legacy `darkMode` string → `appPreferences.themeMode` */
export function migrateLegacyDarkModeToPreferences(): void {
  const b = readBlob();
  if (b.themeMode === 'light' || b.themeMode === 'dark' || b.themeMode === 'system') return;
  const dm = localStorage.getItem('darkMode');
  if (dm === 'true') writeBlob({ themeMode: 'dark' });
  else if (dm === 'false') writeBlob({ themeMode: 'light' });
}

export function loadDefaultServings(): number {
  const n = Number(readBlob().defaultServings);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 4;
}

export function saveDefaultServings(n: number): void {
  const clamped = Math.max(1, Math.min(100, Math.round(Number(n)) || 4));
  writeBlob({ defaultServings: clamped });
}

export function loadWeekStartsOn(): 0 | 1 {
  return readBlob().weekStartsOn === 0 ? 0 : 1;
}

export function saveWeekStartsOn(v: 0 | 1): void {
  writeBlob({ weekStartsOn: v });
}

export function loadThemeMode(): ThemeMode {
  const b = readBlob();
  if (b.themeMode === 'light' || b.themeMode === 'dark' || b.themeMode === 'system') {
    return b.themeMode;
  }
  const dm = localStorage.getItem('darkMode');
  if (dm === 'true') return 'dark';
  if (dm === 'false') return 'light';
  return 'light';
}

export function saveThemeMode(mode: ThemeMode): void {
  writeBlob({ themeMode: mode });
}

export function resolveThemeIsDark(themeMode: ThemeMode): boolean {
  if (themeMode === 'dark') return true;
  if (themeMode === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Quick toggle from header/sidebar: flip between explicit light and dark (leaves system if user prefers — we flip resolved appearance). */
export function toggleExplicitThemeMode(): ThemeMode {
  const current = loadThemeMode();
  const isDark =
    current === 'system' ? resolveThemeIsDark('system') : current === 'dark';
  const next: ThemeMode = isDark ? 'light' : 'dark';
  saveThemeMode(next);
  return next;
}
