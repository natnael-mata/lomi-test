import { describe, expect, it } from 'vitest';

import {
  ANSWERED_GLYPH,
  cellFor,
  cellsFor,
  FLAGGED_GLYPH,
  UNANSWERED_GLYPH,
  type SlotState,
} from './jump-grid';

const slot = (position: number, answered = false, flagged = false): SlotState => ({
  position,
  answered,
  flagged,
});

describe('cellFor (T-127)', () => {
  /**
   * The assertion that matters. DESIGN.md requires answered, flagged and current
   * to be distinguishable **by shape or icon, not colour alone** — one in twelve
   * men has a colour vision deficiency, and a student scanning for "what have I
   * not done" is doing it under time pressure.
   */
  it('gives every state its own non-colour marker', () => {
    expect(cellFor(slot(1), 99).glyph).toBe(UNANSWERED_GLYPH);
    expect(cellFor(slot(2, true), 99).glyph).toBe(ANSWERED_GLYPH);
    expect(cellFor(slot(3, false, true), 99).glyph).toBe(FLAGGED_GLYPH);

    const glyphs = [UNANSWERED_GLYPH, ANSWERED_GLYPH, FLAGGED_GLYPH];
    expect(new Set(glyphs).size).toBe(3);
  });

  // A student flags a question precisely because they mean to come back to it,
  // so it must stay findable once answered.
  it('keeps the flag visible on an answered question', () => {
    const cell = cellFor(slot(4, true, true), 99);
    expect(cell.glyph).toBe(FLAGGED_GLYPH);
    expect(cell.answered).toBe(true);
    expect(cell.flagged).toBe(true);
  });

  it('marks the current cell without changing its glyph', () => {
    const elsewhere = cellFor(slot(5, true), 99);
    const here = cellFor(slot(5, true), 5);
    expect(here.current).toBe(true);
    expect(elsewhere.current).toBe(false);
    // Current is conveyed by outline and underline, not by a different symbol,
    // so it composes with whatever the answered/flagged state already is.
    expect(here.glyph).toBe(elsewhere.glyph);
  });

  describe('the accessible label', () => {
    it('says the state in words, never a colour', () => {
      expect(cellFor(slot(7), 99).label).toBe('Question 7, not answered');
      expect(cellFor(slot(8, true), 99).label).toBe('Question 8, answered');
      expect(cellFor(slot(9, true, true), 9).label).toBe('Question 9, answered, flagged, current');
    });

    it('names no colour anywhere', () => {
      const labels = [
        cellFor(slot(1), 1),
        cellFor(slot(2, true), 1),
        cellFor(slot(3, false, true), 1),
        cellFor(slot(4, true, true), 4),
      ].map((c) => c.label.toLowerCase());
      // Whole words only. The first version of this test failed on "answe(red)",
      // which is the sort of false positive that gets a real check deleted.
      for (const label of labels) {
        for (const colour of ['green', 'red', 'yellow', 'amber', 'grey', 'gray', 'blue']) {
          expect(label, `"${colour}" in "${label}"`).not.toMatch(new RegExp(`\\b${colour}\\b`));
        }
      }
    });
  });
});

describe('cellsFor', () => {
  it('maps a whole paper, marking exactly one cell current', () => {
    const slots = [slot(1, true), slot(2), slot(3, false, true), slot(4)];
    const cells = cellsFor(slots, 3);
    expect(cells).toHaveLength(4);
    expect(cells.filter((c) => c.current)).toHaveLength(1);
    expect(cells.find((c) => c.current)?.position).toBe(3);
  });

  it('marks none current when the position is off the paper', () => {
    expect(cellsFor([slot(1), slot(2)], 99).filter((c) => c.current)).toHaveLength(0);
  });
});
