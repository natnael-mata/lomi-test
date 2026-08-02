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
  questionId: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  topic: string;
  options: ServedOption[];
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

export function toServedQuestion(q: ServableQuestion): ServedQuestion {
  return {
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
