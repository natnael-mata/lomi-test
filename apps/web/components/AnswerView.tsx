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
import {
  isOwnAnswer,
  orderWhyWrongs,
  verdictFor,
  verdictWord,
  type AnswerOption,
} from './answer-order';

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
  pacing: string;
  timeTakenSec: number;
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
} as const;

/** mm:ss, in tabular figures so two times line up when compared. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AnswerView({ answer, isCorrect, pacing, timeTakenSec }: AnswerViewProps) {
  const verdict = verdictFor(isCorrect, pacing);
  const whyWrongs = orderWhyWrongs(answer.options, answer.chosenLabel);
  const isCalculation = answer.qType === 'CALCULATION';

  return (
    <div className="flex flex-col gap-3" data-answer-view="">
      {/* 1 — verdict */}
      <section
        data-section="verdict"
        data-verdict={verdict}
        className={`${VERDICT_CLASS[verdict]} rounded-card flex items-center justify-between gap-3 p-4`}
      >
        <span className="text-label">{verdictWord(verdict)}</span>
        <span className="text-label num">
          {clock(timeTakenSec)} / {clock(answer.timeLimitSec)}
        </span>
      </section>

      {/* 2 — concept line: the one thing to remember */}
      {answer.conceptLine && (
        <section data-section="concept" className="bg-brand-soft text-ink rounded-card p-4">
          <p className="text-stem">{answer.conceptLine}</p>
        </section>
      )}

      {/* 3 — solution: prose for CONCEPT, numbered working for CALCULATION */}
      <section data-section="solution">
        <Card>
          {isCalculation && answer.steps.length > 0 ? (
            <ol className="flex flex-col gap-2" data-steps="">
              {answer.steps.map((step, index) => {
                // T-114: the last step states the answer choice, and the publish
                // gate refuses to publish a calculation whose last step does not.
                // Highlighting it is what makes that rule visible to a student.
                const isLast = index === answer.steps.length - 1;
                return (
                  <li
                    key={step.stepNo}
                    data-step={step.stepNo}
                    data-final={isLast ? 'yes' : 'no'}
                    className={
                      isLast
                        ? 'bg-correct-soft text-correct rounded-control p-3'
                        : 'bg-surface-2 rounded-control p-3'
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
                  {mine && <Chip tone="wrong">Yours</Chip>}
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
