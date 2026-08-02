/**
 * Theme resolution (T-098), with no DOM involved.
 *
 * Three states, not two. "Dark" and "light" are choices a student made; **system**
 * is the absence of a choice, and it has to stay distinguishable — a student who
 * has never touched the toggle should follow their phone when it switches to
 * dark at night, and one who explicitly chose light should not.
 * Collapsing system into a stored "light" silently opts them out of that.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lomi-theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** What to actually paint, given the stored preference and the OS setting. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * The next preference when the toggle is pressed.
 *
 * From `system`, it moves to the opposite of what is currently shown — pressing
 * a toggle must always visibly change something, and "system → light" while the
 * OS is already light does nothing and reads as a broken control.
 */
export function nextPreference(preference: ThemePreference, prefersDark: boolean): ThemePreference {
  const showing = resolveTheme(preference, prefersDark);
  return showing === 'dark' ? 'light' : 'dark';
}

/**
 * The script that runs before first paint.
 *
 * It handles **only an explicit choice**. The OS preference is handled in CSS
 * (`@media (prefers-color-scheme: dark)` in the theme), which is both faster and
 * the only thing that survives: React owns `<html>`'s attributes, so a class
 * this script adds is stripped during hydration. A student on `system` therefore
 * gets the right theme with no JavaScript involved at all, and only someone who
 * has overridden their OS depends on the class being re-applied after hydration.
 *
 * Adding rather than toggling, and returning early on anything unrecognised: a
 * corrupt value, or a browser with `localStorage` disabled, must fall through to
 * the CSS rather than throw and leave the page unstyled.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(p!=='light'&&p!=='dark'){return;}
document.documentElement.classList.add(p);
}catch(e){}})();`;
