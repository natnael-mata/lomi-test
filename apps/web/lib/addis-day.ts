/**
 * The calendar day the API files activity under.
 *
 * Addis Ababa is UTC+3 all year, and the points ledger stamps every row with
 * the Addis date (`dayOf` in `apps/api/src/engagement/points.ts`). A screen
 * that groups ledger rows by the browser's own local date disagrees with the
 * ledger for three hours every night, so both Today and Progress group by this.
 */
export const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` in Addis, for an instant in milliseconds. */
export function addisDay(at: number): string {
  return new Date(at + ADDIS_OFFSET_MS).toISOString().slice(0, 10);
}
