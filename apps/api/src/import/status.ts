/**
 * The `status` column: the content workflow's flag, per CONTENT-PIPELINE.md §2.
 *
 * One cell can carry several flags joined by `;` — `needs_answer;needs_explanation`
 * is a question that arrived with neither an answer nor a rationale. So this
 * returns a list, never a single value.
 *
 * Nothing here decides what is servable. `ready` in a CSV is a **claim by the
 * source file**, not a grant: the importer refuses to publish whatever the cell
 * says (T-054), and the publish gate is what actually decides (T-040…T-046).
 */
import { IMPORT_STATUSES, type ImportStatus } from './csv-schema';

const KNOWN = new Set<string>(IMPORT_STATUSES);
const ORDER = new Map(IMPORT_STATUSES.map((s, i) => [s, i]));

/** Flags that assert work is still outstanding. `ready` contradicts all of them. */
export const NEEDS_WORK_STATUSES = IMPORT_STATUSES.filter((s) =>
  s.startsWith('needs_'),
) as readonly ImportStatus[];

export interface StatusParse {
  /** Recognised flags, deduped, in canonical order. */
  statuses: ImportStatus[];
  /** Values that are not in the vocabulary — kept verbatim so a report can name them. */
  unknown: string[];
  /**
   * `ready` alongside a `needs_*` flag. Not an error: the row still imports, and
   * `ready` is not honoured anyway. It is surfaced because a file that says both
   * is a file whose author lost track, and the run report should say so.
   */
  contradictions: string[];
}

/**
 * Parses one `status` cell.
 *
 * A blank cell yields `['raw']`. Blank means the source file did not say, and
 * `raw` is the one flag that claims nothing about quality — the safe reading.
 * Guessing `ready` from silence is how an unreviewed question reaches a student.
 */
export function parseStatuses(raw: string): StatusParse {
  const parts = raw
    .split(';')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '');

  if (parts.length === 0) return { statuses: ['raw'], unknown: [], contradictions: [] };

  const statuses: ImportStatus[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    if (!KNOWN.has(part)) {
      // Deduped too: a file repeating the same typo should not repeat the report line.
      if (!unknown.includes(part)) unknown.push(part);
      continue;
    }
    const known = part as ImportStatus;
    if (!statuses.includes(known)) statuses.push(known);
  }

  // Canonical order, not file order: two rows carrying the same flags in a
  // different sequence must compare equal.
  statuses.sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);

  const contradictions: string[] = [];
  if (statuses.includes('ready')) {
    const outstanding = statuses.filter((s) => NEEDS_WORK_STATUSES.includes(s));
    if (outstanding.length > 0) {
      contradictions.push(`"ready" alongside ${outstanding.join(', ')}`);
    }
  }

  // Every value was unrecognised — the cell said something, none of it usable.
  if (statuses.length === 0) statuses.push('raw');

  return { statuses, unknown, contradictions };
}

/**
 * Whether the source file *claims* this row is finished.
 *
 * Named `claims`, not `is`: it is an assertion by a spreadsheet, and it grants
 * nothing. Callers that publish on the strength of this are the bug T-054 exists
 * to prevent.
 */
export function claimsReady(statuses: readonly ImportStatus[]): boolean {
  return statuses.includes('ready') && !statuses.some((s) => NEEDS_WORK_STATUSES.includes(s));
}
