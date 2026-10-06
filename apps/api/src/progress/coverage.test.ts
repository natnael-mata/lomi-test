/**
 * Unit test — the coverage arithmetic (T-256).
 *
 * Every figure here reaches a student who is being asked to trust it, so the
 * cases that matter are the ones where a plausible implementation lies: no exam
 * date, the exam today, the exam passed, and a target already met.
 */
import { describe, expect, it } from 'vitest';

import {
  COVERAGE_TARGET_PCT,
  MIN_DAILY_QUESTIONS,
  coveragePct,
  daysUntil,
  planFor,
} from './coverage';

describe('coveragePct', () => {
  it('is beaten out of total, floored', () => {
    expect(coveragePct(100, 26)).toBe(26);
    expect(coveragePct(3900, 1000)).toBe(25);
  });

  /*
   * Floored, not rounded.
   *
   * 79.6% rounded to nearest reads 80 — the target — beside a count that says
   * otherwise. Two figures on one screen disagreeing is worse than one figure
   * being a fraction pessimistic.
   */
  it('never rounds up to the target', () => {
    expect(coveragePct(1000, 799)).toBe(79);
    expect(coveragePct(1000, 800)).toBe(80);
  });

  it('is zero rather than NaN when nothing is in the track', () => {
    expect(coveragePct(0, 0)).toBe(0);
  });
});

describe('planFor', () => {
  it('targets 80% of the bank, rounded up', () => {
    expect(COVERAGE_TARGET_PCT).toBe(80);
    expect(planFor(100, 0, 30).targetCount).toBe(80);
    // 3,900 × 0.8 is 3,120 exactly; 3,901 must not lose the extra question.
    expect(planFor(3901, 0, 30).targetCount).toBe(3121);
  });

  it('divides what is left across the days that are left', () => {
    // 80 to do, 20 days: 4 a day — but the floor lifts it, see below.
    const plan = planFor(3900, 0, 200);
    expect(plan.toTarget).toBe(3120);
    expect(plan.perDay).toBe(16);
  });

  /*
   * The floor.
   *
   * The September arithmetic is about three a day, which is five minutes. An
   * app that closes after five minutes has told the student it does not need
   * them, so the ask has a floor — while `toTarget` and `daysToExam` stay
   * untouched, so the division is still checkable on screen.
   */
  it('never asks for fewer than a session worth', () => {
    const plan = planFor(1310, 0, 300);
    expect(Math.ceil(1048 / 300)).toBe(4);
    expect(plan.perDay).toBe(MIN_DAILY_QUESTIONS);
    // The honest numbers behind it are unchanged.
    expect(plan.toTarget).toBe(1048);
  });

  /*
   * The floor never asks for more than is left.
   *
   * QA found it on the two smallest school tracks: a Grade 12 Social student
   * whose whole programme is 4 questions saw "1/12, 11 questions to go", and a
   * Grade 6 student (6 questions) saw "4/12". Twelve is a floor on effort, not
   * a count of questions that exist.
   */
  it('never sets a daily target above what is left', () => {
    // Grade 12 Social: 4 questions, target ceil(3.2) = 4, 3 beaten, 1 to go.
    const social = planFor(4, 3, 200);
    expect(social).toEqual({ targetCount: 4, toTarget: 1, perDay: 1 });

    // Grade 6: 6 questions, target ceil(4.8) = 5, 4 beaten, 1 to go.
    expect(planFor(6, 4, 200)).toEqual({ targetCount: 5, toTarget: 1, perDay: 1 });

    // Nothing beaten yet on a small track: the whole target, not twelve.
    expect(planFor(6, 0, 200).perDay).toBe(5);
    expect(planFor(4, 0, 30).perDay).toBe(4);
  });

  it('keeps the floor when exactly twelve or more are left', () => {
    // 15 questions, target 12, nothing beaten: the floor and the cap agree.
    expect(planFor(15, 0, 300).perDay).toBe(MIN_DAILY_QUESTIONS);
    // 11 left: one short of the floor, so the ask is the 11 that exist.
    expect(planFor(15, 1, 300).perDay).toBe(11);
  });

  it('never exceeds toTarget for any small programme', () => {
    for (let total = 1; total <= 20; total++) {
      for (let beaten = 0; beaten <= total; beaten++) {
        for (const days of [1, 2, 7, 30, 300]) {
          const plan = planFor(total, beaten, days);
          expect(plan.perDay, `${total}/${beaten}/${days}`).toBeLessThanOrEqual(plan.toTarget);
        }
      }
    }
  });

  it('asks for nothing more once the target is met', () => {
    const plan = planFor(100, 80, 30);
    expect(plan.toTarget).toBe(0);
    // Not the floor: twelve a day for somebody who has finished is a chore the
    // product invented.
    expect(plan.perDay).toBe(0);
  });

  it('counts past the target without going negative', () => {
    expect(planFor(100, 95, 30).toTarget).toBe(0);
  });

  /*
   * No date is not zero days.
   *
   * `perDay: null` is what the client renders as "unavailable". A zero here
   * would draw a full progress bar against the target — the one wrong answer
   * worse than showing nothing.
   */
  it('reports no daily target when no exam date is set', () => {
    const plan = planFor(1000, 100, null);
    expect(plan.perDay).toBeNull();
    expect(plan.toTarget).toBe(700);
  });

  it('asks for everything left on the day, and after it', () => {
    expect(planFor(100, 0, 0).perDay).toBe(80);
    // A resit is revised from the same bank; a negative daily target is not an
    // answer anybody can act on.
    expect(planFor(100, 0, -5).perDay).toBe(80);
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-08-22T09:30:00Z');

  it('counts whole days', () => {
    expect(daysUntil(new Date('2026-09-01T00:00:00Z'), now)).toBe(10);
    expect(daysUntil(new Date('2026-08-23T23:59:00Z'), now)).toBe(1);
  });

  /*
   * The countdown changes at midnight and only at midnight. Counting in hours
   * makes it read 43 in the morning and 42 the same afternoon, which is a
   * number nobody trusts twice.
   */
  it('does not move during the day', () => {
    const exam = new Date('2026-09-01T00:00:00Z');
    expect(daysUntil(exam, new Date('2026-08-22T00:01:00Z'))).toBe(
      daysUntil(exam, new Date('2026-08-22T23:59:00Z')),
    );
  });

  it('is zero on the day and negative after it', () => {
    expect(daysUntil(new Date('2026-08-22T18:00:00Z'), now)).toBe(0);
    expect(daysUntil(new Date('2026-08-20T00:00:00Z'), now)).toBe(-2);
  });

  it('is null when nobody has set a date', () => {
    expect(daysUntil(null, now)).toBeNull();
  });
});
