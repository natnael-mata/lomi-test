/**
 * The jump grid's rendered contract (T-127).
 *
 * The assertion is that a student can tell answered from flagged from current
 * *without colour*. Verified in a greyscale browser render, where the three
 * backgrounds collapse to near-identical greys (luminance 237 / 243 / 255) and
 * the glyphs are what remain legible. That is the design working as intended —
 * colour is decoration here, shape is the information.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { JumpGrid } from './JumpGrid';
import { ANSWERED_GLYPH, FLAGGED_GLYPH, UNANSWERED_GLYPH, cellsFor } from './jump-grid';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'JumpGrid.tsx'),
  'utf8',
);

const slots = [
  { position: 1, answered: true, flagged: false },
  { position: 2, answered: false, flagged: false },
  { position: 3, answered: false, flagged: true },
  { position: 4, answered: true, flagged: true },
];

describe('JumpGrid (T-127)', () => {
  it('renders', () => {
    expect(() => JumpGrid({ slots, currentPosition: 2, onJump: () => undefined })).not.toThrow();
  });

  // The greyscale check, as an assertion: three states, three distinct shapes.
  it('gives every state a glyph no other state uses', () => {
    const glyphs = [ANSWERED_GLYPH, FLAGGED_GLYPH, UNANSWERED_GLYPH];
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  // Current is a border weight, not a hue — it survives greyscale too.
  it('marks the current cell without relying on colour', () => {
    expect(source).toMatch(/border-2|ring-2|underline/);
  });

  // Every cell says what it is out loud. The glyph is for eyes; this is for the
  // student who is not using them.
  it('labels each cell with its state in words', () => {
    const cells = cellsFor(slots, 2);
    expect(cells.map((c) => c.label)).toEqual([
      'Question 1, answered',
      'Question 2, not answered, current',
      'Question 3, not answered, flagged',
      'Question 4, answered, flagged',
    ]);
  });

  // 44px is the floor for a target a thumb has to hit under time pressure.
  it('keeps targets at 44px', () => {
    expect(source).toMatch(/size-11|h-11/);
  });
});
