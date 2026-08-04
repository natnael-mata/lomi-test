/**
 * What a mock paper is made of, and whether it fits in the time allowed.
 *
 * Pure, like `publish-gate.ts` and `weights.ts`: the arithmetic that decides
 * whether a student gets a finishable paper deserves tests that run in
 * milliseconds and never touch a database.
 */
import type { QType } from '@prisma/client';

/**
 * D4's per-question budgets: one minute to recall, three to work something out.
 *
 * This is the single definition. `import/map-row.ts` re-exports it rather than
 * repeating the literals — two copies of a number that must agree with
 * `Exam.durationSec` is how a paper stops summing without anyone editing it.
 */
export const TIME_LIMIT_SEC: Record<QType, number> = {
  CONCEPT: 60,
  CALCULATION: 180,
};

/**
 * The launch mock: 100 questions in 3 hours (decision D4).
 *
 * 60 × 60s + 40 × 180s = 10,800s = exactly 180 minutes. That equality is the
 * point of the mix, not a coincidence — see `assertBudgetsFitDuration`.
 */
export const DEFAULT_BLUEPRINT = {
  conceptCount: 60,
  calculationCount: 40,
  durationSec: 10800,
} as const;

export interface Blueprint {
  conceptCount: number;
  calculationCount: number;
  durationSec: number;
}

/** A question as the sampler sees it: enough to place it and to time it. */
export interface PoolQuestion {
  id: string;
  topicId: string;
  qType: QType;
  timeLimitSec: number;
}

export const questionCount = (blueprint: Blueprint): number =>
  blueprint.conceptCount + blueprint.calculationCount;

export const budgetSum = (rows: readonly { timeLimitSec: number }[]): number =>
  rows.reduce((total, row) => total + row.timeLimitSec, 0);

/**
 * Do these questions actually fit in the sitting?
 *
 * Computed from **the sampled rows' own `timeLimitSec`**, never from the mix and
 * the two literals. A reviewer may patch any question's budget to anything
 * between 15 and 600 seconds, so a paper of 60 concept and 40 calculation
 * questions can still overrun badly — and a test written against the counts
 * passes while the student holds an unfinishable paper.
 *
 * Returns a list, like the publish gate: whoever is building a paper wants
 * everything wrong with it at once.
 */
export function assertBudgetsFitDuration(
  durationSec: number,
  rows: readonly { timeLimitSec: number }[],
): string[] {
  const total = budgetSum(rows);
  if (total <= durationSec) return [];
  return [
    `The sampled questions need ${total.toLocaleString('en')}s but the sitting is ` +
      `${durationSec.toLocaleString('en')}s — over by ${(total - durationSec).toLocaleString('en')}s.`,
  ];
}

/**
 * How much of the sitting the paper leaves unclaimed.
 *
 * Reported rather than enforced: a paper that comes in under time is fine — a
 * student may read the question twice — while one that comes in over is not.
 */
export const slackSec = (durationSec: number, rows: readonly { timeLimitSec: number }[]): number =>
  durationSec - budgetSum(rows);
