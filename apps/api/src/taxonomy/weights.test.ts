import { describe, expect, it } from 'vitest';

import { assertWeightsSumTo100, WeightsError } from './weights';

const t = (name: string, weightPct: number | null) => ({ name, weightPct });

describe('assertWeightsSumTo100', () => {
  it('passes when weights sum to exactly 100', () => {
    expect(() => assertWeightsSumTo100([t('a', 40), t('b', 60)])).not.toThrow();
  });

  it('names the shortfall when weights are under 100', () => {
    expect(() => assertWeightsSumTo100([t('a', 40), t('b', 50)])).toThrow(
      'Topic weights sum to 90.00%, short by 10.00% (must be 100.00%).',
    );
  });

  it('names the excess when weights are over 100', () => {
    expect(() => assertWeightsSumTo100([t('a', 40), t('b', 70)])).toThrow(
      'Topic weights sum to 110.00%, over by 10.00% (must be 100.00%).',
    );
  });

  // The reason weightPct is numeric(5,2) and this function works in integer
  // hundredths: 33.33 + 33.33 + 33.34 is exactly 100 in decimal, but summing
  // the same values as floats gives 100.00000000000001.
  it('accepts two-decimal weights that sum exactly', () => {
    expect(() =>
      assertWeightsSumTo100([t('a', 33.33), t('b', 33.33), t('c', 33.34)]),
    ).not.toThrow();
  });

  it('rejects a near-miss of one hundredth', () => {
    expect(() => assertWeightsSumTo100([t('a', 33.33), t('b', 33.33), t('c', 33.33)])).toThrow(
      'short by 0.01',
    );
  });

  it('names every unweighted topic rather than reporting a bad sum', () => {
    let err: unknown;
    try {
      assertWeightsSumTo100([t('Sorting', 50), t('Trees', null), t('Graphs', null)]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(WeightsError);
    expect((err as WeightsError).code).toBe('UNWEIGHTED_TOPIC');
    expect((err as WeightsError).message).toContain('Trees');
    expect((err as WeightsError).message).toContain('Graphs');
  });

  it('rejects an empty topic list instead of treating 0 as valid', () => {
    expect(() => assertWeightsSumTo100([])).toThrow(WeightsError);
    expect(() => assertWeightsSumTo100([])).toThrow('No topics to weight');
  });

  it('carries a machine-readable code alongside the message', () => {
    try {
      assertWeightsSumTo100([t('a', 99)]);
    } catch (e) {
      expect((e as WeightsError).code).toBe('SUM_MISMATCH');
    }
  });
});
