/**
 * Readiness (T-135, T-136, T-137), with no database involved.
 *
 * **What readiness claims to be.** "Given how you have answered so far, this is
 * how much of the exam you are currently getting right." It is not a prediction
 * of a grade and the wording never says it is — the figure is the weighted mean
 * of per-topic scores, weighted by each topic's share of past papers, and every
 * number on the screen can be reconstructed from the rows above it. That last
 * property is a DESIGN.md rule, not a nicety: a headline nobody can check is a
 * headline students stop believing the first time it disagrees with them.
 *
 * Three decisions with obvious wrong answers:
 *
 * 1. **One score per question, from its most recent answer.** Not one per
 *    attempt. Counting every attempt would let a student lift their readiness by
 *    grinding the same question, and it would hold an early mistake against them
 *    forever. The latest answer is the current evidence.
 *
 * 2. **A mock question left unanswered is not evidence.** It is graded wrong for
 *    the mock score, correctly — the paper was not finished. But "ran out of
 *    time" is a pacing fact, not a knowledge one, and folding it into readiness
 *    would tell a student they do not understand a topic they were never asked
 *    about. It is excluded, and the count of excluded questions is reported so
 *    the screen can say so.
 *
 * 3. **A topic with no answers has no score.** Not zero. Zero says "you get none
 *    of this right", which is a claim about a student who has not been asked.
 *    Unanswered topics are carried with `scorePct: null`, kept out of the mean,
 *    and their weight is reported separately as `unassessedWeightPct` so the
 *    screen can show the honest gap instead of a headline computed over a
 *    fraction of the exam while looking like it covers all of it.
 */

/** DESIGN.md: rows below this switch to Pending and gain a Focus chip. */
export const PASS_SAFE_PCT = 60;

/** One question the student has answered, at its most recent answer. */
export interface AnsweredQuestion {
  questionId: string;
  topicId: string;
  isCorrect: boolean;
}

export interface WeightedTopic {
  topicId: string;
  topicName: string;
  /** Whole percent, 0–100. Across a field these sum to exactly 100. */
  weightPct: number;
  weightSource: 'derived' | 'override';
}

export interface TopicReadiness extends WeightedTopic {
  answered: number;
  correct: number;
  /** 0–100, or `null` when the student has not answered anything here. */
  scorePct: number | null;
  /** T-137: below the pass-safe line, and therefore worth an hour. */
  focus: boolean;
}

export interface Readiness {
  topics: TopicReadiness[];
  /**
   * The weighted mean over the topics that have a score (T-136), or `null` when
   * nothing has been answered at all.
   */
  headlinePct: number | null;
  /** Share of the exam the headline is actually computed over, 0–100. */
  assessedWeightPct: number;
  /** Share of the exam nobody has been asked about yet, 0–100. */
  unassessedWeightPct: number;
  /** Focus topics, heaviest first — a revision order. */
  focus: TopicReadiness[];
  /** Mock questions left unanswered, excluded from the scores above. */
  unansweredInMocks: number;
  totalAnswered: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Reduces every answer a student has given to one row per question.
 *
 * `answers` must be ordered oldest first; the last mention of a question wins.
 * Ordering is the caller's job because only the caller knows what "later" means
 * across two tables — a practice attempt and a mock answer are both timestamped,
 * and merging them correctly is a query concern, not an arithmetic one.
 */
export function latestPerQuestion(answers: readonly AnsweredQuestion[]): AnsweredQuestion[] {
  const byQuestion = new Map<string, AnsweredQuestion>();
  for (const answer of answers) byQuestion.set(answer.questionId, answer);
  return [...byQuestion.values()];
}

export function buildReadiness(
  topics: readonly WeightedTopic[],
  answers: readonly AnsweredQuestion[],
  unansweredInMocks = 0,
): Readiness {
  const latest = latestPerQuestion(answers);

  const counts = new Map<string, { answered: number; correct: number }>();
  for (const answer of latest) {
    const row = counts.get(answer.topicId) ?? { answered: 0, correct: 0 };
    row.answered += 1;
    if (answer.isCorrect) row.correct += 1;
    counts.set(answer.topicId, row);
  }

  const rows: TopicReadiness[] = topics.map((topic) => {
    const count = counts.get(topic.topicId) ?? { answered: 0, correct: 0 };
    const scorePct = count.answered === 0 ? null : round1((count.correct / count.answered) * 100);
    return {
      ...topic,
      answered: count.answered,
      correct: count.correct,
      scorePct,
      // An unscored topic is not "failing" — nobody has asked. It carries no
      // Focus chip, because a chip saying "revise this" next to a topic with no
      // evidence is the system inventing a recommendation.
      focus: scorePct !== null && scorePct < PASS_SAFE_PCT,
    };
  });

  const assessed = rows.filter((r) => r.scorePct !== null);
  const assessedWeight = assessed.reduce((sum, r) => sum + r.weightPct, 0);
  const weighted = assessed.reduce((sum, r) => sum + r.scorePct! * r.weightPct, 0);

  return {
    topics: rows,
    // Divided by the weight actually assessed, not by 100. Dividing by 100 would
    // silently scale the headline down by however much of the exam the student
    // has not touched — a student who has answered one topic perfectly would be
    // told they are 12% ready, which reads as a score rather than as coverage.
    headlinePct: assessedWeight === 0 ? null : round1(weighted / assessedWeight),
    assessedWeightPct: round1(assessedWeight),
    unassessedWeightPct: round1(
      rows.filter((r) => r.scorePct === null).reduce((sum, r) => sum + r.weightPct, 0),
    ),
    focus: [...rows]
      .filter((r) => r.focus)
      // Heaviest first: a revision order, so the topic worth the most marks is
      // at the top rather than whichever happened to be worst.
      .sort((a, b) => b.weightPct - a.weightPct || a.topicName.localeCompare(b.topicName)),
    unansweredInMocks,
    totalAnswered: latest.length,
  };
}
