import { describe, expect, it } from 'vitest';

import { DEFAULT_BLUEPRINT, TIME_LIMIT_SEC, type PoolQuestion } from './exam-blueprint';
import { allocateTopicQuotas, sampleBlueprint, type TopicShare } from './sampling';

const share = (topicId: string, weightPct: number, topicName = topicId): TopicShare => ({
  topicId,
  topicName,
  weightPct,
});

/** A pool with a given number of each type, spread over the topics given. */
function pool(concept: number, calculation: number, topicIds: string[] = ['t1']): PoolQuestion[] {
  const out: PoolQuestion[] = [];
  let n = 0;
  for (const [qType, count] of [
    ['CONCEPT', concept],
    ['CALCULATION', calculation],
  ] as const) {
    for (let i = 0; i < count; i++) {
      out.push({
        id: `q${++n}`,
        topicId: topicIds[i % topicIds.length]!,
        qType,
        timeLimitSec: TIME_LIMIT_SEC[qType],
      });
    }
  }
  return out;
}

/** Deterministic: always takes the first candidate. */
const first = () => 0;

describe('allocateTopicQuotas — largest remainder', () => {
  // Rounding each topic independently gives 33 + 33 + 33 = 99, and the paper is
  // a question short with nothing in the code aware of it.
  it('allocates [33.33, 33.33, 33.34] as 33/33/34, summing to exactly 100', () => {
    const quotas = allocateTopicQuotas(
      [share('a', 33.33), share('b', 33.33), share('c', 33.34)],
      100,
    );
    expect(quotas.map((q) => q.target).reduce((x, y) => x + y, 0)).toBe(100);
    expect(quotas.map((q) => q.target).sort()).toEqual([33, 33, 34]);
  });

  it('never loses or invents a question, across many awkward splits', () => {
    const cases: number[][] = [
      [50, 50],
      [1, 99],
      [33.33, 33.33, 33.34],
      [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      [16.67, 16.67, 16.66, 16.67, 16.67, 16.66],
      [0.5, 99.5],
    ];
    for (const weights of cases) {
      const quotas = allocateTopicQuotas(
        weights.map((w, i) => share(`t${i}`, w)),
        100,
      );
      const total = quotas.reduce((sum, q) => sum + q.target, 0);
      expect(total, `weights ${weights.join('/')}`).toBe(100);
      expect(quotas.every((q) => q.target >= 0)).toBe(true);
    }
  });

  // The same input must always produce the same paper.
  it('breaks ties on topic name, deterministically', () => {
    const a = allocateTopicQuotas([share('z', 50, 'Zeta'), share('a', 50, 'Alpha')], 3);
    const b = allocateTopicQuotas([share('a', 50, 'Alpha'), share('z', 50, 'Zeta')], 3);
    const byId = (qs: ReturnType<typeof allocateTopicQuotas>) =>
      Object.fromEntries(qs.map((q) => [q.topicId, q.target]));
    expect(byId(a)).toEqual(byId(b));
    // Alpha wins the odd one.
    expect(byId(a).a).toBe(2);
  });

  it('gives everyone nothing when no topic carries a weight', () => {
    const quotas = allocateTopicQuotas([share('a', 0), share('b', 0)], 100);
    expect(quotas.every((q) => q.target === 0)).toBe(true);
  });

  it('handles no topics and no questions', () => {
    expect(allocateTopicQuotas([], 100)).toEqual([]);
    expect(allocateTopicQuotas([share('a', 100)], 0)[0]!.target).toBe(0);
  });
});

describe('sampleBlueprint — the type mix is hard (T-120, T-120a)', () => {
  const topics = [share('t1', 100)];

  it('draws exactly the blueprint', () => {
    const result = sampleBlueprint({
      pool: pool(80, 60),
      blueprint: DEFAULT_BLUEPRINT,
      topics,
      pick: first,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chosen).toHaveLength(100);
    expect(result.chosen.filter((q) => q.qType === 'CONCEPT')).toHaveLength(60);
    expect(result.chosen.filter((q) => q.qType === 'CALCULATION')).toHaveLength(40);
  });

  it('never draws the same question twice', () => {
    const result = sampleBlueprint({
      pool: pool(80, 60),
      blueprint: DEFAULT_BLUEPRINT,
      topics,
      pick: first,
    });
    if (!result.ok) throw new Error('expected a paper');
    expect(new Set(result.chosen.map((q) => q.id)).size).toBe(100);
  });

  // T-120a's own test.
  it('refuses a bank with only 10 calculation questions, naming the shortfall', () => {
    const result = sampleBlueprint({
      pool: pool(80, 10),
      blueprint: DEFAULT_BLUEPRINT,
      topics,
      pick: first,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers.join(' ')).toContain('Need 40 CALCULATION questions, have 10');
    expect(result.blockers.join(' ')).toContain('short 30');
  });

  // Whoever is building a paper wants the whole shortfall, not the first one.
  it('reports every shortfall at once', () => {
    const result = sampleBlueprint({
      pool: pool(5, 10),
      blueprint: DEFAULT_BLUEPRINT,
      topics,
      pick: first,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers).toHaveLength(2);
    expect(result.blockers.join(' ')).toContain('CONCEPT');
    expect(result.blockers.join(' ')).toContain('CALCULATION');
  });

  it('refuses a paper that cannot be finished in the time allowed', () => {
    // Every question patched to the gate's 600s ceiling.
    const slow = pool(80, 60).map((q) => ({ ...q, timeLimitSec: 600 }));
    const result = sampleBlueprint({
      pool: slow,
      blueprint: DEFAULT_BLUEPRINT,
      topics,
      pick: first,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockers.join(' ')).toContain('over by');
  });
});

describe('sampleBlueprint — the topic quota is soft, and recorded', () => {
  it('reports achieved against target per topic', () => {
    const result = sampleBlueprint({
      pool: pool(80, 60, ['t1', 't2']),
      blueprint: DEFAULT_BLUEPRINT,
      topics: [share('t1', 50), share('t2', 50)],
      pick: first,
    });
    if (!result.ok) throw new Error('expected a paper');
    expect(result.report).toHaveLength(2);
    for (const row of result.report) {
      expect(row.target).toBe(50);
      expect(row.achieved).toBeGreaterThan(0);
    }
    expect(result.report.reduce((n, r) => n + r.achieved, 0)).toBe(100);
  });

  /**
   * The soft part. D5's weights are derived from past papers and explicitly are
   * NOT an official blueprint, so refusing to build a mock because one topic is
   * thin would withhold the main feature over a provisional number. It builds,
   * and says what it actually managed.
   */
  it('still builds when a topic cannot meet its target, and says so', () => {
    // t2 is weighted 50% but has only a handful of questions.
    const thin: PoolQuestion[] = [
      ...pool(70, 50, ['t1']),
      { id: 'x1', topicId: 't2', qType: 'CONCEPT', timeLimitSec: 60 },
      { id: 'x2', topicId: 't2', qType: 'CALCULATION', timeLimitSec: 180 },
    ];
    const result = sampleBlueprint({
      pool: thin,
      blueprint: DEFAULT_BLUEPRINT,
      topics: [share('t1', 50), share('t2', 50)],
      pick: first,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t2 = result.report.find((r) => r.topicId === 't2')!;
    expect(t2.target).toBe(50);
    expect(t2.achieved).toBeLessThan(t2.target);
    expect(result.chosen).toHaveLength(100);
  });
});
