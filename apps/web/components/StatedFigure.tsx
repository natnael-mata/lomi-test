/**
 * A figure that is derived rather than summed (T-096).
 *
 * The counterpart to `<TotalBar>`, and deliberately a different component rather
 * than a variant of it. A readiness percentage is a weighted mean, not a column
 * that adds up; dressing it in a total bar tells a student it was arrived at by
 * addition they could redo, and it was not.
 *
 * Surface 2 rather than the dark bar, and **the derivation chip is required** —
 * that is what makes it stated rather than merely asserted. A number with no
 * account of where it came from is the decoration DESIGN.md forbids.
 */
import { Chip } from './Chip';

export interface StatedFigureProps {
  label: string;
  value: string;
  /** How it was derived — "weighted mean of 6 topics", "share of past papers". */
  derivation: string;
}

export function StatedFigure({ label, value, derivation }: StatedFigureProps) {
  return (
    <div className="bg-surface-2 rounded-card p-4">
      <p className="text-caption text-ink-2 uppercase">{label}</p>
      <p className="text-display num mt-1">{value}</p>
      <Chip className="mt-2">{derivation}</Chip>
    </div>
  );
}
