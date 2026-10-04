/**
 * Five weeks of activity, from the points ledger (redesign, § Progress).
 *
 * **There is no activity endpoint.** The handoff draws a five week grid
 * shaded by questions answered per day; the only per day record the API keeps
 * is the points ledger, where each answer earns an `answered` row stamped with
 * its Addis day. So the grid is counted from those rows, and drawn **only when
 * the page provably covers all five weeks**: a busy student's 200 row page can
 * stop days short, and the days past it would be drawn as empty although they
 * were studied. When it cannot vouch for them, it returns null and the screen
 * leaves the grid out. An endpoint that returns counts per day is the TODO
 * that lets every student see it.
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

/**
 * Thirty five cells, Monday first, ending on the Sunday of this week, or null
 * when the ledger page does not reach back far enough to be trusted.
 */
export function activityFrom(
  ledger: readonly { ruleId: string; day: string }[],
  now: number,
  pageSize: number,
): ActivityCell[] | null {
  const today = addisDay(now);
  // Monday of this week, in Addis: getUTCDay of the Addis date, Monday = 0.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisMonday = Date.parse(`${today}T00:00:00Z`) - weekday * DAY_MS;
  const first = thisMonday - 4 * 7 * DAY_MS;
  const firstDay = new Date(first).toISOString().slice(0, 10);

  const oldest = ledger.at(-1)?.day ?? null;
  const complete = ledger.length < pageSize || (oldest !== null && oldest < firstDay);
  if (!complete) return null;

  const counts = new Map<string, number>();
  for (const row of ledger) {
    if (row.ruleId === 'answered') counts.set(row.day, (counts.get(row.day) ?? 0) + 1);
  }

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
