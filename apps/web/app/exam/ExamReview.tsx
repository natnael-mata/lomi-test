'use client';

/**
 * A mock's results (redesign handoff, § Results), at `/exam/review/[id]`.
 *
 * The score on the dark surface, the score by topic beside it, and then the
 * questions: the missed ones first, each opening its full explanation in place.
 * The simulator sends a student here the moment they submit, and Mocks links
 * here from every past paper, so this is the one page a result lives on.
 *
 * **Every figure is the result's own.** The handoff's card shows "Time used";
 * the result carries no start time, so Blank takes that slot, which it does
 * carry. The pass mark badge is built and stays hidden until there is a real
 * pass mark to state (`PASS_MARK_PCT`).
 *
 * **Missed first, everything reachable.** The handoff lists only the missed
 * questions. The ones answered right are worth reading too (a lucky guess looks
 * exactly like knowing it from here), so the list has two views: Missed by
 * default, and All.
 */
import { useState } from 'react';

import { AnswerView } from '../../components/AnswerView';
import { Button } from '../../components/Button';
import { ExamSummary } from '../../components/ExamSummary';
import { Icon } from '../../components/icons';
import type { SittingResult } from '../../lib/api';
import { copy } from '../../lib/i18n';
import { PASS_MARK_PCT } from '../../lib/pass-mark';

/**
 * Not a disclosure limit: every explanation is reachable. A hundred answer
 * views at once is a slow first paint on the phones this is built for, so the
 * rest arrive on request, and the button says how many.
 */
const FIRST_PAGE = 10;

export function ExamReview({ result }: { result: SittingResult }) {
  const c = copy();
  const [view, setView] = useState<'missed' | 'all'>('missed');
  const [shown, setShown] = useState(FIRST_PAGE);

  const missed = result.items.filter(
    (item) => item.answerView.chosenLabel !== item.answerView.correctLabel,
  );
  const listed = view === 'missed' ? missed : result.items;
  const visible = listed.slice(0, shown);
  const rest = listed.length - visible.length;

  const closedEarly = result.closeReason !== 'SUBMITTED';
  const wrong = result.answeredCount - result.scoreCorrect;
  const blank = result.totalQuestions - result.answeredCount;
  const passed = PASS_MARK_PCT === null ? null : result.scorePct >= PASS_MARK_PCT;

  return (
    <div className="flex flex-col gap-6" data-exam-review="">
      <a
        href="/mocks"
        className="text-ink hover:text-link -ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-[14px] font-semibold"
      >
        <Icon name="chevronLeft" size={18} />
        {c.exam.backToMocks}
      </a>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* The score, on the dark surface: the one hero figure on the page. */}
        <section className="bg-ink-deep on-deep text-on-deep rounded-card flex flex-col gap-4 self-start p-6">
          <span className="text-caption text-on-deep-2 uppercase">
            {closedEarly
              ? c.results.timedOut(result.examName)
              : c.results.submitted(result.examName)}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display num text-brand text-[64px] leading-none font-extrabold tracking-[-0.03em]">
              {result.scoreCorrect}
            </span>
            <span className="font-display text-on-deep-2 text-[22px] font-bold">
              {c.results.outOf(result.totalQuestions)}
            </span>
          </div>
          {/* What the figure is a proportion of, said beside it (the stated
              figure rule): a score is a share of a paper, not a total. */}
          <span className="text-on-deep-2 text-[14px]">
            {blank > 0
              ? c.summary.ofThePaperWithUnanswered(result.scorePct, blank)
              : c.summary.ofThePaper(result.scorePct)}
          </span>
          {passed !== null && PASS_MARK_PCT !== null ? (
            <span
              className={`self-start rounded-full px-3 py-1 text-[13px] font-bold ${
                passed ? 'bg-correct-soft text-correct-deep' : 'bg-pending-soft text-pending'
              }`}
            >
              {passed ? c.results.abovePass(PASS_MARK_PCT) : c.results.belowPass(PASS_MARK_PCT)}
            </span>
          ) : null}
          {closedEarly ? (
            <p className="text-on-deep-2 text-[14px]" data-closed-early="">
              {c.exam.ranOutOfTime}
            </p>
          ) : null}
          <dl className="border-on-deep/10 grid grid-cols-3 gap-2 border-t pt-4">
            {[
              [c.results.correct, result.scoreCorrect],
              [c.results.wrong, wrong],
              [c.results.blank, blank],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dd className="font-display num text-[22px] font-extrabold">{value}</dd>
                <dt className="text-on-deep-2 text-[12px] font-medium">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <ExamSummary summary={result} showScore={false} />
      </div>

      <section
        className="border-border bg-surface rounded-card overflow-hidden border"
        data-review-items=""
      >
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex flex-col">
            <h2 className="font-display text-[18px] font-bold">
              {view === 'missed' ? c.results.missedTitle : c.results.allTitle}
            </h2>
            {view === 'missed' ? (
              <span className="text-ink-3 text-[14px]">{c.results.toReview(missed.length)}</span>
            ) : null}
          </div>
          {/* Two views of one list, as a pair of toggle buttons. */}
          <div className="bg-surface-2 rounded-control flex p-1" role="group">
            {(
              [
                ['missed', c.results.showMissed(missed.length)],
                ['all', c.results.showAll(result.items.length)],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => {
                  setView(key);
                  setShown(FIRST_PAGE);
                }}
                className={`rounded-control min-h-11 px-3 text-[14px] font-semibold ${
                  view === key ? 'bg-surface text-ink shadow-card' : 'text-ink-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {listed.length === 0 ? (
          <p className="text-ink-2 px-6 py-5 text-[15px]">{c.results.nothingMissed}</p>
        ) : (
          <ul>
            {visible.map((item) => {
              const answer = item.answerView;
              return (
                <li
                  key={item.position}
                  data-review-item={item.position}
                  className="border-border border-b last:border-b-0"
                >
                  {/*
                    Each question opens in place (handoff: "a missed questions
                    list that opens the Practice answer view"). A <details>, so
                    it works before the JavaScript arrives, is announced as
                    expandable, and keeps its own open state.
                  */}
                  <details className="group">
                    <summary className="hover:bg-bg flex min-h-[56px] cursor-pointer list-none items-start gap-4 px-6 py-4">
                      <span className="font-display num w-10 shrink-0 text-[16px] font-extrabold">
                        {c.exam.questionShort(item.position)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {/* Hidden once open: the full question is printed
                            right below, and the stem twice is once too many. */}
                        <span className="text-ink line-clamp-2 text-[15px] leading-[22px] font-medium group-open:hidden">
                          {answer.stem}
                        </span>
                        <span className="text-ink-3 text-[13px]">
                          {c.results.youChose(answer.chosenLabel, answer.correctLabel)}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-ink-3 shrink-0 pt-0.5 transition-transform group-open:rotate-90"
                      >
                        <Icon name="chevronRight" size={18} />
                      </span>
                    </summary>
                    <div className="px-6 pb-6">
                      <AnswerView
                        answer={answer}
                        isCorrect={answer.chosenLabel === answer.correctLabel}
                        // The row above shows only the first lines of the stem;
                        // the explanation needs the whole question and its
                        // options to be read against.
                        showQuestion
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {rest > 0 && (
          <div className="border-border border-t p-4">
            <Button variant="ghost" onClick={() => setShown((n) => n + FIRST_PAGE)}>
              {c.exam.showMore(Math.min(rest, FIRST_PAGE))}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
