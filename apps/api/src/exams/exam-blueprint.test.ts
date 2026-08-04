import { describe, expect, it } from 'vitest';

import {
  assertBudgetsFitDuration,
  budgetSum,
  DEFAULT_BLUEPRINT,
  questionCount,
  slackSec,
  TIME_LIMIT_SEC,
} from './exam-blueprint';

const rows = (concept: number, calculation: number, override?: number[]) => [
  ...Array.from({ length: concept }, () => ({ timeLimitSec: TIME_LIMIT_SEC.CONCEPT })),
  ...Array.from({ length: calculation }, () => ({ timeLimitSec: TIME_LIMIT_SEC.CALCULATION })),
  ...(override ?? []).map((timeLimitSec) => ({ timeLimitSec })),
];

describe('the launch blueprint (T-119, T-121a)', () => {
  it('is 100 questions in 180 minutes', () => {
    expect(questionCount(DEFAULT_BLUEPRINT)).toBe(100);
    expect(DEFAULT_BLUEPRINT.durationSec).toBe(180 * 60);
  });

  it('uses D4’s budgets: one minute to recall, three to work out', () => {
    expect(TIME_LIMIT_SEC.CONCEPT).toBe(60);
    expect(TIME_LIMIT_SEC.CALCULATION).toBe(180);
  });

  // The equality is the point of the mix, not a coincidence.
  it('fills the sitting exactly: 60×60 + 40×180 = 10,800', () => {
    const paper = rows(DEFAULT_BLUEPRINT.conceptCount, DEFAULT_BLUEPRINT.calculationCount);
    expect(budgetSum(paper)).toBe(10_800);
    expect(budgetSum(paper)).toBe(DEFAULT_BLUEPRINT.durationSec);
    expect(slackSec(DEFAULT_BLUEPRINT.durationSec, paper)).toBe(0);
  });
});

describe('assertBudgetsFitDuration', () => {
  it('passes a paper that fits', () => {
    expect(assertBudgetsFitDuration(10_800, rows(60, 40))).toEqual([]);
  });

  it('passes a paper that comes in under time', () => {
    // Under is fine — a student may read a question twice. Over is not.
    expect(assertBudgetsFitDuration(10_800, rows(60, 39))).toEqual([]);
    expect(slackSec(10_800, rows(60, 39))).toBe(180);
  });

  // A 70/30 mix is 70×60 + 30×180 = 9,600 — under. The overrun case is the
  // other direction.
  it('reports an overrunning mix with its excess in seconds', () => {
    const overrun = rows(50, 50); // 50×60 + 50×180 = 12,000
    const blockers = assertBudgetsFitDuration(10_800, overrun);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('12,000s');
    expect(blockers[0]).toContain('over by 1,200s');
  });

  /**
   * The assertion that matters. Computed from the rows' OWN budgets, so a
   * reviewer patching one question to the gate's 600s ceiling is caught — a test
   * written against the counts and the two literals is an arithmetic identity
   * between constants and stays green while the student holds an unfinishable
   * paper.
   */
  it('catches one reviewer-patched question that breaks the sum', () => {
    const paper = [...rows(59, 40), { timeLimitSec: 600 }];
    expect(paper).toHaveLength(100);
    const blockers = assertBudgetsFitDuration(10_800, paper);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('over by 540s');
  });

  it('is exact at the boundary', () => {
    expect(assertBudgetsFitDuration(10_800, rows(60, 40))).toEqual([]);
    expect(assertBudgetsFitDuration(10_799, rows(60, 40))).toHaveLength(1);
  });

  it('handles an empty paper without inventing a problem', () => {
    expect(assertBudgetsFitDuration(10_800, [])).toEqual([]);
  });
});
