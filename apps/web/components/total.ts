/**
 * The Total Rule (T-096), as arithmetic.
 *
 * DESIGN.md: "A row of figures that genuinely sums ends in a dark total bar. A
 * figure that is derived rather than summed uses the *stated* treatment on
 * Surface 2 instead, with a chip naming how it was derived. A total nobody can
 * verify is decoration, and this product cannot afford decorative numbers."
 *
 * So the two treatments are not styling choices. `<TotalBar>` is a **claim that
 * these rows add up**, and this module is what makes that claim checkable.
 */

/** Money and weights are compared in integer hundredths — see `sumsTo`. */
const SCALE = 100;

export interface TotalRow {
  label: string;
  value: number;
}

export interface SumCheck {
  ok: boolean;
  sum: number;
  total: number;
  difference: number;
}

/**
 * Whether the rows sum to the total.
 *
 * Compared as **integers in hundredths**, not as floats. `0.1 + 0.2 !== 0.3`,
 * and three topic weights of `33.33` sum to `99.99` — a bar that rejects real
 * data because of binary floating point would simply be turned off. The same
 * reasoning as `taxonomy/weights.ts` on the server (T-024).
 */
export function sumsTo(rows: readonly TotalRow[], total: number): SumCheck {
  const scaled = rows.reduce((acc, row) => acc + Math.round(row.value * SCALE), 0);
  const target = Math.round(total * SCALE);
  return {
    ok: scaled === target,
    sum: scaled / SCALE,
    total,
    difference: (scaled - target) / SCALE,
  };
}

/**
 * The message shown when a total does not add up.
 *
 * Names the gap and its direction, because "does not sum" leaves whoever sees it
 * counting by hand.
 */
export function mismatchMessage(check: SumCheck): string {
  const direction = check.difference > 0 ? 'over' : 'short';
  return (
    `TotalBar rows sum to ${check.sum}, not ${check.total} ` +
    `(${Math.abs(check.difference)} ${direction}). ` +
    'A total bar claims its rows add up; use StatedFigure for a derived figure.'
  );
}
