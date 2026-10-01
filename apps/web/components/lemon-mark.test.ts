/**
 * The mark is one drawing, and its colours are the theme's (T-270).
 *
 * **`brand-icons.mjs` carried its own copy of the design and was broken for
 * three weeks.** It hardcoded a violet left behind by a palette change, and
 * nobody noticed because app icons are regenerated about twice a year. So the
 * geometry lives in one module that the component and the script both import,
 * and the colours it falls back to are held against the stylesheet here.
 *
 * The mark itself changed on 2026-10-01 — a whole lemon with a check through it
 * became a lemon slice — and these tests changed with it. What did not change is
 * why they exist.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CENTER_R, FLESH_R, MARK_COLORS, PITH_R, RIND_R, lemonMarkSvg } from './lemon-mark.mjs';
import { stripComments } from '../lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const theme = readFileSync(resolve(here, '../../../design-system/tailwind-theme.css'), 'utf8');

/** Reads `--color-x: #hex;` out of the normative theme block. */
function token(name: string): string {
  const found = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(theme);
  if (!found) throw new Error(`--color-${name} is not in tailwind-theme.css`);
  return found[1]!.toLowerCase();
}

describe('the lemon slice (T-270)', () => {
  it('takes every colour from the theme', () => {
    expect(MARK_COLORS.flesh).toBe(token('brand'));
    expect(MARK_COLORS.rind).toBe(token('brand-hover'));
    expect(MARK_COLORS.pith).toBe(token('brand-pale'));
  });

  /*
   * Outside in, and each ring strictly inside the last. A pith wider than its
   * rind is not a lemon, and the arcs would render outside the circle that is
   * supposed to contain them.
   */
  it('nests the rings', () => {
    expect(RIND_R).toBeGreaterThan(PITH_R);
    expect(PITH_R).toBeGreaterThan(FLESH_R);
    expect(FLESH_R).toBeGreaterThan(CENTER_R);
    // Inside the centred viewBox, so nothing is clipped.
    expect(RIND_R).toBeLessThanOrEqual(100);
  });

  /**
   * Four wedges in one path.
   *
   * Separate paths would each carry their own stroke and the pith between them
   * would double up at the centre, which is where the four meet and where any
   * error is most visible.
   */
  it('draws the flesh as a single path with a pith stroke', () => {
    const svg = lemonMarkSvg({ size: 24 });
    expect(svg.match(/<path/g)).toHaveLength(1);
    expect((svg.match(/A70 70/g) ?? []).length).toBe(4);
    expect(svg).toContain(`stroke="${MARK_COLORS.pith}"`);
    expect(svg).toContain('stroke-linejoin="round"');
  });

  /** At 20px the dot is about one device pixel — a smudge, not a detail. */
  it('drops the centre dot when asked, and keeps the wedges', () => {
    const small = lemonMarkSvg({ size: 20, centerDot: false });
    expect(small).not.toContain(`r="${CENTER_R}"`);
    expect(small).toContain('A70 70');

    expect(lemonMarkSvg({ size: 56, centerDot: true })).toContain(`r="${CENTER_R}"`);
  });

  /**
   * The icon script and the component draw the same paths.
   *
   * Read as text rather than rendered: what matters is that neither file grew
   * its own copy of a path, which is exactly how the old violet got left behind.
   */
  it('is drawn from the shared geometry in both places', () => {
    const component = stripComments(readFileSync(resolve(here, 'LemonMark.tsx'), 'utf8'));
    const script = stripComments(readFileSync(resolve(here, '../scripts/brand-icons.mjs'), 'utf8'));

    expect(component).toContain("from './lemon-mark.mjs'");
    expect(script).toContain("from '../components/lemon-mark.mjs'");
    // No hand-written path data or colour literal outside the shared module.
    expect(component).not.toMatch(/d="M\d/);
    expect(script).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  /**
   * The mark does not inherit ink.
   *
   * The previous one took `currentColor` so it picked up whatever sat around
   * it. A slice is three specific colours in a fixed relationship; inheriting
   * any of them turns it into a monochrome disc.
   */
  it('names its own colours rather than inheriting them', () => {
    const component = stripComments(readFileSync(resolve(here, 'LemonMark.tsx'), 'utf8'));
    expect(component).not.toContain('currentColor');
  });
});
