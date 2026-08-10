/**
 * Points and streaks (T-190, T-191).
 *
 * Two of these tests are about a product commitment rather than an algorithm,
 * and they are the ones worth keeping: every row names its source, and nothing
 * a student does — or fails to do — takes a streak away.
 */
import { describe, expect, it } from 'vitest';

import {
  ALL_RULES,
  RULES,
  TIERS,
  award,
  dayOf,
  daysBetween,
  entriesForReturn,
  extendStreak,
  pointsToNextTier,
  tierFor,
  type StreakState,
} from './points';

describe('every award names its source (T-190)', () => {
  /** T-190's stated test, over the whole rule set rather than a sample. */
  it('gives every rule a non-empty reason and a rule id', () => {
    expect(ALL_RULES.length).toBeGreaterThan(3);
    for (const rule of ALL_RULES) {
      expect(rule.id, JSON.stringify(rule)).toBeTruthy();
      expect(rule.reason({ count: 2 }).trim().length, rule.id).toBeGreaterThan(0);
    }
  });

  it('carries the reason onto the row, not just onto the rule', () => {
    const entry = award(RULES.CORRECT);
    expect(entry).toEqual({ ruleId: 'correct', points: 2, reason: 'You got a question right.' });
  });

  /**
   * PRODUCT.md's voice: plain, direct, second person, active. A ledger a student
   * reads is copy, and "Points awarded: correct_answer" is not copy.
   */
  it('is written to a person, not to a log', () => {
    for (const rule of ALL_RULES) {
      const reason = rule.reason({ count: 2 });
      expect(reason.startsWith('You'), `${rule.id}: ${reason}`).toBe(true);
      expect(reason.endsWith('.'), `${rule.id}: ${reason}`).toBe(true);
      // No identifiers leaking into copy.
      expect(reason, rule.id).not.toMatch(/[_-][a-z]+\b/);
    }
  });

  it('gives every rule a distinct id', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rewards coming back more than a single right answer', () => {
    // The behaviour worth rewarding is returning, not volume in one sitting.
    expect(RULES.DAILY_RETURN.points).toBeGreaterThan(RULES.CORRECT.points);
    expect(RULES.MOCK_COMPLETED.points).toBeGreaterThan(RULES.DAILY_RETURN.points);
  });
});

describe('a missed day adjusts the plan (T-191)', () => {
  const after = (day: string): StreakState => ({ days: 7, lastActiveDay: day });

  /**
   * **T-191's stated test, and the commitment this whole file exists for.**
   * A student revising for a national exam will miss days. A product that zeroes
   * their progress for being ill tells somebody who already feels behind that
   * they are back to the start.
   */
  it('leaves the streak intact after a gap, however long', () => {
    for (const gap of ['2026-08-11', '2026-08-20', '2027-01-01']) {
      const before = after('2026-08-10');
      const next = extendStreak(before, gap);
      expect(next.days, gap).toBe(before.days + 1);
      expect(next.days, gap).toBeGreaterThan(0);
    }
  });

  it('adds a zero-point row for the days away', () => {
    const entries = entriesForReturn(after('2026-08-10'), '2026-08-13');
    const adjusted = entries.find((e) => e.ruleId === 'plan-adjusted');

    expect(adjusted).toBeDefined();
    expect(adjusted?.points).toBe(0);
    expect(adjusted?.reason).toContain('2 days');
    // The point of the row: it says what happened without taking anything away.
    expect(adjusted?.reason).toContain('nothing is lost');
  });

  /**
   * The zero is deliberate. A missed day is not an award and must not be padded
   * into one — but a gap with no row reads as "we did not notice", or gets
   * filled in later by somebody assuming a reset.
   */
  it('is worth nothing, on purpose', () => {
    expect(RULES.PLAN_ADJUSTED.points).toBe(0);
  });

  it('never shames the student for the gap', () => {
    const reason = RULES.PLAN_ADJUSTED.reason({ count: 5 });
    for (const word of ['lost', 'broke', 'broken', 'failed', 'missed out', 'reset', 'streak']) {
      // "nothing is lost" is the one permitted use, checked above.
      const offending = reason.toLowerCase().includes(word) && !reason.includes('nothing is lost');
      expect(offending, `"${reason}" says "${word}"`).toBe(false);
    }
  });

  it('says one day in the singular', () => {
    const entries = entriesForReturn(after('2026-08-10'), '2026-08-12');
    expect(entries.find((e) => e.ruleId === 'plan-adjusted')?.reason).toContain('a day');
  });

  // Nothing to acknowledge, so nothing is said. A message about no gap is noise.
  it('writes no adjustment row when there was no gap', () => {
    const entries = entriesForReturn(after('2026-08-10'), '2026-08-11');
    expect(entries.map((e) => e.ruleId)).toEqual(['daily-return']);
  });

  it('writes nothing at all for a second visit the same day', () => {
    expect(entriesForReturn(after('2026-08-10'), '2026-08-10')).toEqual([]);
  });

  it('counts a first-ever visit as a return, not a gap', () => {
    const entries = entriesForReturn({ days: 0, lastActiveDay: null }, '2026-08-10');
    expect(entries.map((e) => e.ruleId)).toEqual(['daily-return']);
  });

  it('counts two visits in one day as one day', () => {
    const once = extendStreak({ days: 3, lastActiveDay: null }, '2026-08-10');
    expect(extendStreak(once, '2026-08-10')).toEqual(once);
  });
});

describe('which day it is', () => {
  /**
   * Ethiopian local time, not UTC. A student answering at 01:00 in Addis is
   * having a late night, not an early morning — and a UTC boundary would put
   * that answer on the wrong day, which is the day the streak counts.
   */
  it('uses the Addis day, not the UTC one', () => {
    // 22:30 UTC is 01:30 the next day in Addis.
    expect(dayOf(new Date('2026-08-10T22:30:00.000Z'))).toBe('2026-08-11');
    expect(dayOf(new Date('2026-08-10T20:00:00.000Z'))).toBe('2026-08-10');
  });

  it('does not depend on the server’s timezone', () => {
    const before = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Midway';
      const west = dayOf(new Date('2026-08-10T22:30:00.000Z'));
      process.env.TZ = 'Pacific/Kiritimati';
      const east = dayOf(new Date('2026-08-10T22:30:00.000Z'));
      expect(west).toBe(east);
      expect(west).toBe('2026-08-11');
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it('counts days across a month and a year boundary', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-08-10', '2026-08-10')).toBe(0);
  });
});

describe('badge tiers (T-192)', () => {
  it('starts at none and climbs with points', () => {
    expect(tierFor(0)).toBe('NONE');
    expect(tierFor(49)).toBe('NONE');
    expect(tierFor(50)).toBe('BRONZE');
    expect(tierFor(200)).toBe('SILVER');
    expect(tierFor(600)).toBe('GOLD');
    expect(tierFor(1500)).toBe('PLATINUM');
    expect(tierFor(99_999)).toBe('PLATINUM');
  });

  it('never goes backwards as points rise', () => {
    const order = TIERS.map((t) => t.id);
    let seen = -1;
    for (let points = 0; points <= 2000; points += 7) {
      const index = order.indexOf(tierFor(points));
      expect(index, `points ${points}`).toBeGreaterThanOrEqual(seen);
      seen = index;
    }
  });

  /**
   * A distance, not a threshold. "38 points to Bronze" is something a student
   * can act on; "50 points for Bronze" is a fact they then have to do
   * arithmetic on.
   */
  it('says how far the next tier is', () => {
    expect(pointsToNextTier(12)).toBe(38);
    expect(pointsToNextTier(199)).toBe(1);
  });

  it('says nothing about a next tier at the top', () => {
    expect(pointsToNextTier(1500)).toBeNull();
    expect(pointsToNextTier(5000)).toBeNull();
  });
});
