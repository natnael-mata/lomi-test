/**
 * A guard on the design system's focus ring (T-095).
 *
 * DESIGN.md: "2px brand outline at 2px offset, on every interactive element."
 * The theme states that once, globally, on `:focus-visible` — and any component
 * class that sets `outline-none` on focus silently cancels it for that control,
 * because `.field:focus` (0,1,1) outranks `:focus-visible` (0,1,0).
 *
 * That is exactly what happened: `.field` carried `focus:outline-none`, so the
 * ring was present everywhere except on inputs, where a keyboard user needs it
 * most. This reads the stylesheet so it cannot come back quietly.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const RAW = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../design-system/tailwind-theme.css'),
  'utf8',
);

/**
 * Comments stripped before checking.
 *
 * The first version of this test failed on the comment that *documents* why the
 * outline is not cancelled — a test that cannot tell a rule from a note about
 * the rule would eventually be silenced rather than fixed.
 */
const THEME = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the focus ring is stated once and never cancelled', () => {
  it('declares the ring on :focus-visible, at 2px and 2px offset', () => {
    expect(THEME).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-brand\)/);
    expect(THEME).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/);
  });

  it('cancels the outline nowhere in the theme', () => {
    // `@apply ... focus:outline-none` spans lines, so the file is checked whole
    // rather than line by line.
    expect(THEME).not.toMatch(/focus:outline-none/);
    expect(THEME).not.toMatch(/focus:outline-hidden/);
    expect(THEME).not.toMatch(/:focus\s*\{[^}]*outline:\s*none/);
  });

  it('still declares the ring after comments are stripped', () => {
    // Guards the stripping itself: if the regex ate the rule too, this fails.
    expect(THEME).toMatch(/:focus-visible/);
  });
});
