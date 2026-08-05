import { describe, expect, it } from 'vitest';

import { labelSittings, trendDeltaPct, type SittingInput } from './trend';

const sitting = (over: Partial<SittingInput> = {}): SittingInput => ({
  sittingId: 's1',
  startedAt: '2026-07-12T08:00:00.000Z',
  scoreCorrect: 50,
  totalQuestions: 100,
  answeredCount: 100,
  ranOutOfTime: false,
  ...over,
});

describe('the score trend across sittings (T-138)', () => {
  /** T-138's stated test. */
  it('labels the axis by sitting, reading "Mock 1/2/3"', () => {
    const points = labelSittings([
      sitting({ sittingId: 'a' }),
      sitting({ sittingId: 'b' }),
      sitting({ sittingId: 'c' }),
    ]);
    expect(points.map((p) => p.label)).toEqual(['Mock 1', 'Mock 2', 'Mock 3']);
    expect(points.map((p) => p.ordinal)).toEqual([1, 2, 3]);
  });

  /**
   * Never a date.
   *
   * Calendar spacing makes the chart's shape about a student's holiday rather
   * than their revision — and Ethiopia runs its own calendar alongside the
   * Gregorian one, so a formatted date is a decision with a wrong answer per
   * student. An ordinal has neither problem.
   */
  it('puts no date in any label, whatever the dates were', () => {
    const points = labelSittings([
      sitting({ sittingId: 'a', startedAt: '2026-01-02T00:00:00.000Z' }),
      sitting({ sittingId: 'b', startedAt: '2026-11-30T00:00:00.000Z' }),
    ]);
    for (const point of points) {
      expect(point.label).not.toMatch(/\d{4}|Jan|Nov|-|\//);
    }
  });

  // Carried, so a tooltip can still show when it was sat.
  it('keeps the date on the point even though the axis ignores it', () => {
    expect(labelSittings([sitting()])[0]!.startedAt).toBe('2026-07-12T08:00:00.000Z');
  });

  it('scores each sitting out of the whole paper', () => {
    const points = labelSittings([sitting({ scoreCorrect: 45, totalQuestions: 100 })]);
    expect(points[0]!.scorePct).toBe(45);
  });

  /**
   * A mock that expired at question 60 is a different story from one finished
   * badly. A trend that cannot tell them apart teaches the wrong lesson about
   * what to fix.
   */
  it('reports the questions time ran out on', () => {
    const points = labelSittings([
      sitting({ answeredCount: 62, totalQuestions: 100, ranOutOfTime: true }),
    ]);
    expect(points[0]!.unanswered).toBe(38);
    expect(points[0]!.ranOutOfTime).toBe(true);
  });

  it('never reports a negative number of unanswered questions', () => {
    const points = labelSittings([sitting({ answeredCount: 100, totalQuestions: 100 })]);
    expect(points[0]!.unanswered).toBe(0);
  });

  it('survives a paper with no questions without dividing by zero', () => {
    const points = labelSittings([sitting({ totalQuestions: 0, scoreCorrect: 0 })]);
    expect(points[0]!.scorePct).toBe(0);
  });

  it('is empty when no mock has been sat', () => {
    expect(labelSittings([])).toEqual([]);
  });

  describe('the change between first and last', () => {
    it('measures improvement across the sequence', () => {
      const points = labelSittings([
        sitting({ scoreCorrect: 40 }),
        sitting({ scoreCorrect: 55 }),
        sitting({ scoreCorrect: 62 }),
      ]);
      expect(trendDeltaPct(points)).toBe(22);
    });

    it('measures a decline just as plainly', () => {
      const points = labelSittings([sitting({ scoreCorrect: 70 }), sitting({ scoreCorrect: 61 })]);
      expect(trendDeltaPct(points)).toBe(-9);
    });

    /**
     * One mock is not a flat trend, it is no trend. Returning 0 would draw "no
     * change" from a single point, which tells a student something nobody knows.
     */
    it('has nothing to say about a single mock', () => {
      expect(trendDeltaPct(labelSittings([sitting()]))).toBeNull();
      expect(trendDeltaPct([])).toBeNull();
    });
  });
});
