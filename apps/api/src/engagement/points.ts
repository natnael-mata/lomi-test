/**
 * What points are awarded for, and what a streak survives (T-190, T-191).
 *
 * No database, no clock of its own — every function here takes the day it is
 * reasoning about, so the awkward cases can be tested rather than waited for.
 *
 * **Two product commitments are encoded here rather than left to a caller.**
 *
 * The first: *points copy always names its source* (PRODUCT.md). A ledger row
 * that says "+10" and nothing else is a number a student cannot check and cannot
 * argue with, which makes it worthless as motivation and impossible to support.
 * So a rule is not a number — it is a number **and** the sentence that explains
 * it, and `RULES` is the only place either exists.
 *
 * The second: *a missed day adjusts the plan; it does not break a streak.*
 * That is not leniency, it is the whole difference between this product and the
 * ones it is competing with. A student revising for a national exam will miss
 * days — to illness, to family, to a power cut — and a streak that resets is a
 * product telling somebody who already feels behind that they are back to zero.
 * The streak here counts **days engaged**, and nothing takes it away.
 */

/** A rule is a number and the sentence that explains it. Never one without the other. */
export interface PointRule {
  id: string;
  points: number;
  /**
   * Second person, active, and it names the cause.
   *
   * Written as a function of the occasion where the number varies, so the copy
   * and the award cannot drift apart.
   */
  reason: (context?: { count?: number; topic?: string }) => string;
}

export const RULES = {
  ANSWERED: {
    id: 'answered',
    points: 1,
    reason: () => 'You answered a question.',
  },
  CORRECT: {
    id: 'correct',
    points: 2,
    reason: () => 'You got a question right.',
  },
  /**
   * Deliberately worth more than a single right answer and less than a mock.
   *
   * The behaviour worth rewarding is *coming back*, not answering a lot in one
   * sitting — a student who does ten minutes a day for a month is better
   * prepared than one who does five hours the night before, and the points
   * should say so.
   */
  DAILY_RETURN: {
    id: 'daily-return',
    points: 5,
    reason: () => 'You came back today.',
  },
  MOCK_COMPLETED: {
    id: 'mock-completed',
    points: 25,
    reason: () => 'You sat a full mock exam.',
  },
  /**
   * The zero-point row (T-191).
   *
   * **It exists precisely because it is worth nothing.** A missed day is not an
   * award and must not be padded into one, but the ledger is the record of what
   * happened, and a gap with no row in it reads as "we did not notice" — or
   * worse, gets filled in later by somebody assuming a streak reset. Writing a
   * zero says: we saw, nothing was taken away, the plan moved.
   */
  PLAN_ADJUSTED: {
    id: 'plan-adjusted',
    points: 0,
    reason: (context) =>
      context?.count && context.count > 1
        ? `You were away for ${context.count} days. Your plan has been adjusted — nothing is lost.`
        : 'You were away a day. Your plan has been adjusted — nothing is lost.',
  },
} as const satisfies Record<string, PointRule>;

export type RuleId = (typeof RULES)[keyof typeof RULES]['id'];

/** Every rule, for the guard that checks none of them is nameless. */
export const ALL_RULES: readonly PointRule[] = Object.values(RULES);

/** A row as it will be written. Both fields are required, and that is T-190. */
export interface LedgerEntry {
  ruleId: RuleId;
  points: number;
  reason: string;
}

/**
 * Builds a ledger row from a rule.
 *
 * The only way to make one. A caller that could pass its own number and its own
 * sentence is a caller that will one day pass a number without a sentence — and
 * "every row names its source" would become a convention rather than a fact.
 */
export function award(rule: PointRule, context?: { count?: number; topic?: string }): LedgerEntry {
  return {
    ruleId: rule.id as RuleId,
    points: rule.points,
    reason: rule.reason(context),
  };
}

/** A calendar day in Addis, as `YYYY-MM-DD`. */
export type Day = string;

/**
 * The day an instant falls on, in **Ethiopian local time**.
 *
 * A student answering at 01:00 in Addis is having a late night, not an early
 * morning, and a UTC day boundary would put that answer on the wrong day —
 * which matters here because days are what the streak counts. UTC+3 has no
 * daylight saving, so the offset is a constant rather than a timezone database.
 */
const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export function dayOf(instant: Date): Day {
  return new Date(instant.getTime() + ADDIS_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole days between two calendar days. Negative if `b` is before `a`. */
export function daysBetween(a: Day, b: Day): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export interface StreakState {
  /** Days on which this student did something. Never decreases. */
  days: number;
  lastActiveDay: Day | null;
}

/**
 * The streak after a day's activity (T-191).
 *
 * **It counts days engaged, and nothing takes it away.** There is no branch here
 * that resets it, and that absence is the feature — a student revising for a
 * national exam will miss days, and a product that zeroes their progress for
 * being ill is telling somebody who already feels behind that they are back to
 * the start.
 *
 * Two visits on one day are one day. The streak measures returning, not volume.
 */
export function extendStreak(state: StreakState, today: Day): StreakState {
  if (state.lastActiveDay === today) return state;
  return { days: state.days + 1, lastActiveDay: today };
}

/**
 * The rows to write when a student comes back after being away (T-191).
 *
 * Returns the `plan-adjusted` row **and nothing else about the gap**: no
 * penalty, no reset, no "you lost" anything. The streak is extended by the
 * return itself, through `extendStreak`, which has no branch for how long the
 * gap was.
 *
 * A same-day or next-day return produces no row at all — there is no gap to
 * acknowledge, and a message about nothing is noise.
 */
export function entriesForReturn(state: StreakState, today: Day): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  if (state.lastActiveDay === today) return entries;

  entries.push(award(RULES.DAILY_RETURN));

  const gap = state.lastActiveDay === null ? 0 : daysBetween(state.lastActiveDay, today) - 1;
  if (gap > 0) entries.push(award(RULES.PLAN_ADJUSTED, { count: gap }));

  return entries;
}

/** Badge tiers. Shape is decided in the UI; the thresholds are decided here. */
export const TIERS = [
  { id: 'NONE', minPoints: 0 },
  { id: 'BRONZE', minPoints: 50 },
  { id: 'SILVER', minPoints: 200 },
  { id: 'GOLD', minPoints: 600 },
  { id: 'PLATINUM', minPoints: 1500 },
] as const;

export type TierId = (typeof TIERS)[number]['id'];

export function tierFor(points: number): TierId {
  let tier: TierId = 'NONE';
  for (const candidate of TIERS) {
    if (points >= candidate.minPoints) tier = candidate.id;
  }
  return tier;
}

/**
 * Points still needed for the next tier, or `null` at the top.
 *
 * Shown rather than the raw threshold because "38 points to Bronze" is a
 * distance somebody can act on and "50 points for Bronze" is a fact they then
 * have to do arithmetic on.
 */
export function pointsToNextTier(points: number): number | null {
  const next = TIERS.find((tier) => tier.minPoints > points);
  return next ? next.minPoints - points : null;
}
