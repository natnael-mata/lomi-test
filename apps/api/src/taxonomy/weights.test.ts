import { describe, expect, it } from 'vitest';

import { WeightsError, applyOverrides, assertWeightsSumTo100, deriveWeights } from './weights';

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

describe('deriving weights from the bank (T-134)', () => {
  const t = (name: string, publishedCount: number) => ({
    topicId: `id-${name}`,
    name,
    publishedCount,
  });

  /** T-134's stated test: equal thirds must not round to 99. */
  it('normalises three equal shares to 34 / 33 / 33', () => {
    const derived = deriveWeights([t('A', 1), t('B', 1), t('C', 1)]);
    expect(derived.map((d) => d.weightPct)).toEqual([34, 33, 33]);
    expect(derived.reduce((s, d) => s + d.weightPct, 0)).toBe(100);
  });

  it('gives a single topic the whole hundred', () => {
    expect(deriveWeights([t('Only', 7)])[0]!.weightPct).toBe(100);
  });

  it('splits an exact half evenly', () => {
    expect(deriveWeights([t('A', 50), t('B', 50)]).map((d) => d.weightPct)).toEqual([50, 50]);
  });

  it('weights by share of the bank, not by topic count', () => {
    const derived = deriveWeights([t('Big', 90), t('Small', 10)]);
    expect(derived.map((d) => d.weightPct)).toEqual([90, 10]);
  });

  // A topic with nothing published is 0%, not excluded — it exists, and saying
  // so is how a reviewer notices the gap.
  it('keeps a topic with no published questions, at zero', () => {
    const derived = deriveWeights([t('Full', 10), t('Empty', 0)]);
    expect(derived.map((d) => d.weightPct)).toEqual([100, 0]);
    expect(derived).toHaveLength(2);
  });

  /**
   * The property that matters more than any single case: whatever the bank
   * looks like, the weights sum to exactly 100, so `assertWeightsSumTo100`
   * never fails on weights this function produced.
   */
  it('always sums to exactly 100, for any bank', () => {
    const banks: number[][] = [
      [1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [7, 11, 13, 17],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [1, 999],
      [3, 3, 3, 1],
      [0, 0, 5],
      Array.from({ length: 37 }, (_, i) => i + 1),
    ];
    for (const counts of banks) {
      const derived = deriveWeights(counts.map((c, i) => t(`T${String(i).padStart(2, '0')}`, c)));
      const total = derived.reduce((s, d) => s + d.weightPct, 0);
      expect(total, `bank ${counts.join(',')} summed to ${total}`).toBe(100);
      // And every weight is a whole percent, never a fraction.
      for (const d of derived) expect(Number.isInteger(d.weightPct)).toBe(true);
    }
  });

  it('produces weights that pass the sum check', () => {
    const derived = deriveWeights([t('A', 1), t('B', 1), t('C', 1)]);
    expect(() => assertWeightsSumTo100(derived)).not.toThrow();
  });

  it('is deterministic, so a rebuild does not move questions between topics', () => {
    const bank = [t('Zulu', 1), t('Alpha', 1), t('Mike', 1)];
    expect(deriveWeights(bank)).toEqual(deriveWeights([...bank].reverse()).reverse());
  });

  // Alphabetical tie-break, so the extra point lands somewhere explicable.
  it('gives the leftover point to the first name when remainders tie', () => {
    const derived = deriveWeights([t('Zulu', 1), t('Alpha', 1), t('Mike', 1)]);
    const byName = new Map(derived.map((d) => [d.name, d.weightPct]));
    expect(byName.get('Alpha')).toBe(34);
    expect(byName.get('Mike')).toBe(33);
    expect(byName.get('Zulu')).toBe(33);
  });

  describe('refusals', () => {
    it('refuses a field with no topics', () => {
      expect(() => deriveWeights([])).toThrow(WeightsError);
    });

    /**
     * All-zero weights would sum to 0 and fail the publish gate's sum check,
     * surfacing as "the weights are broken" when the truth is that nothing has
     * been published yet. Different problem, different message.
     */
    it('refuses a field where nothing is published yet', () => {
      try {
        deriveWeights([t('A', 0), t('B', 0)]);
        expect.unreachable('should have refused');
      } catch (e) {
        expect(e).toBeInstanceOf(WeightsError);
        expect((e as WeightsError).code).toBe('NO_PUBLISHED_QUESTIONS');
      }
    });
  });
});

describe('a reviewer overriding a weight (T-134a)', () => {
  const derived = [
    { topicId: 'a', name: 'Algorithms', weightPct: 34 },
    { topicId: 'b', name: 'Databases', weightPct: 33 },
    { topicId: 'c', name: 'Networks', weightPct: 33 },
  ];

  /** T-134a's stated test. */
  it('leaves the others summing to 60 when one is pinned to 40', () => {
    const out = applyOverrides(derived, new Map([['a', 40]]));
    expect(out.find((d) => d.topicId === 'a')!.weightPct).toBe(40);
    expect(out.filter((d) => d.topicId !== 'a').reduce((s, d) => s + d.weightPct, 0)).toBe(60);
    expect(out.reduce((s, d) => s + d.weightPct, 0)).toBe(100);
  });

  /**
   * The rest are re-normalised *in proportion*, not flattened.
   *
   * A reviewer correcting one topic is not also claiming the others are equal.
   * Splitting the remainder evenly would throw away what the bank says about
   * them, silently, as a side effect of an unrelated edit.
   */
  it('splits the remainder in proportion to the derived weights', () => {
    const uneven = [
      { topicId: 'a', name: 'A', weightPct: 50 },
      { topicId: 'b', name: 'B', weightPct: 40 },
      { topicId: 'c', name: 'C', weightPct: 10 },
    ];
    const out = applyOverrides(uneven, new Map([['a', 50]]));
    const byId = new Map(out.map((d) => [d.topicId, d.weightPct]));
    expect(byId.get('b')).toBe(40);
    expect(byId.get('c')).toBe(10);
  });

  it('composes two overrides rather than the last one winning', () => {
    const out = applyOverrides(
      derived,
      new Map([
        ['a', 50],
        ['b', 30],
      ]),
    );
    const byId = new Map(out.map((d) => [d.topicId, d.weightPct]));
    expect(byId.get('a')).toBe(50);
    expect(byId.get('b')).toBe(30);
    expect(byId.get('c')).toBe(20);
  });

  it('still sums to 100 when the remainder does not divide evenly', () => {
    const out = applyOverrides(derived, new Map([['a', 41]]));
    expect(out.reduce((s, d) => s + d.weightPct, 0)).toBe(100);
  });

  it('is the derived set when nothing is overridden', () => {
    expect(applyOverrides(derived, new Map())).toEqual(derived);
  });

  it('accepts overrides that account for every topic exactly', () => {
    const out = applyOverrides(
      derived,
      new Map([
        ['a', 20],
        ['b', 30],
        ['c', 50],
      ]),
    );
    expect(out.map((d) => d.weightPct)).toEqual([20, 30, 50]);
  });

  describe('refusals', () => {
    it('refuses overrides that leave nothing for the rest', () => {
      expect(() => applyOverrides(derived, new Map([['a', 140]]))).toThrow(WeightsError);
    });

    it('refuses a full set of overrides that does not sum to 100', () => {
      expect(() =>
        applyOverrides(
          derived,
          new Map([
            ['a', 20],
            ['b', 20],
            ['c', 20],
          ]),
        ),
      ).toThrow(WeightsError);
    });
  });
});
