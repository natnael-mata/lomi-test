/**
 * The post-exam summary (T-130), with no database involved.
 *
 * **Why this is not `practice/summary.ts`.** Practice asks "what am I worst at"
 * and answers with the lowest score. A mock exam asks a different question —
 * "where would another hour of revision buy me the most marks" — and the answer
 * is not the lowest score. A topic answered at 20% that is a fortieth of the
 * paper is worth less than a topic answered at 60% that is a third of it. Two
 * screens, two questions, two rules; collapsing them into one would make at
 * least one of the screens lie.
 *
 * So the ranking here is **expected marks lost**: the topic's share of the exam
 * multiplied by the share of it the student missed. That is what T-130 means by
 * "weight × miss rate, not raw misses" — and the distinction is real, because
 * raw misses systematically point at whichever topic simply had the most
 * questions on the paper.
 */

export interface ResultRow {
  topic: string;
  /** The topic's share of past papers, 0–100, or null if it is unweighted. */
  weightPct: number | null;
  isCorrect: boolean;
}

export interface TopicBreakdown {
  topic: string;
  asked: number;
  correct: number;
  scorePct: number;
  weightPct: number | null;
  /**
   * Share of the whole paper's marks this topic cost, 0–100.
   *
   * `null` when the topic has no weight yet: an unweighted topic's contribution
   * to the exam is not zero, it is unknown, and writing zero would quietly rank
   * it as costing nothing.
   */
  weightedGapPct: number | null;
}

export interface ExamSummary {
  asked: number;
  correct: number;
  scorePct: number;
  topics: TopicBreakdown[];
  /**
   * The topic to revise first, or `null` when nothing was asked.
   *
   * Named for what a student does with it, as on the practice screen: a summary
   * that ranks weaknesses is a scoreboard, one that names the next thing to work
   * on is a study plan.
   */
  weakestTopic: string | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (part: number, whole: number): number =>
  whole === 0 ? 0 : round1((part / whole) * 100);

/**
 * Which topic to revise first: the one that cost the most marks.
 *
 * An unweighted topic can never win. "No weight yet" is missing information, and
 * a guess in either direction is wrong in a way the student cannot see — call it
 * important and they revise something nobody established matters; call it
 * unimportant and they skip something that does. It stays out of the ranking
 * until T-134 gives it a weight.
 *
 * The exception is a paper where *nothing* is weighted, which is what a bank
 * looks like before weights are computed. Falling back to the plain miss count
 * there beats returning nothing at all — the summary still points somewhere, and
 * it points at the same place raw misses would, which is the honest answer when
 * weights are the information you don't have.
 *
 * Ties break on the name so the same paper always names the same topic. A
 * summary that reorders between two reads makes a student doubt the one screen
 * meant to tell them what to do.
 */
export function pickWeakestTopic(topics: readonly TopicBreakdown[]): string | null {
  if (topics.length === 0) return null;

  const weighted = topics.filter((t) => t.weightedGapPct !== null);
  if (weighted.length > 0) {
    const ranked = [...weighted].sort(
      (a, b) => b.weightedGapPct! - a.weightedGapPct! || a.topic.localeCompare(b.topic),
    );
    return ranked[0]!.topic;
  }

  const ranked = [...topics].sort(
    (a, b) => b.asked - b.correct - (a.asked - a.correct) || a.topic.localeCompare(b.topic),
  );
  return ranked[0]!.topic;
}

export function summariseExam(rows: readonly ResultRow[]): ExamSummary {
  const byTopic = new Map<string, { asked: number; correct: number; weightPct: number | null }>();

  for (const row of rows) {
    const acc = byTopic.get(row.topic) ?? { asked: 0, correct: 0, weightPct: row.weightPct };
    acc.asked += 1;
    if (row.isCorrect) acc.correct += 1;
    // A weight arriving on any question for the topic is the topic's weight.
    if (acc.weightPct === null) acc.weightPct = row.weightPct;
    byTopic.set(row.topic, acc);
  }

  const topics: TopicBreakdown[] = [...byTopic.entries()]
    .map(([topic, acc]) => {
      const missRate = acc.asked === 0 ? 0 : (acc.asked - acc.correct) / acc.asked;
      return {
        topic,
        asked: acc.asked,
        correct: acc.correct,
        scorePct: pct(acc.correct, acc.asked),
        weightPct: acc.weightPct,
        weightedGapPct: acc.weightPct === null ? null : round1(acc.weightPct * missRate),
      };
    })
    // Costliest first: the list is a revision order, so the thing to do next is
    // at the top rather than buried under what already went well.
    .sort(
      (a, b) =>
        (b.weightedGapPct ?? -1) - (a.weightedGapPct ?? -1) || a.topic.localeCompare(b.topic),
    );

  const correct = rows.filter((r) => r.isCorrect).length;

  return {
    asked: rows.length,
    correct,
    scorePct: pct(correct, rows.length),
    topics,
    weakestTopic: pickWeakestTopic(topics),
  };
}
