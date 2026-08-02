/**
 * Reduced motion and Amharic casing, checked against the stylesheet (T-100, T-101).
 *
 * `prefers-reduced-motion` cannot be forced from the browser tooling available
 * here, so what is asserted is that the rule exists, is global, and carries the
 * right declarations. The Amharic half IS verified in a real page — see the note
 * on T-101 in TASK.md — and this locks it in.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const THEME = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../design-system/tailwind-theme.css'),
  'utf8',
);

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

describe('reduced motion (T-100)', () => {
  const block = () => blockAfter('@media (prefers-reduced-motion: reduce)');

  it('is declared exactly once', () => {
    expect(THEME.split('prefers-reduced-motion').length - 1).toBe(1);
  });

  // Global: a per-component opt-in is one someone forgets on the component that
  // matters, and motion sickness is not a per-component problem.
  it('applies to every element and pseudo-element', () => {
    const b = block();
    expect(b).toMatch(/\*\s*,/);
    expect(b).toContain('*::before');
    expect(b).toContain('*::after');
  });

  it('flattens transitions, animations and smooth scrolling', () => {
    const b = block();
    expect(b).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
    expect(b).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
    expect(b).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(b).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  // Near-zero, never zero: `transitionend` and `animationend` must still fire,
  // or anything waiting on them hangs forever.
  it('uses a near-zero duration rather than zero', () => {
    expect(block()).not.toMatch(/transition-duration:\s*0s/);
    expect(block()).not.toMatch(/animation-duration:\s*0s/);
  });

  it('wins over component transitions, which are not marked important', () => {
    const components = THEME.slice(THEME.indexOf('@layer components'));
    expect(components).not.toContain('!important');
  });
});

describe('Amharic casing (T-101)', () => {
  it('turns off text-transform under lang="am"', () => {
    expect(THEME).toMatch(/\[lang='am'\]/);
    expect(blockAfter("[lang='am']")).toMatch(/text-transform:\s*none/);
  });

  // Descendants too: the uppercase surfaces are captions and field labels deep
  // in the tree, not the <html> element itself.
  it('reaches descendants, not only the element carrying the attribute', () => {
    const start = THEME.indexOf("[lang='am']");
    const selector = THEME.slice(start, THEME.indexOf('{', start));
    expect(selector).toMatch(/\[lang='am'\]\s*\*/);
  });

  it('leaves other languages alone', () => {
    // A blanket `text-transform: none` would silently kill the uppercase
    // captions DESIGN.md specifies for every non-Amharic reader.
    const base = THEME.slice(THEME.indexOf('@layer base'), THEME.indexOf("[lang='am']"));
    expect(base).not.toMatch(/^\s*text-transform:\s*none/m);
  });
});
