export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

function getSystemTheme(): EffectiveTheme {
  // matchMedia returns a MediaQueryList you can query via `.matches`  [oai_citation:15‡MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getThemePreference(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark') {
    return v;
  }
  return 'system';
}

export function getEffectiveTheme(
  pref: ThemePreference = getThemePreference()
): EffectiveTheme {
  if (pref === 'system') {
    return getSystemTheme();
  }
  return pref;
}

export function applyTheme(pref: ThemePreference = getThemePreference()): void {
  const effective = getEffectiveTheme(pref);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

export function setTheme(pref: ThemePreference): void {
  if (pref === 'system') {
    // Tailwind’s suggested “system” behavior: remove the saved key  [oai_citation:16‡Tailwind CSS](https://tailwindcss.com/docs/dark-mode)
    localStorage.removeItem(STORAGE_KEY);
  } else {
    // Tailwind’s suggested explicit modes  [oai_citation:17‡Tailwind CSS](https://tailwindcss.com/docs/dark-mode)
    localStorage.setItem(STORAGE_KEY, pref);
  }
  applyTheme(pref);
}

/**
 * Call once on startup to keep System mode reactive to OS changes.
 */
export function installSystemThemeListener(): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)'); //  [oai_citation:18‡MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)

  const onChange = () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
    }
  };

  // Modern browsers: MediaQueryList emits "change" when the query match flips  [oai_citation:19‡MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
