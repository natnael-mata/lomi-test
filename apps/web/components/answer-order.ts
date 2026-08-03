/**
 * Ordering rules for the answer view (T-113, T-115).
 *
 * Pure, so the two orderings that carry meaning can be tested without a DOM.
 */

/**
 * The fixed order of the answer view, top to bottom.
 *
 * PRODUCT.md and DESIGN.md both state it, and it is not a layout preference: a
 * student who has just got a question wrong needs the verdict, then the one
 * sentence worth remembering, then the working, then why their own answer was
 * wrong — in that order, with **nothing behind an extra tap**. A collapsed
 * explanation is an explanation most people never read.
 */
export const ANSWER_SECTIONS = ['verdict', 'concept', 'solution', 'why-wrongs'] as const;
export type AnswerSection = (typeof ANSWER_SECTIONS)[number];

export interface AnswerOption {
  label: string;
  text: string;
  isCorrect: boolean;
  whyWrong: string | null;
}

/**
 * The why-wrong cards, in the order a student should meet them.
 *
 * **Their own wrong answer first** (T-115). That card is the only one that
 * explains the mistake they actually made; leaving it third means scanning four
 * cards while already feeling stupid. The rest keep their natural A–D order, so
 * the list is still predictable.
 *
 * The correct option is never a why-wrong card — it is not wrong.
 */
export function orderWhyWrongs(
  options: readonly AnswerOption[],
  chosenLabel: string | null,
): AnswerOption[] {
  const distractors = options.filter((o) => !o.isCorrect);
  const mine = distractors.filter((o) => o.label === chosenLabel);
  const rest = distractors
    .filter((o) => o.label !== chosenLabel)
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...mine, ...rest];
}

/** Whether this card is the student's own answer, for the tinted treatment. */
export const isOwnAnswer = (option: AnswerOption, chosenLabel: string | null): boolean =>
  chosenLabel !== null && option.label === chosenLabel;

export type Verdict = 'correct' | 'wrong' | 'pending';

/**
 * The verdict to show.
 *
 * Over the time limit reads **pending**, never failure — DESIGN.md is explicit,
 * and a student who got it right slowly has still got it right. Correctness
 * decides the word; pacing only softens it.
 */
export function verdictFor(isCorrect: boolean, pacing: string): Verdict {
  if (!isCorrect) return 'wrong';
  return pacing === 'over' ? 'pending' : 'correct';
}

/** The word shown beside the verdict icon. */
export function verdictWord(verdict: Verdict): string {
  if (verdict === 'correct') return 'Correct';
  if (verdict === 'pending') return 'Correct, over time';
  return 'Not quite';
}
