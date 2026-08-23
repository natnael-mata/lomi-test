import { describe, expect, it } from 'vitest';

import { buildReadiness, elidedLabel, PASS_SAFE_PCT } from './readiness';

const topic = (name: string, scorePct: number, weightPct: number) => ({
  topic: name,
  scorePct,
  weightPct,
});

describe('buildReadiness — the elided row (T-097)', () => {
  // The task's own test.
  it('adds an elided row for 58% given weights [12, 12, 18] against 100', () => {
    const s = buildReadiness([
      topic('VAT', 80, 12),
      topic('Payroll', 70, 12),
      topic('Audit', 55, 18),
    ]);
    expect(s.elided).not.toBeNull();
    expect(s.elided?.weightPct).toBe(58);
  });

  // Showing six topics that add to 42% under a headline of "68% ready" invites a
  // student to check the sum, fail, and stop trusting the number.
  it('makes the listed and elided weights sum to exactly 100', () => {
    const listed = [topic('a', 50, 12), topic('b', 50, 12), topic('c', 50, 18)];
    const s = buildReadiness(listed);
    const sum = listed.reduce((n, r) => n + r.weightPct, 0) + (s.elided?.weightPct ?? 0);
    expect(sum).toBe(100);
  });

  it('omits the row when the listed weights already account for everything', () => {
    expect(buildReadiness([topic('a', 50, 60), topic('b', 50, 40)]).elided).toBeNull();
  });

  it('omits the row rather than showing a negative remainder', () => {
    expect(buildReadiness([topic('a', 50, 70), topic('b', 50, 40)]).elided).toBeNull();
  });

  it('survives weights that only add up in decimal', () => {
    const s = buildReadiness([topic('a', 50, 33.3), topic('b', 50, 33.3), topic('c', 50, 33.4)]);
    expect(s.elided).toBeNull();
  });

  it('labels the row without inventing a count it does not have', () => {
    const s = buildReadiness([topic('a', 50, 20)]);
    expect(elidedLabel(s.elided!)).toBe('all other topics');
    expect(elidedLabel({ ...s.elided!, topicCount: 12 })).toBe('12 other topics, not started');
  });

  /*
   * Naming what has not been started.
   *
   * The row exists because these topics have no answers on them — untested,
   * not failed, which is why they carry no percentage and stay out of the
   * weighted mean. That is right. Hiding *which* they are was a separate
   * decision and a bad one: QA pointed out that a page this candid should not
   * tuck the topic a student has never touched behind "1 other topic". Not
   * knowing what you have not started is worse news than a low score on it.
   */
  it('names them while naming them is still readable', () => {
    const base = buildReadiness([topic('a', 50, 20)]).elided!;
    expect(elidedLabel({ ...base, topicCount: 1, topics: ['Value Added Tax'] })).toBe(
      'Value Added Tax — not started',
    );
    expect(elidedLabel({ ...base, topicCount: 2, topics: ['Trade', 'Landforms'] })).toBe(
      'Trade, Landforms — not started',
    );
  });

  it('falls back to a count once a list would be a paragraph', () => {
    const base = buildReadiness([topic('a', 50, 20)]).elided!;
    const many = ['One', 'Two', 'Three', 'Four', 'Five'];
    // Past three, a list stops being something to act on.
    expect(elidedLabel({ ...base, topicCount: many.length, topics: many })).toBe(
      '5 other topics, not started',
    );
  });

  it('still labels the row when no names were supplied', () => {
    // The names are optional, so an older caller must not produce "undefined".
    const base = buildReadiness([topic('a', 50, 20)]).elided!;
    const label = elidedLabel({ ...base, topicCount: 3 });
    expect(label).not.toContain('undefined');
    expect(label).toContain('3 other topics');
  });
});

describe('buildReadiness — the headline', () => {
  it('is the weighted mean, not the plain average', () => {
    // Plain average would be 60; weighted by 90/10 it is 93.
    const s = buildReadiness([topic('big', 100, 90), topic('small', 30, 10)], {
      elidedScorePct: null,
    });
    expect(s.headlinePct).toBe(93);
  });

  // Assuming 0 understates readiness and assuming the listed average flatters
  // it; both put a number in the student's mouth.
  it('excludes the elided weight from the mean when its score is unknown', () => {
    const s = buildReadiness([topic('a', 80, 20)]);
    expect(s.headlinePct).toBe(80);
  });

  it('includes the elided weight when its score is known', () => {
    const s = buildReadiness([topic('a', 80, 20)], { elidedScorePct: 40 });
    // (80×20 + 40×80) / 100 = 48
    expect(s.headlinePct).toBe(48);
  });

  it('is 0 rather than NaN when there is nothing to average', () => {
    expect(buildReadiness([]).headlinePct).toBe(0);
  });
});

describe('buildReadiness — focus', () => {
  it('picks the rows below the pass-safe line', () => {
    const s = buildReadiness([topic('a', 59, 10), topic('b', 60, 10), topic('c', 20, 30)]);
    expect(s.focus.map((r) => r.topic)).toEqual(['c', 'a']);
  });

  it('orders them by weight, so the biggest gap comes first', () => {
    const s = buildReadiness([topic('small', 10, 5), topic('big', 10, 50)]);
    expect(s.focus[0]?.topic).toBe('big');
  });

  it('treats exactly the pass-safe line as safe', () => {
    expect(buildReadiness([topic('a', PASS_SAFE_PCT, 10)]).focus).toEqual([]);
  });
});
