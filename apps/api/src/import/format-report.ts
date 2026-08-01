/**
 * Renders an import report for a human.
 *
 * Kept separate from the service and pure, because the thing that matters about
 * a run report is what it says, and that deserves testing without a database.
 *
 * The shape is deliberately blunt: the counts first, then every row that needs
 * attention, each with its reason. A report that only says "7 rows imported" is
 * the kind that gets skimmed, and the rejected row nobody read is a question
 * that silently never made it into the bank.
 */
import type { ImportReport, RowOutcome } from './import.service';

export function formatReport(report: ImportReport): string {
  const lines: string[] = [];

  lines.push(
    `read ${report.read} · created ${report.created} · updated ${report.updated} · rejected ${report.rejected}`,
  );

  const rejected = report.rows.filter((r) => r.action === 'rejected');
  if (rejected.length > 0) {
    lines.push('', `rejected (${rejected.length}) — not imported:`);
    for (const row of rejected) lines.push(...bullets(row));
  }

  const noted = report.rows.filter((r) => r.action !== 'rejected' && r.messages.length > 0);
  if (noted.length > 0) {
    // A note that fires on most rows is a fact about the file, not about a row.
    // Printed per-row it buries the handful of rows that need a human, which is
    // the only reason this report exists.
    const common = repeatedMessages(noted);
    const perRow = noted
      .map((r) => ({ ...r, messages: r.messages.filter((m) => !common.has(m)) }))
      .filter((r) => r.messages.length > 0);

    lines.push('', `imported with notes (${noted.length}):`);
    for (const [message, count] of common) lines.push(`  ${count} rows: ${message}`);
    for (const row of perRow) lines.push(...bullets(row));
  }

  if (rejected.length === 0 && noted.length === 0) lines.push('', 'nothing to report.');

  return lines.join('\n');
}

/** Messages shared by enough rows to be worth stating once. */
const COLLAPSE_AT = 4;

function repeatedMessages(rows: readonly RowOutcome[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const message of row.messages) counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return new Map([...counts].filter(([, n]) => n >= COLLAPSE_AT));
}

function bullets(row: RowOutcome): string[] {
  return [`  ${row.stableId}`, ...row.messages.map((m) => `    - ${m}`)];
}
