'use client';

/**
 * The theme toggle (T-098).
 *
 * The class on `<html>` is applied before first paint by `THEME_BOOT_SCRIPT`,
 * not here — this component only reflects and changes the stored preference.
 * Doing it in React would mean a white flash on every load for a dark-theme
 * user, which on a slow phone is the thing they remember about the app.
 */
import { useEffect, useState } from 'react';

import { Icon } from './icons';
import {
  isThemePreference,
  nextPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './theme';
import { copy } from '../lib/i18n';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Puts an explicit choice on `<html>`.
 *
 * `system` removes both classes and lets the CSS media query decide — which is
 * why a student who has never touched the toggle needs no JavaScript to get a
 * dark app on a dark phone.
 */
function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  if (preference !== 'system') root.classList.add(preference);
  root.dataset.themePreference = preference;
}

/**
 * Two shapes, one behaviour.
 *
 * `button` is the specimen-sheet form. `rail` is what the design handoff draws
 * at the foot of the desktop rail: an icon and a sentence, no button chrome —
 * the rail already has one filled shape in it (the active destination) and a
 * second would compete with it for "the thing to press here".
 */
export type ThemeToggleVariant = 'button' | 'rail';

export function ThemeToggle({ variant = 'button' }: { variant?: ThemeToggleVariant | undefined }) {
  // Starts as `system` on the server and on first client render, so the markup
  // matches and hydration does not warn. The real preference is read in an
  // effect, after the boot script has already painted the right theme.
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!isThemePreference(stored)) return;
    setPreference(stored);
    // Re-applied after hydration because React strips classes it does not own
    // from <html>. Only an explicit override needs this; a student on `system`
    // is already correct from CSS alone, so there is no flash for them.
    applyPreference(stored);
  }, []);

  const toggle = (): void => {
    const next = nextPreference(preference, prefersDark());
    setPreference(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode, or storage disabled. The theme still changes for this
      // page; it simply will not survive a reload. Losing the preference is a
      // far smaller failure than refusing to change the theme at all.
    }
    applyPreference(next);
  };

  const showingDark = resolveTheme(preference, prefersDark()) === 'dark';
  const c = copy();
  // Says which theme is on AND what pressing it does. "Switch to dark" alone
  // leaves somebody who has just arrived unsure which half they are reading.
  const label = showingDark ? c.theme.darkSwitchToLight : c.theme.lightSwitchToDark;

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        variant === 'rail'
          ? 'text-caption text-ink-2 rounded-control inline-flex items-center gap-2 py-1 text-left'
          : 'btn-ghost'
      }
      data-theme-preference={preference}
      aria-pressed={showingDark}
    >
      <Icon name={showingDark ? 'moon' : 'sun'} size={18} />
      {label}
    </button>
  );
}
