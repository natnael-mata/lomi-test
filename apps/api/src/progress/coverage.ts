/**
 * Coverage, and the daily target derived from it (T-256).
 *
 * **Coverage replaces the weighted mean as the headline.** Of the questions in
 * your track, how many have you beaten, against a target of 80%. It is a count
 * of things done out of things to do, which is a sentence a fifteen-year-old
 * can check against the screen; a weighted mean of per-topic percentages is
 * not, and the product's own rule is that every figure must be checkable.
 *
 * Pure, no clock of its own: `daysToExam` arrives already computed, so the
 * awkward cases — the exam is tomorrow, the exam was yesterday, nobody has set
 * a date — are tested rather than waited for.
 *
 * **Integer arithmetic throughout.** Counts are things, not measurements, and
 * a student who adds up the per-subject rows expects them to equal the total.
 */

/** The share of a track worth being ready. */
export const COVERAGE_TARGET_PCT = 80;

/**
 * The smallest daily target the product will set.
 *
 * At the September start the honest arithmetic gives 3 a day, which is about
 * five minutes at the stated pacing budget — too small to build a habit, and an
 * app that says "today is closed" after five minutes has taught the student
 * that it does not need them. Twelve turns the message from *done* into "you
 * are nine ahead of pace", which front-loads coverage and reads better on the
 * day somebody is looking for a reason to stop.
 *
 * It is a floor on the *ask*, never on the arithmetic: `toTarget` and
 * `daysToExam` are reported unchanged so the number can still be checked.
 *
 * **And it never asks for more than is left.** A small programme can have
 * fewer than twelve questions still to beat: a Grade 12 Social student whose
 * whole track holds four questions was shown "1/12, 11 questions to go" when
 * one was left, and a Grade 6 student "4/12" against a track of six. Eleven
 * questions that do not exist is a target nobody can meet, so the floor is
 * capped at `toTarget`.
 */
export const MIN_DAILY_QUESTIONS = 12;

export interface CoveragePlan {
  /** Questions that must be beaten to reach the target — `ceil(total × 80%)`. */
  targetCount: number;
  /** How many of those are still to go. Never negative. */
  toTarget: number;
  /**
   * Questions a day to arrive on time, or **null when there is no date**.
   *
   * Null rather than zero, and this is the difference the client renders as
   * "unavailable": a zero against a target draws a full progress bar, which is
   * the one wrong answer worse than no answer at all.
   */
  perDay: number | null;
}

/**
 * Whole percent of `total` that has been beaten, rounded down.
 *
 * Down, not nearest: rounding 79.6 up to 80 would tell a student they had hit
 * the target while the count says otherwise, and the two are on the same screen.
 */
export function coveragePct(total: number, beaten: number): number {
  if (total <= 0) return 0;
  return Math.floor((Math.min(beaten, total) * 100) / total);
}

export function planFor(total: number, beaten: number, daysToExam: number | null): CoveragePlan {
  const targetCount = Math.ceil((total * COVERAGE_TARGET_PCT) / 100);
  const toTarget = Math.max(0, targetCount - beaten);

  if (toTarget === 0) {
    // At or past the target. The floor is a nudge for somebody with work left,
    // not a chore invented for somebody who has finished it.
    return { targetCount, toTarget, perDay: daysToExam === null ? null : 0 };
  }
  if (daysToExam === null) return { targetCount, toTarget, perDay: null };

  /*
   * The exam is today, or has been and gone.
   *
   * Dividing by zero or a negative gives Infinity or a negative daily target,
   * both of which would reach the screen. The honest answer on the last day is
   * "everything that is left", and it is also the answer on the day after —
   * a student revising for a resit is still working from the same bank.
   */
  if (daysToExam <= 0) return { targetCount, toTarget, perDay: toTarget };

  const perDay = Math.ceil(toTarget / daysToExam);
  // `perDay` is already at most `toTarget`, so capping the floor is enough to
  // keep the ask inside what is left.
  return {
    targetCount,
    toTarget,
    perDay: Math.max(Math.min(MIN_DAILY_QUESTIONS, toTarget), perDay),
  };
}

/**
 * Whole days from now to the exam, or null when no date is set.
 *
 * Counted in whole days rather than hours: a countdown that says "43 days" in
 * the morning and "42 days" the same afternoon is a countdown nobody trusts.
 * Both instants are floored to their day first, so the number changes at
 * midnight and only at midnight.
 */
export function daysUntil(examDate: Date | null, now: Date): number | null {
  if (examDate === null) return null;
  const day = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((day(examDate) - day(now)) / 86_400_000);
}
