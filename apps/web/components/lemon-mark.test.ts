/**
 * The mark is one drawing, and its colours are the theme's (T-269).
 *
 * **`brand-icons.mjs` carried its own copy of the design and was broken for
 * three weeks.** It hardcoded `#5b4be0` — brand violet — and inlined an
 * Ethiopic woff2, both left behind by the move to a lemon palette and
 * English-only text. The script could not have run, and nobody noticed, because
 * app icons are regenerated about twice a year.
 *
 * So the geometry now lives in one module that the component and the script
 * both import, and the colours it falls back to are held against the
 * stylesheet here. A mark drawn twice becomes two marks; a mark whose palette
 * is copied becomes the wrong colour somewhere nobody is looking.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LEAVES_MIN_PX, MARK_COLORS, lemonMarkSvg } from './lemon-mark.mjs';
import { stripComments } from '../lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const theme = readFileSync(resolve(here, '../../../design-system/tailwind-theme.css'), 'utf8');

/** Reads `--color-x: #hex;` out of the normative theme block. */
function token(name: string): string {
  const found = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(theme);
  if (!found) throw new Error(`--color-${name} is not in tailwind-theme.css`);
  return found[1]!.toLowerCase();
}

describe('the lemon mark (T-269)', () => {
  it('takes every colour from the theme', () => {
    expect(MARK_COLORS.ink).toBe(token('ink'));
    expect(MARK_COLORS.lemon).toBe(token('brand'));
    expect(MARK_COLORS.cream).toBe(token('surface'));
    // The same mint the answer screens fill a correct option with — the check
    // is that gesture, not a second green chosen to look like it.
    expect(MARK_COLORS.mint).toBe(token('correct-soft'));
  });

  /*
   * The check is what makes this an exam-practice mark rather than a fruit, and
   * mint alone is about 1.2:1 on the lemon tile. Drawn twice — ink under, mint
   * over — which is what the handoff means by "the mint-on-ink correct stroke".
   */
  it('draws the check on an ink underlay, so it survives the yellow tile', () => {
    const svg = lemonMarkSvg({ size: 24 });
    const strokes = [...svg.matchAll(/M8\.4 13\.9[^"]*" stroke="([^"]+)" stroke-width="([\d.]+)"/g)];
    expect(strokes).toHaveLength(2);
    expect(strokes[0]![1]).toBe(MARK_COLORS.ink);
    expect(strokes[1]![1]).toBe(MARK_COLORS.mint);
    // The ink must be the wider of the two or it is not an underlay.
    expect(Number(strokes[0]![2])).toBeGreaterThan(Number(strokes[1]![2]));
  });

  it('drops the leaves when asked, and keeps the check', () => {
    const small = lemonMarkSvg({ size: 20, leaves: false });
    expect(small).not.toContain('C 11.7 4.1');
    expect(small).toContain('M8.4 13.9');

    const large = lemonMarkSvg({ size: 56, leaves: true });
    expect(large).toContain('C 11.7 4.1');
  });

  /** Small enough that leaves are pixels, large enough that they resolve. */
  it('puts the leaf threshold where the design put it', () => {
    expect(LEAVES_MIN_PX).toBe(24);
  });

  it('leaves the body unfilled when it sits on the brand tile', () => {
    // A second yellow on a yellow ground only thickens the outline.
    expect(lemonMarkSvg({ filled: false })).toContain('fill="none"');
    expect(lemonMarkSvg({ filled: true })).toContain(`fill="${MARK_COLORS.lemon}"`);
  });

  /**
   * The icon script and the component draw the same paths.
   *
   * Read as text rather than rendered: what matters is that neither file grew
   * its own copy of a path, which is exactly how the violet got left behind.
   */
  it('is drawn from the shared geometry in both places', () => {
    // Comments stripped: both files *describe* the violet they used to
    // hardcode, and a scan that cannot tell prose from code would forbid
    // writing down why the bug happened.
    const component = stripComments(readFileSync(resolve(here, 'LemonMark.tsx'), 'utf8'));
    const script = stripComments(readFileSync(resolve(here, '../scripts/brand-icons.mjs'), 'utf8'));

    expect(component).toContain("from './lemon-mark.mjs'");
    expect(script).toContain("from '../components/lemon-mark.mjs'");
    // No hand-written path data or colour literal outside the shared module.
    expect(component).not.toMatch(/d="M\d/);
    expect(script).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
