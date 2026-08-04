import { describe, expect, it } from 'vitest';

import { pickWeakestTopic, summariseExam, type ResultRow } from './exam-summary';

/** `n` questions in `topic` at `weight`, of which `correct` were right. */
const rows = (topic: string, weight: number | null, asked: number, correct: number): ResultRow[] =>
  Array.from({ length: asked }, (_, i) => ({
    topic,
    weightPct: weight,
    isCorrect: i < correct,
  }));

describe('the post-exam summary (T-130)', () => {
  it('scores the whole paper', () => {
    const s = summariseExam([...rows('A', 50, 4, 3), ...rows('B', 50, 4, 1)]);
    expect(s.asked).toBe(8);
    expect(s.correct).toBe(4);
    expect(s.scorePct).toBe(50);
  });

  it('breaks the score down per topic', () => {
    const s = summariseExam([...rows('Algorithms', 40, 4, 1), ...rows('Databases', 10, 4, 3)]);
    const byName = new Map(s.topics.map((t) => [t.topic, t]));
    expect(byName.get('Algorithms')).toMatchObject({ asked: 4, correct: 1, scorePct: 25 });
    expect(byName.get('Databases')).toMatchObject({ asked: 4, correct: 3, scorePct: 75 });
  });

  /**
   * The assertion T-130 exists for.
   *
   * Databases has three misses and Algorithms has one, so raw misses says
   * Databases. But Algorithms is 40% of the paper and Databases is 10%, so the
   * marks actually lost are 40 × 0.25 = 10 against 10 × 0.75 = 7.5. The hour
   * goes to Algorithms.
   */
  it('picks the weakest topic by weight × miss rate, not raw misses', () => {
    const s = summariseExam([...rows('Algorithms', 40, 4, 3), ...rows('Databases', 10, 4, 1)]);

    const misses = (t: string) => {
      const row = s.topics.find((x) => x.topic === t)!;
      return row.asked - row.correct;
    };
    expect(misses('Databases')).toBeGreaterThan(misses('Algorithms'));
    expect(s.weakestTopic).toBe('Algorithms');
  });

  it('reports what each topic cost, in marks off the whole paper', () => {
    const s = summariseExam([...rows('Algorithms', 40, 4, 3), ...rows('Databases', 10, 4, 1)]);
    const byName = new Map(s.topics.map((t) => [t.topic, t]));
    expect(byName.get('Algorithms')!.weightedGapPct).toBe(10);
    expect(byName.get('Databases')!.weightedGapPct).toBe(7.5);
  });

  // The list is a revision order, so the costliest is first.
  it('orders topics costliest first', () => {
    const s = summariseExam([
      ...rows('Cheap', 5, 4, 0),
      ...rows('Dear', 60, 4, 2),
      ...rows('Fine', 35, 4, 4),
    ]);
    expect(s.topics.map((t) => t.topic)).toEqual(['Dear', 'Cheap', 'Fine']);
  });

  // A topic answered perfectly cost nothing, whatever its weight.
  it('costs nothing for a topic with no misses', () => {
    const s = summariseExam(rows('Perfect', 90, 5, 5));
    expect(s.topics[0]!.weightedGapPct).toBe(0);
  });

  describe('topics with no weight yet (before T-134)', () => {
    // Unknown is not zero. Writing zero would rank an unweighted topic as having
    // cost nothing, which is a claim nobody made.
    it('leaves the cost unknown rather than calling it zero', () => {
      const s = summariseExam(rows('Unweighted', null, 4, 0));
      expect(s.topics[0]!.weightedGapPct).toBeNull();
    });

    // It cannot win the ranking on a guess — but it must not be invisible either.
    it('never sends a student to an unweighted topic while a weighted one exists', () => {
      const s = summariseExam([...rows('Unweighted', null, 10, 0), ...rows('Weighted', 20, 4, 3)]);
      expect(s.weakestTopic).toBe('Weighted');
      expect(s.topics.map((t) => t.topic)).toContain('Unweighted');
    });

    // A whole paper with no weights is what the bank looks like today. Pointing
    // somewhere honest beats pointing nowhere.
    it('falls back to raw misses when nothing on the paper is weighted', () => {
      const s = summariseExam([...rows('Few', null, 4, 3), ...rows('Many', null, 8, 2)]);
      expect(s.weakestTopic).toBe('Many');
    });
  });

  describe('edges', () => {
    it('names no topic when nothing was asked', () => {
      const s = summariseExam([]);
      expect(s.weakestTopic).toBeNull();
      expect(s.scorePct).toBe(0);
      expect(s.topics).toEqual([]);
    });

    // Two reads of one paper must never disagree about what to revise.
    it('breaks ties by name so the same paper always names the same topic', () => {
      const a = summariseExam([...rows('Zulu', 30, 4, 2), ...rows('Alpha', 30, 4, 2)]);
      const b = summariseExam([...rows('Alpha', 30, 4, 2), ...rows('Zulu', 30, 4, 2)]);
      expect(a.weakestTopic).toBe('Alpha');
      expect(b.weakestTopic).toBe(a.weakestTopic);
      expect(a.topics.map((t) => t.topic)).toEqual(b.topics.map((t) => t.topic));
    });

    it('is unmoved by the order the questions arrive in', () => {
      const forwards = summariseExam([...rows('A', 40, 3, 1), ...rows('B', 20, 3, 2)]);
      const backwards = summariseExam([...rows('B', 20, 3, 2), ...rows('A', 40, 3, 1)]);
      expect(backwards).toEqual(forwards);
    });

    it('directly ranks a hand-built breakdown by cost', () => {
      expect(
        pickWeakestTopic([
          { topic: 'Low', asked: 9, correct: 0, scorePct: 0, weightPct: 1, weightedGapPct: 1 },
          { topic: 'High', asked: 2, correct: 1, scorePct: 50, weightPct: 80, weightedGapPct: 40 },
        ]),
      ).toBe('High');
    });
  });
});
