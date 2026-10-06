/**
 * Five weeks of activity (redesign, § Progress).
 *
 * Counted on the server by `GET /me/activity`, one figure per Addis day. It
 * used to be counted here from the 200 row points ledger page, which ran out
 * days short of five weeks for a busy student, so the grid was hidden from
 * the students with the most to show. The server now counts every day however
 * much was answered, and the grid is always drawn.
 */
import { addisDay, DAY_MS } from '../lib/addis-day';

export interface ActivityCell {
  day: string;
  answered: number;
  /** Later than today: drawn as a placeholder, never as "nothing done". */
  future: boolean;
  today: boolean;
}

/** The thresholds, stated so a shade can be checked against them. */
export function levelOf(answered: number): 0 | 1 | 2 | 3 {
  if (answered === 0) return 0;
  if (answered <= 5) return 1;
  if (answered <= 11) return 2;
  // Twelve is the smallest daily target the product sets (MIN_DAILY_QUESTIONS).
  return 3;
}

/** Days asked of the server: enough to reach back to the grid's first Monday. */
export const ACTIVITY_DAYS = 35;

/** Thirty five cells, Monday first, ending on the Sunday of this week. */
export function activityFrom(
  days: readonly { day: string; answered: number }[],
  now: number,
): ActivityCell[] {
  const today = addisDay(now);
  // Monday of this week, in Addis: getUTCDay of the Addis date, Monday = 0.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisMonday = Date.parse(`${today}T00:00:00Z`) - weekday * DAY_MS;
  const first = thisMonday - 4 * 7 * DAY_MS;

  const counts = new Map(days.map((d) => [d.day, d.answered]));

  return Array.from({ length: 35 }, (_, i) => {
    const day = new Date(first + i * DAY_MS).toISOString().slice(0, 10);
    return {
      day,
      answered: counts.get(day) ?? 0,
      future: day > today,
      today: day === today,
    };
  });
}
