/**
 * The second half of "beaten" (T-255).
 *
 * **A question counts as beaten when the student answered it correctly AND
 * named the reason it is right.** Not when they guessed right.
 *
 * This is the guard against the bank problem, and it is load-bearing rather
 * than pedantry. The Ethiopian exam is drawn from a question bank, so questions
 * repeat — sometimes verbatim, sometimes with the numbers changed. A student
 * who memorises the letter passes the app and fails the paper, and a coverage
 * figure built on lucky guesses is the product lying in the most damaging way
 * available to it: telling somebody they are ready when they are not.
 *
 * It invents no content. The right answer is the question's own `conceptLine`
 * — the one sentence worth remembering, already written and already reviewed —
 * and the distractors are the `whyWrong` texts of its wrong options, which are
 * plausible by construction because they were authored as plausible.
 *
 * Pure: no database, no clock, no randomness of its own. Everything that varies
 * is passed in, so the awkward cases can be tested in milliseconds.
 */
import { createHmac } from 'node:crypto';

/** One choice as the student sees it. The id carries no hint of correctness. */
export interface ReasonOption {
  id: string;
  text: string;
}

export interface ReasonCheck {
  /** Which attempt this belongs to — the client posts it back. */
  attemptId: string;
  options: ReasonOption[];
}

/** What the check is built from. Shaped structurally so any matching query fits. */
export interface ReasonSource {
  conceptLine: string | null;
  options: { label: string; isCorrect: boolean; whyWrong: string | null }[];
}

/**
 * The fewest distractors worth showing.
 *
 * One right answer and one wrong one is a coin toss, and a coin toss recorded
 * as evidence of understanding is worse than not asking — it would let half of
 * all guesses count as beaten. Two distractors puts a guess at one in three.
 */
export const MIN_DISTRACTORS = 2;

/**
 * A stable, unguessable id for one choice.
 *
 * **Not the source name.** The obvious encoding — `concept` for the right one,
 * `why-B` for a distractor — is guessable in one try by anybody who opens the
 * network tab, which would make the whole check decorative. Keyed on the
 * attempt so the same text gets a different id every time it is asked, and so
 * an id from one attempt cannot be replayed against another.
 *
 * Truncated to 16 hex characters: this is a lookup key inside one request, not
 * a signature over a claim, and the secret never leaves the server.
 */
function choiceId(secret: string, attemptId: string, source: string): string {
  return createHmac('sha256', secret).update(`${attemptId}:${source}`).digest('hex').slice(0, 16);
}

/** The source string for the right choice. Only ever hashed, never sent. */
const CONCEPT = 'concept';

/**
 * Builds the check, or returns null when this question cannot carry one.
 *
 * Null is a real and common answer: a question with no `conceptLine`, or with
 * too few authored `whyWrong` texts, cannot ask *why* without inventing the
 * alternatives — and an invented distractor is either obviously wrong (so the
 * check proves nothing) or accidentally right (so it punishes understanding).
 * Better to leave the question unbeatable until its content is finished than to
 * fabricate the evidence that it was understood.
 *
 * `order` is supplied by the caller rather than shuffled here, so the ordering
 * is reproducible in a test and this file stays pure.
 */
export function buildReasonCheck(
  secret: string,
  attemptId: string,
  question: ReasonSource,
  order: (items: ReasonOption[]) => ReasonOption[],
): ReasonCheck | null {
  const concept = question.conceptLine?.trim() ?? '';
  if (concept === '') return null;

  const distractors = question.options
    .filter((o) => !o.isCorrect)
    .map((o) => o.whyWrong?.trim() ?? '')
    .filter((text) => text !== '' && text !== concept);

  // Deduplicated: two options can share a why-wrong, and offering the same
  // sentence twice tells the student one of them is a filler.
  const unique = [...new Set(distractors)];
  if (unique.length < MIN_DISTRACTORS) return null;

  const options: ReasonOption[] = [
    { id: choiceId(secret, attemptId, CONCEPT), text: concept },
    ...unique.map((text) => ({ id: choiceId(secret, attemptId, `why:${text}`), text })),
  ];

  return { attemptId, options: order(options) };
}

/**
 * Whether a posted choice is the right one.
 *
 * Recomputed rather than stored: the id is a function of the secret, the
 * attempt and the text, so grading needs no row of its own and there is nothing
 * to fall out of step with the question if it is edited later.
 */
export function isReasonCorrect(
  secret: string,
  attemptId: string,
  conceptLine: string | null,
  chosenId: string,
): boolean {
  const concept = conceptLine?.trim() ?? '';
  if (concept === '') return false;
  return chosenId === choiceId(secret, attemptId, CONCEPT);
}
