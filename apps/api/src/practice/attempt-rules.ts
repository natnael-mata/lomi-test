/**
 * The rules around recording an attempt, with no database involved.
 *
 * Pure like `publish-gate.ts` and `map-row.ts`: what counts as a valid
 * submission, how pacing is judged and how much free practice is left are
 * decisions worth testing in milliseconds.
 */
import { OPTION_LABELS, type OptionLabelLetter } from '../import/map-row';

/** PRODUCT.md: an unsubscribed student may attempt this many questions per field. */
export const FREE_ATTEMPTS_PER_FIELD = 10;

/**
 * The longest a single question may be recorded as having taken.
 *
 * Two hours is far beyond any question's limit (the gate caps those at 600s) and
 * far short of the numbers a broken client sends — a stale timer left running
 * overnight, or a clock that jumped. The value is **clamped, never rejected**:
 * `timeTakenSec` is only ever used for pacing, never for scoring, so a nonsense
 * duration must not cost a student the answer they just earned.
 */
export const MAX_TIME_TAKEN_SEC = 7200;

export interface AttemptSubmission {
  questionId?: unknown;
  chosenLabel?: unknown;
  timeTakenSec?: unknown;
}

export interface ValidSubmission {
  questionId: string;
  chosenLabel: OptionLabelLetter;
  timeTakenSec: number;
  /** Set when the supplied duration was unusable and had to be clamped. */
  timeNote: string | null;
}

export type SubmissionResult =
  { ok: true; submission: ValidSubmission } | { ok: false; reasons: string[] };

const isLabel = (s: string): s is OptionLabelLetter =>
  (OPTION_LABELS as readonly string[]).includes(s);

export function validateSubmission(body: AttemptSubmission): SubmissionResult {
  const reasons: string[] = [];

  const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : '';
  if (questionId === '') reasons.push('questionId is required.');

  const rawLabel =
    typeof body.chosenLabel === 'string' ? body.chosenLabel.trim().toUpperCase() : '';
  if (rawLabel === '') {
    // An attempt with no answer is not an attempt — it is a question that was
    // displayed. Recording one would put a wrong answer in a student's history
    // for something they never submitted.
    reasons.push('chosenLabel is required — an attempt with no answer is not an attempt.');
  } else if (!isLabel(rawLabel)) {
    reasons.push(`chosenLabel "${String(body.chosenLabel)}" is not one of A, B, C, D.`);
  }

  let timeTakenSec = 0;
  let timeNote: string | null = null;
  const raw = body.timeTakenSec;
  if (raw === undefined || raw === null) {
    timeNote = 'no duration supplied — recorded as 0 and not used for pacing';
  } else if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    timeNote = `duration ${JSON.stringify(raw)} is not a number — recorded as 0`;
  } else if (raw < 0) {
    timeNote = `duration ${raw}s is negative — recorded as 0`;
  } else if (raw > MAX_TIME_TAKEN_SEC) {
    timeTakenSec = MAX_TIME_TAKEN_SEC;
    timeNote = `duration ${Math.round(raw)}s exceeds ${MAX_TIME_TAKEN_SEC}s — clamped`;
  } else {
    timeTakenSec = Math.round(raw);
  }

  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    submission: { questionId, chosenLabel: rawLabel as OptionLabelLetter, timeTakenSec, timeNote },
  };
}

export type Pacing = 'within' | 'over' | 'unknown';

/**
 * How the student's time compares to the budget.
 *
 * A **separate axis from correctness**, and named so a UI cannot render it as
 * failure by accident. DESIGN.md: over the limit "reads Pending and is framed as
 * pacing, never as failure". A boolean called something like `failed` would
 * invite exactly that; `pacing: 'over'` cannot be mistaken for a wrong answer.
 *
 * `unknown` when no usable duration arrived — better than claiming a student was
 * within the limit on the strength of a zero we invented.
 */
export function pacingFor(
  timeTakenSec: number,
  timeLimitSec: number,
  hadUsableDuration: boolean,
): Pacing {
  if (!hadUsableDuration) return 'unknown';
  return timeTakenSec > timeLimitSec ? 'over' : 'within';
}

/**
 * How much free practice is left in this field.
 *
 * Counted in **distinct questions**, not attempts: T-111 says "may attempt
 * exactly 10 questions", and a student who re-answers one question to re-read
 * its explanation has not consumed a new question. Never negative — a limit that
 * reports `-3` invites a UI to render "-3 left".
 */
export function freeRemaining(distinctQuestionsAttempted: number): number {
  return Math.max(0, FREE_ATTEMPTS_PER_FIELD - distinctQuestionsAttempted);
}
