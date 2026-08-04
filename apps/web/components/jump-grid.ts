/**
 * The state of one cell in the exam's jump grid (T-127).
 *
 * DESIGN.md: answered, flagged and current must be distinguishable **by shape or
 * icon, not by colour alone**. Roughly one in twelve men has a colour vision
 * deficiency, this product is read on cheap screens in daylight, and a student
 * scanning for "what have I not done" is doing it under time pressure — three
 * tints of the same hue is precisely the wrong answer.
 */

export interface SlotState {
  position: number;
  answered: boolean;
  flagged: boolean;
}

export interface CellView {
  position: number;
  answered: boolean;
  flagged: boolean;
  current: boolean;
  /**
   * The non-colour marker. Every distinguishable state has one, so the grid
   * still reads in greyscale:
   *   ·  answered — a filled dot
   *   ⚑  flagged  — a pennant
   *   ○  neither  — an open ring
   * The current cell adds a ring outline and an underline, not a hue.
   */
  glyph: string;
  /** What a screen reader says. Never "green" or "yellow". */
  label: string;
}

export const ANSWERED_GLYPH = '●';
export const FLAGGED_GLYPH = '⚑';
export const UNANSWERED_GLYPH = '○';

export function cellFor(slot: SlotState, currentPosition: number): CellView {
  const current = slot.position === currentPosition;
  // Flagged wins the glyph: a student flags a question precisely because they
  // mean to come back to it, so it must stay findable even once answered.
  const glyph = slot.flagged ? FLAGGED_GLYPH : slot.answered ? ANSWERED_GLYPH : UNANSWERED_GLYPH;

  const parts = [`Question ${slot.position}`];
  parts.push(slot.answered ? 'answered' : 'not answered');
  if (slot.flagged) parts.push('flagged');
  if (current) parts.push('current');

  return {
    position: slot.position,
    answered: slot.answered,
    flagged: slot.flagged,
    current,
    glyph,
    label: parts.join(', '),
  };
}

export const cellsFor = (slots: readonly SlotState[], currentPosition: number): CellView[] =>
  slots.map((slot) => cellFor(slot, currentPosition));
