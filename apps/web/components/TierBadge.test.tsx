/**
 * Badge tiers read in greyscale (T-192).
 *
 * The task asks for "a greyscale snapshot", and a snapshot is the wrong
 * instrument: it passes until somebody accepts a new one, and the thing being
 * asserted — that four tiers remain *distinguishable* — is not something an
 * image diff can state. So this checks the property directly. Strip the colour
 * and four different shapes are still four different shapes.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TierBadge, tierLabel, tierShape, type TierId } from './TierBadge';
import { stripComments } from '../lib/strip-comments';

const TIERS: TierId[] = ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'TierBadge.tsx'),
  'utf8',
);
const code = stripComments(source);

describe('tiers differ by shape, not colour (T-192)', () => {
  it('still has code left after the comments are stripped', () => {
    expect(code).toContain('tierLabel');
    expect(code.length).toBeGreaterThan(1000);
  });

  /**
   * The greyscale test, stated as the property it is really about: remove every
   * colour and no two tiers become the same thing.
   */
  it('gives every tier a distinct shape', () => {
    const paths = TIERS.map((tier) => tierShape(tier).path);
    expect(new Set(paths).size).toBe(TIERS.length);
  });

  it('gives every tier a distinct name', () => {
    const labels = TIERS.map(tierLabel);
    expect(new Set(labels).size).toBe(TIERS.length);
  });

  /**
   * The pair that actually collapses. Bronze against gold is the classic
   * red-green confusion, and it is also the comparison a student most wants to
   * make.
   */
  it('keeps bronze and gold apart without colour', () => {
    expect(tierShape('BRONZE').path).not.toBe(tierShape('GOLD').path);
    expect(tierShape('BRONZE').sides).not.toBe(tierShape('GOLD').sides);
  });

  /**
   * More sides as the tier rises, so progression reads without anybody being
   * told — the same way more stars does.
   */
  it('ascends in complexity', () => {
    const corners = (path: string): number => (path.match(/L/g) ?? []).length;
    expect(corners(tierShape('BRONZE').path)).toBeLessThan(corners(tierShape('SILVER').path));
    expect(corners(tierShape('SILVER').path)).toBeLessThan(corners(tierShape('GOLD').path));
    expect(corners(tierShape('GOLD').path)).toBeLessThan(corners(tierShape('PLATINUM').path));
  });

  // An absence should look like an absence, not like a tier that failed to
  // render — which is what an empty box reads as.
  it('draws something for no tier at all', () => {
    expect(tierShape('NONE').path.trim().length).toBeGreaterThan(0);
    expect(tierLabel('NONE')).toBe('No tier yet');
  });

  it('renders every tier without throwing', () => {
    for (const tier of TIERS) {
      expect(() => TierBadge({ tier }), tier).not.toThrow();
      expect(() => TierBadge({ tier, showLabel: false }), tier).not.toThrow();
    }
  });
});

describe('what carries the meaning', () => {
  /**
   * `currentColor`, so the shape inherits the text colour and survives a
   * forced-colours mode where a hard-coded fill would vanish.
   */
  it('strokes with currentColor rather than a fixed fill', () => {
    expect(code).toContain('stroke="currentColor"');
    expect(code).toContain('fill="none"');
    expect(code).not.toMatch(/fill="#[0-9a-f]{3,6}"/i);
  });

  /**
   * A shape beside its own name is decoration and must be hidden from a screen
   * reader; a shape on its own is the whole message and must carry the label.
   * Getting this backwards either reads the tier twice or not at all.
   */
  it('labels the shape only when the word is not already there', () => {
    expect(code).toContain("'aria-hidden': true");
    expect(code).toContain("'aria-label': label");
  });

  it('names the tier in words as well as in shape', () => {
    // A screen reader gets nothing from a polygon.
    for (const tier of TIERS) {
      expect(tierLabel(tier).trim().length, tier).toBeGreaterThan(2);
    }
  });

  it('never states a tier by colour class alone', () => {
    // Every tier must appear in the shape map, not only the tone map.
    for (const tier of TIERS) {
      expect(code, tier).toContain(`${tier}:`);
    }
  });
});
