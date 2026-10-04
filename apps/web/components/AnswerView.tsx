/**
 * The explanation (T-113, T-114, T-115) — the product's signature component.
 *
 * Renders in one fixed order with **nothing behind a tap**: verdict, concept
 * line, solution, why-wrongs. No `<details>`, no accordion, no "show more".
 * A collapsed explanation is one most students never open, and the explanation
 * is the thing they are paying for.
 */
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
   * Hold back the per-option notes, for the same reason (T-268).
   *
   * **The reason check's distractors ARE these notes.** `buildReasonCheck` takes
   * the question's own `whyWrong` texts as the wrong options, so a student
   * choosing between four sentences could read three of them a few centimetres
   * above, each one labelled as the explanation for a wrong answer. The check
   * asks which sentence is the right reason; the screen was already saying which
   * ones are not.
   *
   * `withholdConcept` had exactly this bug for the *correct* option and was
   * fixed; the distractors are the other half of it, and QA saw the duplication
   * without seeing why it mattered.
   *
   * Held rather than removed. They arrive the moment the check is answered or
   * skipped — a student who does not know they are coming assumes this question
   * simply has none.
   */
  withholdWhyWrongs?: boolean;
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
  withholdWhyWrongs = false,
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
        <section data-section="question" className="flex flex-col gap-3">
          <p className="text-stem">{answer.stem}</p>
          {/*
            The same rows as practice, resolved and not pressable: the `.option`
            styles keyed on `data-state`, so a reviewed paper looks like the
            question the student answered rather than a second design of it.
          */}
          <ul className="flex flex-col gap-2.5" data-question-options="">
            {answer.options.map((option) => {
              const right = option.label === answer.correctLabel;
              const mine = option.label === answer.chosenLabel;
              const state = right ? 'correct' : mine ? 'wrong' : 'default';
              return (
                <li
                  key={option.label}
                  data-option={option.label}
                  data-correct={right ? '' : undefined}
                  data-chosen={mine ? '' : undefined}
                  data-state={state}
                  className="option"
                >
                  <span className="option-key" aria-hidden="true">
                    {option.label}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {/* The same word the why-wrongs use below. Two names for one
                      fact is a second thing to learn. */}
                  {right || mine ? (
                    <span
                      className={`text-caption inline-flex shrink-0 items-center gap-1.5 uppercase ${
                        right ? 'text-correct' : 'text-wrong'
                      }`}
                    >
                      <Icon name={right ? 'check' : 'cross'} size={16} strokeWidth={2.5} />
                      {right ? copy().answer.correct : copy().answer.yours}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 1. Verdict.
          The ONLY element that animates on entrance (T-117). The spring is the
          answer moment; anything else moving at the same time competes with it,
          and a page where four things animate reads as slow rather than alive. */}
      <section
        data-section="verdict"
        data-verdict={verdict}
        className={`${VERDICT_CLASS[verdict]} rounded-option animate-pop flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3.5`}
      >
        <span className="inline-flex items-center gap-2 text-[16px] font-bold">
          <Icon name={VERDICT_ICON[verdict]} size={20} strokeWidth={2.5} />
          {/* One element, so "Not quite. The answer is B." reads as one line of
              text with ordinary spacing, rather than two flex items a gap
              apart. The right letter is named when the chosen one was not it
              (handoff): nobody should have to scan the rows above for the
              green one. */}
          <span>
            {verdictWord(verdict)}
            {verdict === 'wrong' && answer.correctLabel
              ? `. ${copy().answer.theAnswerIs(answer.correctLabel)}`
              : ''}
          </span>
        </span>
        {timed && (
          <span className="num text-[14px] font-semibold">
            {clock(timeTakenSec)} / {clock(answer.timeLimitSec)}
          </span>
        )}
      </section>

      {/* 2. What was tested: the one thing to remember, unless it is currently
          the answer to the reason check below. See `withholdConcept`. */}
      {answer.conceptLine &&
        (withholdConcept ? (
          <section
            data-section="concept"
            data-withheld=""
            className="border-border text-ink-2 rounded-option border border-dashed p-4"
          >
            <p className="text-caption">{copy().practice.conceptAfterReason}</p>
          </section>
        ) : (
          <section
            data-section="concept"
            className="bg-brand-soft text-ink rounded-option flex flex-col gap-1 p-4"
          >
            <span className="text-caption text-link uppercase">{copy().answer.whatWasTested}</span>
            <p className="text-[16px] leading-6 font-medium">{answer.conceptLine}</p>
          </section>
        ))}

      {/* 3. The solution: numbered working for CALCULATION, prose otherwise. */}
      <section
        data-section="solution"
        className="border-border bg-surface rounded-option flex flex-col gap-3 border p-4"
      >
        <span className="text-caption text-ink-3 uppercase">
          {isCalculation && answer.steps.length > 0
            ? copy().answer.workedSolution
            : copy().answer.explanation}
        </span>
        {answer.codeBlock && <CodeBlock code={answer.codeBlock} />}
        {isCalculation && answer.steps.length > 0 ? (
          <ol className="flex flex-col gap-3" data-steps="">
            {answer.steps.map((step, index) => {
              /*
               * T-114: the last step states the answer choice, and the publish
               * gate refuses a calculation whose last step does not.
               * Highlighting it is what makes that rule visible to a student.
               *
               * **Green now, not the lemon** (redesign handoff: "the last step
               * green"). The lemon was chosen as the highlighter, the pen run
               * over the line that matters. But this line is not a takeaway,
               * it is the answer, and the answer already has a colour on this
               * screen: the green row a few inches above it. Two colours for one
               * fact made the student match them up; one makes them the same
               * thing. The numbered chip carries it too, so it is never colour
               * alone, and correct deep on its wash is an audited pair.
               */
              const isLast = index === answer.steps.length - 1;
              return (
                <li
                  key={step.stepNo}
                  data-step={step.stepNo}
                  data-final={isLast ? 'yes' : 'no'}
                  className="flex gap-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={`num grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                      isLast ? 'bg-correct text-on-state' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {step.stepNo}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className={`text-body ${isLast ? 'font-semibold' : ''}`}>
                      <span className="sr-only">{step.stepNo}. </span>
                      {step.text}
                    </p>
                    {step.formula && (
                      <p
                        className={`num rounded-control overflow-x-auto px-3 py-2 font-mono text-[14px] ${
                          isLast ? 'bg-correct-soft text-correct-deep' : 'bg-surface-2 text-ink'
                        }`}
                      >
                        {step.formula}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-body">{answer.explanation}</p>
        )}
      </section>

      {/* 4. Why each wrong option is wrong, the student's own answer first. */}
      {withholdWhyWrongs && whyWrongs.length > 0 ? (
        <section
          data-section="why-wrongs"
          data-withheld=""
          className="border-border text-ink-2 rounded-option border border-dashed p-4"
        >
          <p className="text-caption">{copy().practice.whyWrongsAfterReason}</p>
        </section>
      ) : null}
      {!withholdWhyWrongs && whyWrongs.length > 0 && (
        <section
          data-section="why-wrongs"
          className="border-border bg-surface rounded-option flex flex-col gap-4 border p-4"
        >
          {whyWrongs.map((option) => {
            const mine = isOwnAnswer(option, answer.chosenLabel);
            return (
              <div
                key={option.label}
                data-why-wrong={option.label}
                data-own={mine ? 'yes' : 'no'}
                className="flex flex-col gap-1"
              >
                <span className="flex items-center gap-2">
                  <span className="text-caption text-ink-3 uppercase">
                    {copy().answer.whyWrong(option.label)}
                  </span>
                  {/* The student's own wrong answer is named in words, not only
                      placed first: first is an order, and order is easy to miss. */}
                  {mine && <Chip tone="wrong">{copy().answer.yours}</Chip>}
                </span>
                <p className="text-body text-ink-2">{option.whyWrong}</p>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
