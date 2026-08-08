import { describe, expect, it } from 'vitest';

import { WEIGHT_TOTAL, validateOverride, weightSum, type WeightRow } from './weight-sum';

const row = (topicName: string, weightPct: number): WeightRow => ({
  topicId: `id-${topicName}`,
  topicName,
  weightPct,
});

describe('the live weight sum (T-162a)', () => {
  /** T-162a's stated test, first half. */
  it('reads 100 when the weights balance', () => {
    const sum = weightSum([row('A', 34), row('B', 33), row('C', 33)]);
    expect(sum.state).toBe('balanced');
    expect(sum.total).toBe(100);
    expect(sum.message).toBe('Weights total 100%.');
  });

  /**
   * T-162a's stated test, second half — and the reason the indicator exists at
   * all. "Not balanced" tells a reviewer they have a problem; "3% short" tells
   * them what to type.
   */
  it('names the shortfall when they do not', () => {
    const sum = weightSum([row('A', 34), row('B', 33), row('C', 30)]);
    expect(sum.state).toBe('short');
    expect(sum.differencePct).toBe(3);
    expect(sum.message).toContain('3% short');
    expect(sum.message).toContain('97%');
  });

  it('names the excess the same way', () => {
    const sum = weightSum([row('A', 60), row('B', 45)]);
    expect(sum.state).toBe('over');
    expect(sum.differencePct).toBe(5);
    expect(sum.message).toContain('5% over');
  });

  // The difference is a distance, so it is never negative — a message reading
  // "-3% short" is one somebody has to stop and parse.
  it('reports the difference as a positive distance', () => {
    expect(weightSum([row('A', 90)]).differencePct).toBe(10);
    expect(weightSum([row('A', 110)]).differencePct).toBe(10);
  });

  it('states the running total alongside the gap, so the rows can be checked', () => {
    expect(weightSum([row('A', 97)]).message).toContain('97%');
    expect(weightSum([row('A', 104)]).message).toContain('104%');
  });

  /**
   * An empty field is 0, not balanced. A screen that called it fine would be
   * telling a reviewer the weights are correct before any exist.
   */
  it('is short, not balanced, when there are no topics', () => {
    const sum = weightSum([]);
    expect(sum.state).toBe('short');
    expect(sum.total).toBe(0);
    expect(sum.differencePct).toBe(WEIGHT_TOTAL);
  });

  it('is balanced on a single topic holding the whole hundred', () => {
    expect(weightSum([row('Only', 100)]).state).toBe('balanced');
  });

  /**
   * Integer arithmetic. The server works in hundredths for the same reason: a
   * float column sums to 99.99999999999999 and fails a check that should pass,
   * and a running total on screen has the identical trap.
   */
  it('totals exactly, with no floating-point drift', () => {
    const tenths = Array.from({ length: 10 }, (_, i) => row(`T${i}`, 10));
    expect(weightSum(tenths).total).toBe(100);
    expect(weightSum(tenths).state).toBe('balanced');
  });
});

describe('validating an override before it is sent (T-162a)', () => {
  it('accepts a whole percent with a reason', () => {
    expect(validateOverride(40, 'Past papers say 40%.')).toEqual({ ok: true });
  });

  it('refuses a weight outside 0..100', () => {
    for (const bad of [-1, 101, 12.5]) {
      const result = validateOverride(bad, 'because');
      expect(result.ok, String(bad)).toBe(false);
    }
  });

  it('accepts the ends of the range', () => {
    expect(validateOverride(0, 'Nothing from this topic appears.').ok).toBe(true);
    expect(validateOverride(100, 'The whole paper is this topic.').ok).toBe(true);
  });

  /**
   * The reason is required, and the message says *why* rather than just that it
   * is. "Reason is required" is a form telling somebody off; this one explains
   * what the field is for.
   */
  it('refuses an empty reason and explains what it is for', () => {
    const result = validateOverride(40, '   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('typo to whoever reads it next');
    }
  });

  // A courtesy, not a control: the server checks the same things, and a
  // client-side check that were the only one would be a hole.
  it('mirrors what the server enforces rather than replacing it', () => {
    expect(validateOverride(101, 'x').ok).toBe(false);
    expect(validateOverride(40, '').ok).toBe(false);
  });
});
