/**
 * The live sum indicator on the weight editor (T-162a).
 *
 * Weights must total exactly 100 (T-024), and the editor is where a reviewer
 * breaks that — every override moves the other topics, and it is entirely
 * possible to leave a field at 97 or 104 and not notice.
 *
 * **So the indicator names the shortfall rather than reporting a state.** "Not
 * balanced" tells a reviewer they have a problem; "3% short" tells them what to
 * type. The difference is whether the screen is a warning or an instruction, and
 * DESIGN.md's rule on the destructive control says the same thing about blast
 * radius: a number an operator can act on beats a summary they skim.
 */

/** Weights are whole percent; the total must land exactly here. */
export const WEIGHT_TOTAL = 100;

export interface WeightRow {
  topicId: string;
  topicName: string;
  weightPct: number;
}

export type SumState = 'balanced' | 'short' | 'over';

export interface WeightSum {
  total: number;
  state: SumState;
  /** How far off, always positive. Zero when balanced. */
  differencePct: number;
  /** What the indicator says. Complete sentence — it is read on its own. */
  message: string;
}

/**
 * Adds the weights up and says what is wrong, if anything.
 *
 * Integer arithmetic throughout: `weightPct` is whole percent by the time it
 * reaches here, and the reason `assertWeightsSumTo100` works in hundredths on
 * the server is that a float column would sum to 99.99999999999999 and fail a
 * check that should pass. The same trap applies to a running total on screen.
 */
export function weightSum(rows: readonly WeightRow[]): WeightSum {
  const total = rows.reduce((sum, row) => sum + Math.round(row.weightPct), 0);

  if (total === WEIGHT_TOTAL) {
    return {
      total,
      state: 'balanced',
      differencePct: 0,
      message: `Weights total ${WEIGHT_TOTAL}%.`,
    };
  }

  const difference = Math.abs(WEIGHT_TOTAL - total);
  const state: SumState = total < WEIGHT_TOTAL ? 'short' : 'over';
  return {
    total,
    state,
    differencePct: difference,
    // Names the gap and the total, so a reviewer can check the arithmetic
    // against the rows above without doing it themselves.
    message:
      state === 'short'
        ? `Weights total ${total}% — ${difference}% short of ${WEIGHT_TOTAL}%.`
        : `Weights total ${total}% — ${difference}% over ${WEIGHT_TOTAL}%.`,
  };
}

/**
 * Whether an override is a number the server will accept.
 *
 * Checked here as well as on the server so a reviewer is told before they lose
 * what they typed, not after. The server remains the authority — this is a
 * courtesy, and a client-side check that were the only one would be a hole.
 */
export function validateOverride(
  weightPct: number,
  reason: string,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isInteger(weightPct) || weightPct < 0 || weightPct > 100) {
    return { ok: false, message: 'A weight is a whole number from 0 to 100.' };
  }
  if (reason.trim().length === 0) {
    // Required, and the message says why rather than just that it is.
    return {
      ok: false,
      message: 'Say why. An override with no reason is a typo to whoever reads it next.',
    };
  }
  return { ok: true };
}
