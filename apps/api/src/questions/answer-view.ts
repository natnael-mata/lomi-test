/**
 * The answer view contract — everything a student sees *after* attempting a
 * question, and nothing they see before.
 *
 * Defined once and shared, because two callers need to agree about it: the
 * attempt response a student receives, and the review payload a reviewer judges.
 * A reviewer approving a question they can see more of than the student can is
 * approving something else.
 *
 * PRODUCT.md fixes the render order — **verdict → concept line → solution →
 * why-wrongs**, with nothing behind an extra tap — and the fields below are
 * declared in that order. `ANSWER_VIEW_FIELDS` makes it assertable rather than a
 * comment somebody has to remember.
 *
 * Equally important is what this type is the *only* home for: `isCorrect`,
 * `whyWrong`, `conceptLine`, the explanation and the steps are answer content.
 * `GET /questions/next` must never carry them.
 */

export interface AnswerViewOption {
  label: string;
  text: string;
  isCorrect: boolean;
  /** Why this option is wrong. Null on the correct one, and on unreviewed drafts. */
  whyWrong: string | null;
}

export interface AnswerViewStep {
  stepNo: number;
  text: string;
  formula: string | null;
}

export interface AnswerView {
  questionId: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;

  /**
   * What the student picked, and so whether they got it right.
   *
   * `null` in review: nobody has attempted the question, so there is no verdict
   * to render. The reviewer sees the rest of the view exactly as a student would.
   */
  chosenLabel: string | null;
  correctLabel: string | null;

  conceptLine: string | null;

  /**
   * The solution. A CONCEPT question explains in prose; a CALCULATION shows
   * numbered working whose last step names the answer (the gate enforces it).
   * Both fields are present in the shape so the renderer does not branch on
   * which keys exist — only on which is populated.
   */
  explanation: string | null;
  steps: AnswerViewStep[];

  /** Every option, so the why-wrongs can be shown against the choices. */
  options: AnswerViewOption[];
}

/**
 * The contract's fields, in render order. Asserted against a real response so a
 * field added in the wrong place, or quietly dropped, fails a test.
 */
export const ANSWER_VIEW_FIELDS = [
  'questionId',
  'stableId',
  'qType',
  'stem',
  'codeBlock',
  'timeLimitSec',
  'chosenLabel',
  'correctLabel',
  'conceptLine',
  'explanation',
  'steps',
  'options',
] as const;

type FieldsCoverType = Exclude<keyof AnswerView, (typeof ANSWER_VIEW_FIELDS)[number]>;
type TypeCoversFields = Exclude<(typeof ANSWER_VIEW_FIELDS)[number], keyof AnswerView>;
export const _fieldsCoverType: FieldsCoverType extends never ? true : false = true;
export const _typeCoversFields: TypeCoversFields extends never ? true : false = true;

/** The database shape this is built from — structural, so any query with these fields fits. */
export interface AnswerViewSource {
  id: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  conceptLine: string | null;
  explanation: string | null;
  options: readonly { label: string; text: string; isCorrect: boolean; whyWrong: string | null }[];
  steps: readonly { stepNo: number; text: string; formula: string | null }[];
}

export function toAnswerView(q: AnswerViewSource, chosenLabel: string | null = null): AnswerView {
  const correct = q.options.filter((o) => o.isCorrect);

  return {
    questionId: q.id,
    stableId: q.stableId,
    qType: q.qType,
    stem: q.stem,
    codeBlock: q.codeBlock,
    timeLimitSec: q.timeLimitSec,
    chosenLabel,
    // Null when the draft has no answer yet, and also when it has more than one:
    // naming one of two would be picking a winner the gate has not accepted.
    correctLabel: correct.length === 1 ? correct[0]!.label : null,
    conceptLine: q.conceptLine,
    explanation: q.explanation,
    steps: [...q.steps]
      .sort((a, b) => a.stepNo - b.stepNo)
      .map((s) => ({ stepNo: s.stepNo, text: s.text, formula: s.formula })),
    options: [...q.options]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((o) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect,
        whyWrong: o.whyWrong,
      })),
  };
}
