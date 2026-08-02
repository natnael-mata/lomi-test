/**
 * A verifiable total (T-096).
 *
 * Renders the rows and a dark total bar — and **refuses to render at all** in
 * development if the rows do not sum to the total. That is the point: the bar is
 * a claim, and a claim the product cannot check is the decoration DESIGN.md
 * forbids.
 *
 * In production it renders anyway rather than white-screening a student over a
 * rounding error in one figure. A wrong total is bad; a blank results page is
 * worse, and the throw has already had every chance to be seen in development
 * and in CI.
 */
import { mismatchMessage, sumsTo, type TotalRow } from './total';

export interface TotalBarProps {
  rows: TotalRow[];
  total: number;
  totalLabel?: string | undefined;
  /** Rendered after each figure — "%", " Br". */
  unit?: string | undefined;
}

export function TotalBar({ rows, total, totalLabel = 'Total', unit = '' }: TotalBarProps) {
  const check = sumsTo(rows, total);

  if (!check.ok && process.env.NODE_ENV !== 'production') {
    throw new Error(mismatchMessage(check));
  }

  return (
    <div className="overflow-hidden rounded-card">
      <table className="w-full">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-border border-b last:border-b-0">
              <td className="text-body px-4 py-2.5">{row.label}</td>
              <td className="text-body num px-4 py-2.5 text-right">
                {row.value}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-ink text-surface">
            <td className="text-label px-4 py-3">{totalLabel}</td>
            <td className="text-label num px-4 py-3 text-right">
              {total}
              {unit}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
