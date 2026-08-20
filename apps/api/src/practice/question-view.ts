/**
 * What a student is allowed to see BEFORE they answer (T-106).
 *
 * The counterpart to `answer-view.ts`, and the reason both exist as explicit
 * types: the difference between them is the product's core asset. `GET
 * /questions/next` must never carry `isCorrect`, `whyWrong`, `conceptLine`,
 * `explanation` or `steps`.
 *
 * Built by **listing what goes in**, never by deleting from a question row.
 * A `delete q.explanation` style redaction is one forgotten field away from
 * leaking the answer key, and the forgotten field is always the one added later
 * by someone who never read this comment.
 */

export interface ServedOption {
  label: string;
  text: string;
}

export interface ServedQuestion {
  /**
   * Whether this student has answered this question before.
   *
   * Sent so the screen can *say so* when the free allowance is gone and the
   * only thing left to offer is a second look. Without it the product silently
   * loops a free student back through the ten they have already done, the
   * counter sits at zero, and it reads as a limit that is not being enforced —
   * which is exactly how QA read it. Re-practice being free is a decision worth
   * keeping; leaving it unsaid is not.
   *
   * Not answer content: it says nothing about whether they got it right.
   */
  alreadyAnswered: boolean;
  questionId: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  topic: string;
  options: ServedOption[];
  /**
   * Free questions left, or `null` where the free limit does not apply to this
   * delivery — a subscriber, an exam paper, a bot session with its own quota.
   *
   * A **count of the student's own allowance**, not question content, which is
   * why it is allowed through the pre-answer gate above. It is here rather than
   * only on the attempt result because the design states it while the student
   * is still choosing (handoff 1a/1d): learning that you are on your last free
   * question *after* spending it is the version of this number that helps
   * nobody.
   */
  freeRemaining: number | null;
}

/** Every key the pre-answer payload may contain. Asserted against a live response. */
export const SERVED_QUESTION_FIELDS = [
  'questionId',
  'stableId',
  'qType',
  'stem',
  'codeBlock',
  'timeLimitSec',
  'topic',
  'options',
  'freeRemaining',
  'alreadyAnswered',
] as const;

/** Keys that would leak the answer. Asserted absent, by name, in the e2e test. */
export const ANSWER_ONLY_FIELDS = [
  'isCorrect',
  'whyWrong',
  'conceptLine',
  'explanation',
  'steps',
  'correctLabel',
  'chosenLabel',
] as const;

type FieldsCoverType = Exclude<keyof ServedQuestion, (typeof SERVED_QUESTION_FIELDS)[number]>;
type TypeCoversFields = Exclude<(typeof SERVED_QUESTION_FIELDS)[number], keyof ServedQuestion>;
export const _fieldsCoverType: FieldsCoverType extends never ? true : false = true;
export const _typeCoversFields: TypeCoversFields extends never ? true : false = true;

/** The database shape this is built from — structural, so any matching query fits. */
export interface ServableQuestion {
  id: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  topic: { name: string };
  options: readonly { label: string; text: string }[];
}

/**
 * @param freeRemaining Free questions left, or `null` where no free limit
 * applies here. **Required, not defaulted**: a default would be a decision
 * about somebody's quota made silently by whichever call site forgot, and
 * `null` reads as "unlimited" to the screen showing it.
 */
export function toServedQuestion(
  q: ServableQuestion,
  freeRemaining: number | null,
  alreadyAnswered = false,
): ServedQuestion {
  return {
    freeRemaining,
    alreadyAnswered,
    questionId: q.id,
    stableId: q.stableId,
    qType: q.qType,
    stem: q.stem,
    codeBlock: q.codeBlock,
    timeLimitSec: q.timeLimitSec,
    topic: q.topic.name,
    // Rebuilt field by field. Spreading the option row would carry `isCorrect`
    // and `whyWrong` straight to the student.
    options: [...q.options]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((o) => ({ label: o.label, text: o.text })),
  };
}
