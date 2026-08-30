/**
 * The explanation (T-113, T-114, T-115) — the product's signature component.
 *
 * Renders in one fixed order with **nothing behind a tap**: verdict, concept
 * line, solution, why-wrongs. No `<details>`, no accordion, no "show more".
 * A collapsed explanation is one most students never open, and the explanation
 * is the thing they are paying for.
 */
import { Card } from './Card';
import { Chip } from './Chip';
import { CodeBlock } from './CodeBlock';
import { Icon } from './icons';
import {
  isOwnAnswer,
  orderWhyWrongs,
  verdictFor,
  verdictWord,
  type AnswerOption,
} from './answer-order';
import { copy } from '../lib/i18n';

export interface AnswerViewData {
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  chosenLabel: string | null;
  correctLabel: string | null;
  conceptLine: string | null;
  explanation: string | null;
  steps: { stepNo: number; text: string; formula: string | null }[];
  options: AnswerOption[];
}

export interface AnswerViewProps {
  answer: AnswerViewData;
  isCorrect: boolean;
  /**
   * Practice only. A mock exam is one three-hour block, not a hundred per-question
   * budgets, so there is no per-question time to report and both of these are
   * omitted — showing `0:00 / 1:00` beside a question somebody spent four minutes
   * on would be a made-up number on the screen a student trusts most.
   */
  pacing?: string;
  timeTakenSec?: number;
  /**
   * Hold back the concept line, because it is the answer to a question still
   * being asked.
   *
   * The reason check offers the question's own concept line among distractors
   * drawn from other questions' why-wrongs — and this component was printing
   * that exact sentence, verbatim, in a highlighted box a few centimetres above
   * the options. QA spotted it immediately: shuffling the options does nothing
   * when the answer is on the same screen.
   *
   * Held rather than removed. It arrives the moment the check is answered or
   * skipped, and the space says so, because a student who does not know the
   * explanation is coming will assume this question simply has none.
   */
  withholdConcept?: boolean;
  /**
   * Print the question itself above the answer (T-268).
   *
   * **Off in practice, on in a review, and that difference is why it was
   * missed.** In practice the stem and the four options are already on screen —
   * this component renders underneath them — so repeating the question would be
   * noise. A review has no such screen above it: `ExamReview` renders this
   * component and nothing else, so every entry read "Question 1 · Correct · [key
   * idea] · [explanation]" with no way to find out what had been asked. A
   * student rereading a paper they scored 11/20 on could not see the eleven.
   */
  showQuestion?: boolean;
}

/**
 * Full class strings, never built by interpolation.
 *
 * `bg-${tone}-soft` is invisible to Tailwind: it scans source text for complete
 * class names, so a constructed one generates no CSS and the card renders with
 * no background at all. It looks like a styling mistake and is actually a build
 * one, which is why the whole string is written out here.
 */
const VERDICT_CLASS = {
  correct: 'bg-correct-soft text-correct',
  pending: 'bg-pending-soft text-pending',
  wrong: 'bg-wrong-soft text-wrong',
  // Neutral on purpose. A blank is not an error, and dressing it in the wrong
  // colour would say the student made a mistake they did not make.
  unanswered: 'bg-surface-2 text-ink-2',
} as const;

/**
 * The glyph beside the verdict word.
 *
 * `pending` is the interesting one: it is "correct, but over the time" and it
 * takes the clock, not the cross. A student who got the answer right and took
 * too long has not got it wrong, and giving those two the same mark would say
 * they had.
 */
const VERDICT_ICON = {
  correct: 'check',
  pending: 'clock',
  wrong: 'cross',
  // Not a cross. The clock says what happened: they did not get to it.
  unanswered: 'clock',
} as const;

/** mm:ss, in tabular figures so two times line up when compared. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AnswerView({
  answer,
  isCorrect,
  pacing,
  timeTakenSec,
  withholdConcept = false,
  showQuestion = false,
}: AnswerViewProps) {
  const timed = pacing !== undefined && timeTakenSec !== undefined;
  // A blank is not a wrong answer — the review of a paper somebody ran short on
  // must not caption eighteen untouched questions "Not quite".
  const verdict = verdictFor(isCorrect, pacing ?? 'within', answer.chosenLabel !== null);
  const whyWrongs = orderWhyWrongs(answer.options, answer.chosenLabel);
  const isCalculation = answer.qType === 'CALCULATION';

  return (
    <div className="flex flex-col gap-3" data-answer-view="">
      {/*
        0 — the question, when nothing above is showing it.

        The options carry both marks a reader needs: which one was right, and
        which one they picked. Shown together rather than as two lists, because
        "I chose C, the answer was A" is one comparison and splitting it across
        the screen makes the reader do the join.
      */}
      {showQuestion && (
        <section data-section="question" className="flex flex-col gap-2">
          <p className="text-stem">{answer.stem}</p>
          <ul className="flex flex-col gap-1" data-question-options="">
            {answer.options.map((option) => {
              const right = option.label === answer.correctLabel;
              const mine = option.label === answer.chosenLabel;
              return (
                <li
                  key={option.label}
                  data-option={option.label}
                  data-correct={right ? '' : undefined}
                  data-chosen={mine ? '' : undefined}
                  className={`rounded-card flex items-start gap-2 p-2 ${
                    right ? 'bg-correct-soft text-correct' : 'bg-surface-2 text-ink'
                  }`}
                >
                  <span className="text-label num shrink-0">{option.label}</span>
                  <span className="text-body grow">{option.text}</span>
                  {/* The same word the why-wrongs use below. Two names for
                      "the one you picked" on one screen is one too many. */}
                  {mine && <Chip tone={right ? 'correct' : 'wrong'}>{copy().answer.yours}</Chip>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 1 — verdict.
          The ONLY element that animates on entrance (T-117). The spring is the
          answer moment; anything else moving at the same time competes with it,
          and a page where four things animate reads as slow rather than alive. */}
      <section
        data-section="verdict"
        data-verdict={verdict}
        className={`${VERDICT_CLASS[verdict]} rounded-card animate-pop flex items-center justify-between gap-3 p-4`}
      >
        <span className="text-label inline-flex items-center gap-2">
          <Icon name={VERDICT_ICON[verdict]} size={20} strokeWidth={2.5} />
          {verdictWord(verdict)}
        </span>
        {timed && (
          <span className="text-label num">
            {clock(timeTakenSec)} / {clock(answer.timeLimitSec)}
          </span>
        )}
      </section>

      {/* 2 — concept line: the one thing to remember, unless it is currently
             the answer to the reason check below. See `withholdConcept`. */}
      {answer.conceptLine &&
        (withholdConcept ? (
          <section
            data-section="concept"
            data-withheld=""
            className="border-border text-ink-2 rounded-card border border-dashed p-4"
          >
            <p className="text-caption">{copy().practice.conceptAfterReason}</p>
          </section>
        ) : (
          <section data-section="concept" className="bg-brand-soft text-ink rounded-card p-4">
            <p className="text-stem">{answer.conceptLine}</p>
          </section>
        ))}

      {/* 3 — solution: prose for CONCEPT, numbered working for CALCULATION */}
      <section data-section="solution">
        <Card>
          {answer.codeBlock && (
            <div className="mb-3">
              <CodeBlock code={answer.codeBlock} />
            </div>
          )}
          {isCalculation && answer.steps.length > 0 ? (
            <ol className="flex flex-col gap-2" data-steps="">
              {answer.steps.map((step, index) => {
                /*
                 * T-114: the last step states the answer choice, and the publish
                 * gate refuses a calculation whose last step does not.
                 * Highlighting it is what makes that rule visible to a student.
                 *
                 * The MARKER highlights it (handoff frame 3b), not the mint.
                 * The lemon is the highlighter in this system — the pen you run
                 * over the line that matters — and mint had quietly taken on a
                 * fourth job here after picking up selected, correct and the
                 * active nav. A highlighter over the final line is also just
                 * what a student does to their own working on paper.
                 *
                 * Ink on lemon is 11.24:1, against 6.23:1 for the teal-on-mint
                 * it replaces.
                 */
                const isLast = index === answer.steps.length - 1;
                return (
                  <li
                    key={step.stepNo}
                    data-step={step.stepNo}
                    data-final={isLast ? 'yes' : 'no'}
                    className={
                      isLast
                        ? 'bg-brand text-on-brand rounded-card p-3 font-semibold'
                        : 'bg-surface-2 rounded-card p-3'
                    }
                  >
                    {step.formula && (
                      <p className="text-caption num mb-1 font-mono">{step.formula}</p>
                    )}
                    <p className="text-body">
                      <span className="num mr-2">{step.stepNo}.</span>
                      {step.text}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-body">{answer.explanation}</p>
          )}
        </Card>
      </section>

      {/* 4 — why-wrongs, the student's own answer first */}
      {whyWrongs.length > 0 && (
        <section data-section="why-wrongs" className="flex flex-col gap-2">
          {whyWrongs.map((option) => {
            const mine = isOwnAnswer(option, answer.chosenLabel);
            return (
              <div
                key={option.label}
                data-why-wrong={option.label}
                data-own={mine ? 'yes' : 'no'}
                className={`rounded-card p-4 ${mine ? 'bg-wrong-soft' : 'bg-surface-2'}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="option-key">{option.label}</span>
                  {mine && <Chip tone="wrong">{copy().answer.yours}</Chip>}
                </div>
                <p className="text-body text-ink-2">{option.whyWrong}</p>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
