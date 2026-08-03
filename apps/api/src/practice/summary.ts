/**
 * The practice summary (T-118), with no database involved.
 *
 * **"Session" means today's practice**, not a tab that happened to stay open.
 * There is no practice-session model and inventing one would be a table to
 * maintain for a screen; meanwhile the product already has a day boundary that
 * students feel — T-110 stops re-serving a question they got right *the same
 * day*. Reusing it keeps one notion of "a practice day" instead of two that
 * disagree at midnight.
 */

export interface AttemptRow {
  topic: string;
  /** The topic's share of past papers, 0–100, or null if it is unweighted. */
  weightPct: number | null;
  isCorrect: boolean;
}

export interface TopicSummary {
  topic: string;
  answered: number;
  correct: number;
  scorePct: number;
  weightPct: number | null;
}

export interface PracticeSummary {
  answered: number;
  correct: number;
  scorePct: number;
  topics: TopicSummary[];
  /**
   * The topic to practise next, or `null` when nothing has been answered.
   *
   * Named for what a student does with it rather than "worst": a summary that
   * ranks somebody's weaknesses is a scoreboard, and a summary that names the
   * next thing to work on is a study plan.
   */
  weakestTopic: string | null;
}

const pct = (correct: number, answered: number): number =>
  answered === 0 ? 0 : Math.round((correct / answered) * 1000) / 10;

/**
 * Which topic to practise next.
 *
 * Lowest score first. Ties break on **exam weight** — two topics at 50% are not
 * equally worth an hour if one is a fifth of the paper and the other is a
 * fortieth. An unweighted topic sorts last on that tiebreak rather than first:
 * "no weight yet" is missing information, and guessing it is important would
 * send a student to revise something nobody has established matters.
 *
 * The final tiebreak is the name, so the same input always names the same topic.
 * A summary that reorders between two identical runs makes a student doubt the
 * one screen that is supposed to tell them what to do.
 */
export function pickWeakestTopic(topics: readonly TopicSummary[]): string | null {
  if (topics.length === 0) return null;
  const ranked = [...topics].sort((a, b) => {
    if (a.scorePct !== b.scorePct) return a.scorePct - b.scorePct;
    const aw = a.weightPct ?? -1;
    const bw = b.weightPct ?? -1;
    if (aw !== bw) return bw - aw;
    return a.topic.localeCompare(b.topic);
  });
  return ranked[0]!.topic;
}

export function summarise(attempts: readonly AttemptRow[]): PracticeSummary {
  const byTopic = new Map<
    string,
    { answered: number; correct: number; weightPct: number | null }
  >();

  for (const attempt of attempts) {
    const row = byTopic.get(attempt.topic) ?? {
      answered: 0,
      correct: 0,
      weightPct: attempt.weightPct,
    };
    row.answered += 1;
    if (attempt.isCorrect) row.correct += 1;
    // A weight that arrives on any attempt for the topic is the topic's weight.
    if (row.weightPct === null) row.weightPct = attempt.weightPct;
    byTopic.set(attempt.topic, row);
  }

  const topics: TopicSummary[] = [...byTopic.entries()]
    .map(([topic, row]) => ({
      topic,
      answered: row.answered,
      correct: row.correct,
      scorePct: pct(row.correct, row.answered),
      weightPct: row.weightPct,
    }))
    // Weakest first: the list is a study order, so the thing to do next is at
    // the top rather than buried under what already went well.
    .sort((a, b) => a.scorePct - b.scorePct || a.topic.localeCompare(b.topic));

  const correct = attempts.filter((a) => a.isCorrect).length;

  return {
    answered: attempts.length,
    correct,
    scorePct: pct(correct, attempts.length),
    topics,
    weakestTopic: pickWeakestTopic(topics),
  };
}
