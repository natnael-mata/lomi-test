import { describe, expect, it } from 'vitest';

import {
  PASS_SAFE_PCT,
  buildReadiness,
  latestPerQuestion,
  type AnsweredQuestion,
  type WeightedTopic,
} from './readiness';

const topic = (
  topicId: string,
  weightPct: number,
  weightSource: 'derived' | 'override' = 'derived',
): WeightedTopic => ({
  topicId,
  topicName: topicId.toUpperCase(),
  weightPct,
  weightSource,
});

/** `n` questions in a topic, `correct` of them right. Ids are unique per topic. */
const answers = (topicId: string, n: number, correct: number, tag = ''): AnsweredQuestion[] =>
  Array.from({ length: n }, (_, i) => ({
    questionId: `${topicId}-${tag}${i}`,
    topicId,
    isCorrect: i < correct,
  }));

describe('readiness (T-135, T-136, T-137)', () => {
  describe('per-topic scores (T-135)', () => {
    it('scores each topic on its own answers', () => {
      const r = buildReadiness(
        [topic('a', 50), topic('b', 50)],
        [...answers('a', 4, 3), ...answers('b', 4, 1)],
      );
      const byId = new Map(r.topics.map((t) => [t.topicId, t]));
      expect(byId.get('a')).toMatchObject({ answered: 4, correct: 3, scorePct: 75 });
      expect(byId.get('b')).toMatchObject({ answered: 4, correct: 1, scorePct: 25 });
    });

    /** T-135's stated test. */
    it('returns weights that sum to 100, every row carrying its source', () => {
      const r = buildReadiness(
        [topic('a', 34), topic('b', 33, 'override'), topic('c', 33)],
        answers('a', 2, 1),
      );
      expect(r.topics.reduce((s, t) => s + t.weightPct, 0)).toBe(100);
      for (const row of r.topics) {
        expect(['derived', 'override']).toContain(row.weightSource);
      }
      expect(r.topics.find((t) => t.topicId === 'b')!.weightSource).toBe('override');
    });

    it('lists every topic, including ones never answered', () => {
      const r = buildReadiness([topic('a', 50), topic('b', 50)], answers('a', 2, 2));
      expect(r.topics.map((t) => t.topicId)).toEqual(['a', 'b']);
    });

    /**
     * Unanswered is `null`, never 0.
     *
     * Zero says "you get none of this right", which is a claim about a student
     * who has not been asked. It would also drag the headline down and put a
     * Focus chip on a topic with no evidence behind it.
     */
    it('leaves an unanswered topic without a score rather than scoring it zero', () => {
      const r = buildReadiness([topic('a', 50), topic('b', 50)], answers('a', 2, 2));
      const b = r.topics.find((t) => t.topicId === 'b')!;
      expect(b.scorePct).toBeNull();
      expect(b.focus).toBe(false);
    });
  });

  describe('the headline figure (T-136)', () => {
    it('is the weighted mean, not the plain mean', () => {
      // 80% on nine-tenths of the exam and 0% on the rest is 72, not 40.
      const r = buildReadiness(
        [topic('big', 90), topic('small', 10)],
        [...answers('big', 10, 8), ...answers('small', 10, 0)],
      );
      expect(r.headlinePct).toBe(72);
    });

    /** T-136's stated test, as a property over many shapes. */
    it('can always be recomputed from the returned rows, ±0.5', () => {
      const shapes: [number, number, number][][] = [
        [
          [50, 4, 3],
          [50, 4, 1],
        ],
        [
          [34, 3, 1],
          [33, 3, 2],
          [33, 3, 3],
        ],
        [
          [90, 10, 8],
          [10, 10, 0],
        ],
        [
          [20, 7, 5],
          [30, 11, 4],
          [50, 13, 13],
        ],
        [[100, 3, 1]],
        [
          [25, 4, 1],
          [25, 4, 2],
          [25, 4, 3],
          [25, 4, 4],
        ],
      ];

      for (const shape of shapes) {
        const topics = shape.map(([w], i) => topic(`t${i}`, w!));
        const rows = shape.flatMap(([, n, c], i) => answers(`t${i}`, n!, c!));
        const r = buildReadiness(topics, rows);

        const scored = r.topics.filter((t) => t.scorePct !== null);
        const weight = scored.reduce((s, t) => s + t.weightPct, 0);
        const recomputed = scored.reduce((s, t) => s + t.scorePct! * t.weightPct, 0) / weight;

        expect(Math.abs(recomputed - r.headlinePct!)).toBeLessThanOrEqual(0.5);
      }
    });

    /**
     * Divided by the weight assessed, not by 100.
     *
     * Dividing by 100 would scale the headline down by however much of the exam
     * the student has not touched: perfect on a fifth of the paper would read as
     * "20% ready", which a student reads as a score, not as coverage. The gap is
     * reported separately instead.
     */
    it('is computed over what was assessed, with the gap reported separately', () => {
      const r = buildReadiness([topic('a', 20), topic('b', 80)], answers('a', 5, 5));
      expect(r.headlinePct).toBe(100);
      expect(r.assessedWeightPct).toBe(20);
      expect(r.unassessedWeightPct).toBe(80);
    });

    it('has no headline at all when nothing has been answered', () => {
      const r = buildReadiness([topic('a', 100)], []);
      expect(r.headlinePct).toBeNull();
      expect(r.assessedWeightPct).toBe(0);
      expect(r.unassessedWeightPct).toBe(100);
    });
  });

  describe('focus (T-137)', () => {
    /** T-137's stated test, at the boundary. */
    it('flags 59.9% and does not flag 60.1%', () => {
      // 599/1000 = 59.9%, 601/1000 = 60.1%.
      const r = buildReadiness(
        [topic('low', 50), topic('high', 50)],
        [...answers('low', 1000, 599), ...answers('high', 1000, 601)],
      );
      const byId = new Map(r.topics.map((t) => [t.topicId, t]));
      expect(byId.get('low')!.scorePct).toBe(59.9);
      expect(byId.get('low')!.focus).toBe(true);
      expect(byId.get('high')!.scorePct).toBe(60.1);
      expect(byId.get('high')!.focus).toBe(false);
    });

    it('does not flag a topic sitting exactly on the line', () => {
      const r = buildReadiness([topic('t', 100)], answers('t', 10, 6));
      expect(r.topics[0]!.scorePct).toBe(PASS_SAFE_PCT);
      expect(r.topics[0]!.focus).toBe(false);
    });

    it('orders focus topics heaviest first, as a revision order', () => {
      const r = buildReadiness(
        [topic('light', 10), topic('heavy', 60), topic('fine', 30)],
        [...answers('light', 10, 1), ...answers('heavy', 10, 5), ...answers('fine', 10, 9)],
      );
      expect(r.focus.map((t) => t.topicId)).toEqual(['heavy', 'light']);
    });
  });

  describe('what counts as evidence', () => {
    /**
     * One row per question, at its latest answer.
     *
     * Otherwise grinding one question lifts readiness, and an early mistake is
     * held against a student forever.
     */
    it('counts a question once, using the most recent answer', () => {
      const r = buildReadiness(
        [topic('t', 100)],
        [
          { questionId: 'q1', topicId: 't', isCorrect: false },
          { questionId: 'q1', topicId: 't', isCorrect: false },
          { questionId: 'q1', topicId: 't', isCorrect: true },
        ],
      );
      expect(r.topics[0]).toMatchObject({ answered: 1, correct: 1, scorePct: 100 });
    });

    it('lets a later wrong answer undo an earlier right one', () => {
      const r = buildReadiness(
        [topic('t', 100)],
        [
          { questionId: 'q1', topicId: 't', isCorrect: true },
          { questionId: 'q1', topicId: 't', isCorrect: false },
        ],
      );
      expect(r.topics[0]!.scorePct).toBe(0);
    });

    it('takes the last mention of each question, keeping the others whole', () => {
      const latest = latestPerQuestion([
        { questionId: 'a', topicId: 't', isCorrect: false },
        { questionId: 'b', topicId: 't', isCorrect: true },
        { questionId: 'a', topicId: 't', isCorrect: true },
      ]);
      expect(latest).toHaveLength(2);
      expect(latest.find((x) => x.questionId === 'a')!.isCorrect).toBe(true);
    });

    /**
     * A mock question left unanswered is graded wrong for the mock score — the
     * paper was not finished — but it is not evidence about knowledge. Folding
     * it in here would tell a student they do not understand a topic they were
     * never actually asked about.
     */
    it('reports mock questions that ran out of time without scoring them', () => {
      const r = buildReadiness([topic('t', 100)], answers('t', 4, 3), 17);
      expect(r.unansweredInMocks).toBe(17);
      expect(r.topics[0]!.answered).toBe(4);
      expect(r.topics[0]!.scorePct).toBe(75);
    });

    it('counts how many distinct questions the figure rests on', () => {
      const r = buildReadiness(
        [topic('a', 50), topic('b', 50)],
        [...answers('a', 3, 2), ...answers('b', 5, 5)],
      );
      expect(r.totalAnswered).toBe(8);
    });
  });

  describe('edges', () => {
    it('survives a field with no topics', () => {
      const r = buildReadiness([], []);
      expect(r.headlinePct).toBeNull();
      expect(r.topics).toEqual([]);
      expect(r.focus).toEqual([]);
    });

    // Answers to a topic that is not in the field's list are simply not shown.
    // Silently, and deliberately: a retired topic's old attempts should not
    // resurrect a row nobody is being examined on any more.
    it('ignores answers to topics outside the field', () => {
      const r = buildReadiness([topic('a', 100)], answers('gone', 5, 0));
      expect(r.topics).toHaveLength(1);
      expect(r.topics[0]!.scorePct).toBeNull();
    });

    it('handles a topic weighted at zero without dividing by it', () => {
      const r = buildReadiness(
        [topic('zero', 0), topic('rest', 100)],
        [...answers('zero', 4, 0), ...answers('rest', 4, 4)],
      );
      expect(r.headlinePct).toBe(100);
      expect(Number.isFinite(r.headlinePct!)).toBe(true);
    });
  });
});
