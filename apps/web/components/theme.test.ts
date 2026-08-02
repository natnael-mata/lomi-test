import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  isThemePreference,
  nextPreference,
  resolveTheme,
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';

describe('resolveTheme (T-098)', () => {
  it('honours an explicit choice over the OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  // `system` is the absence of a choice and has to stay distinguishable from
  // "chose light": one should follow the phone at night, the other must not.
  it('follows the OS only on system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('nextPreference', () => {
  // Pressing a toggle must always visibly change something. "system → light"
  // while the OS is already light does nothing and reads as a broken control.
  it('moves away from whatever is currently showing', () => {
    expect(nextPreference('system', true)).toBe('light');
    expect(nextPreference('system', false)).toBe('dark');
    expect(nextPreference('dark', false)).toBe('light');
    expect(nextPreference('light', true)).toBe('dark');
  });

  it('always changes the resolved theme', () => {
    for (const preference of ['light', 'dark', 'system'] as const) {
      for (const osDark of [true, false]) {
        const before = resolveTheme(preference, osDark);
        const after = resolveTheme(nextPreference(preference, osDark), osDark);
        expect(after).not.toBe(before);
      }
    }
  });
});

describe('isThemePreference', () => {
  it('accepts the three states and nothing else', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    for (const junk of ['', 'DARK', null, undefined, 0, {}]) {
      expect(isThemePreference(junk)).toBe(false);
    }
  });
});

describe('THEME_BOOT_SCRIPT', () => {
  it('reads the same key the toggle writes', () => {
    expect(THEME_BOOT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  // It must not throw before the page is styled: storage can be disabled.
  it('is wrapped in try/catch', () => {
    expect(THEME_BOOT_SCRIPT).toMatch(/try\s*\{/);
    expect(THEME_BOOT_SCRIPT).toMatch(/catch\s*\(/);
  });

  // The OS preference is CSS's job now — a class the script adds for `system`
  // would be stripped by hydration anyway, and the media query is faster.
  it('acts only on an explicit choice', () => {
    expect(THEME_BOOT_SCRIPT).not.toContain('prefers-color-scheme');
    expect(THEME_BOOT_SCRIPT).toMatch(/p!=='light'&&p!=='dark'/);
  });
});

/**
 * The dark tokens are declared twice — once under `@media (prefers-color-scheme:
 * dark)` so a dark phone needs no JavaScript, once under `.dark` for an explicit
 * override. CSS custom properties cannot be shared between the two, so this test
 * is what keeps them honest.
 */
describe('the two dark blocks stay identical', () => {
  const THEME = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../design-system/tailwind-theme.css'),
    'utf8',
  );

  const declarations = (source: string): string[] =>
    source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('--'))
      .sort();

  const blockAfter = (marker: string): string => {
    const start = THEME.indexOf(marker);
    expect(start, `${marker} not found`).toBeGreaterThan(-1);
    const open = THEME.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < THEME.length; i++) {
      if (THEME[i] === '{') depth++;
      else if (THEME[i] === '}' && --depth === 0) return THEME.slice(open + 1, i);
    }
    throw new Error(`unterminated block after ${marker}`);
  };

  it('finds both blocks', () => {
    expect(declarations(blockAfter(':root:not(.light)')).length).toBeGreaterThan(10);
    expect(declarations(blockAfter('\n.dark {')).length).toBeGreaterThan(10);
  });

  it('declares exactly the same tokens with the same values', () => {
    expect(declarations(blockAfter(':root:not(.light)'))).toEqual(
      declarations(blockAfter('\n.dark {')),
    );
  });

  it('scopes the media query so an explicit light choice wins', () => {
    expect(THEME).toContain(':root:not(.light)');
  });
});
