'use client';

/**
 * The practice screen (T-112, design handoff 1a–1e) — the core loop.
 *
 * One question at a time, answered, explained, next. The four states it can be
 * in are distinct on purpose: asking, explaining, out of questions for today,
 * and out of free questions. Nothing is collapsed and nothing is behind a tap.
 *
 * **The layout is part of the design, not a detail of it.** The handoff draws
 * this at 375px with the primary action pinned to the bottom of the viewport —
 * *"one question fills the viewport, no scrolling to reach the button"*. That
 * is `mt-auto` on the button and `flex-1` on the column, and it is why the
 * screen sets its own vertical rhythm rather than letting the content decide
 * where the control lands.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { AnswerOptionGroup } from '../../components/AnswerOptionGroup';
import { AnswerView } from '../../components/AnswerView';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ExamTimer } from '../../components/ExamTimer';
import { Chip } from '../../components/Chip';
import { CodeBlock } from '../../components/CodeBlock';
import { Icon } from '../../components/icons';
import { Paywall } from '../../components/Paywall';
import { SessionSummary } from '../../components/SessionSummary';
import type { OptionLabel } from '../../components/AnswerOption';
import {
  ApiError,
  api,
  signInRequired,
  type AttemptResult,
  type PlanOffer,
  type PracticeSummary,
  type ServedQuestion,
  refusalMessage,
} from '../../lib/api';
import { copy } from '../../lib/i18n';

type Phase =
  | { kind: 'loading' }
  | { kind: 'asking'; question: ServedQuestion }
  | { kind: 'answered'; question: ServedQuestion; result: AttemptResult }
  | { kind: 'exhausted'; summary: PracticeSummary | null }
  | { kind: 'paywalled'; plans: PlanOffer[] }
  | { kind: 'error'; message: string; code: string | null };

export function PracticeScreen() {
  const c = copy();
  /*
   * The topic the caller asked to work on, from `?topic=` (T-269).
   *
   * `PracticeCta` has been writing that parameter since it was built — it is
   * what "→ Practise Depreciation" on `/progress` links to, with a unit test
   * pinning the URL — and this screen never read it. So the one control in the
   * product whose job is "do this next" handed back a random question from the
   * whole programme, and a student following the app's own advice practised
   * something else. Read from `location` rather than `useSearchParams` to keep
   * this route out of a Suspense boundary it does not otherwise need.
   */
  const [topicId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('topic'),
  );
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [chosen, setChosen] = useState<OptionLabel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /**
   * The reason check, once it has been answered (T-255).
   *
   * Held separately from the phase because the answer view stays on screen
   * throughout: the check is a step *within* the explanation, not a screen that
   * replaces it. A student who picks the wrong reason must still be able to read
   * why their answer was right — that is the whole remedy.
   */
  const [reason, setReason] = useState<{ correct: boolean; chosenId: string | null } | null>(null);
  const [naming, setNaming] = useState(false);
  /**
   * Whether this student has ever paid, read only once the allowance is gone.
   *
   * Deliberately lazy. This route has the tightest budget in the product and
   * nine students in ten never see the panel it feeds — but the one who does
   * and *has* paid before must not be told they have used up a trial. QA read
   * that sentence on an account holding a lapsed twelve-month subscription.
   */
  const [everPaid, setEverPaid] = useState(false);
  /**
   * Today's answers against the daily target, for the header bar.
   *
   * Null until both reads land, and null if either fails or there is no
   * target (no sitting date): the bar is left out rather than drawn empty.
   */
  const [answeredToday, setAnsweredToday] = useState<number | null>(null);
  const [perDay, setPerDay] = useState<number | null>(null);
  const day =
    answeredToday !== null && perDay !== null ? { answered: answeredToday, perDay } : null;
  /**
   * The number in "Question 16", and which question it belongs to.
   *
   * Fixed when the question is served and kept while it is on screen, so
   * answering it (which bumps today's count) does not renumber it under the
   * student's eyes.
   */
  const [numbered, setNumbered] = useState<{ id: string; n: number } | null>(null);

  /**
   * When this question was first shown.
   *
   * A ref, not state: it must not survive a re-render as a stale value and it
   * must never trigger one. The server treats whatever arrives as advisory
   * anyway (it clamps), so this is a best effort at honest pacing, not a
   * measurement anyone is scored on.
   */
  const shownAt = useRef<number>(Date.now());
  /*
   * Seconds on the current question, ticking (T-270).
   *
   * The elapsed time was already measured and sent — it is what produces the
   * "within time" or "over time" note after an answer — but the student could
   * not see it while it mattered. A pacing verdict that only ever arrives
   * afterwards teaches nothing: the exam is timed, and knowing you are running
   * long is the whole point of practising against a clock.
   */
  const [elapsed, setElapsed] = useState(0);

  /**
   * The paywall needs prices, and the prices come from the server.
   *
   * Fetched when the wall is hit rather than kept ready: nine students in ten
   * never see this screen, and a plans request on every practice load is a
   * request on the route with the 300 KB budget and the slowest connection.
   */
  const paywall = useCallback(async (): Promise<void> => {
    const plans = await api.plans().catch((): PlanOffer[] => []);
    setPhase({ kind: 'paywalled', plans });
  }, []);

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setChosen(null);
    setReason(null);
    try {
      const question = await api.nextQuestion(topicId);
      shownAt.current = Date.now();
      setElapsed(0);
      setPhase({ kind: 'asking', question });
      /*
       * Back to the top, because the last screen was taller than this one.
       *
       * A student reaches "Next question" by scrolling down through an
       * explanation, and the browser keeps that scroll position across the
       * state change — so the new question arrived with its stem behind the
       * sticky header and its clock off-screen entirely, every single time.
       * The one thing they need to read was the one thing not visible.
       */
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Running out is the natural end of a session, so it is where the
        // summary belongs — a student who has finished wants to know how it
        // went, not just that there is nothing left.
        const summary = await api.practiceSummary().catch(() => null);
        setPhase({ kind: 'exhausted', summary });
        return;
      }
      if (e instanceof ApiError && e.code === 'FREE_LIMIT_REACHED') {
        // The wall now arrives here as well as on submit, and arriving here is
        // the better of the two: the student meets it instead of a question they
        // would not have been allowed to answer.
        await paywall();
        return;
      }
      if (signInRequired(e)) {
        // The sign-in screen, not an error card. This route is the installed
        // app's start_url, so an expired session lands here first.
        window.location.assign('/signin');
        return;
      }
      if (e instanceof ApiError && e.code === 'FIELD_REQUIRED') {
        // Send them to the screen that fixes it rather than telling them to
        // do something the product gave them no way to do.
        window.location.assign('/choose');
        return;
      }
      // The server's own words when it refused — the open-mock lock says
      // "Finish or submit your exam before practising", which is the whole
      // answer and used to be thrown away for "try again".
      setPhase({
        kind: 'error',
        message: refusalMessage(e) ?? c.practice.didNotLoad,
        code: e instanceof ApiError ? e.code : null,
      });
    }
  }, [c.practice.didNotLoad, paywall, topicId]);

  /*
   * Ticks only while a question is open.
   *
   * Stopped once an answer is in: the number beside the explanation is what the
   * attempt actually took, and a clock still running behind it would disagree
   * with the server's own figure within a second.
   */
  useEffect(() => {
    if (phase.kind !== 'asking') return;
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - shownAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [phase.kind]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Where today stands. The same two reads Today makes, so the bar here and
   * the ring there agree; refreshed after every answer by `refreshDay`.
   */
  const refreshDay = useCallback(async (): Promise<void> => {
    try {
      const [summary, fields] = await Promise.all([api.practiceSummary(), api.myFields()]);
      setAnsweredToday(summary.answered);
      const field = fields.find((f) => f.chosen);
      if (!field) return;
      const coverage = await api.coverage(field.id);
      // Null with no sitting date: "12 of nothing" is not a target.
      setPerDay(coverage.perDay && coverage.perDay > 0 ? coverage.perDay : null);
    } catch {
      // The header is orientation, not the task. A failed read leaves it out.
    }
  }, []);

  useEffect(() => {
    void refreshDay();
  }, [refreshDay]);

  // The question's number is set when it is served and does not move while it
  // is on screen, even after the answer bumps today's count.
  const servedId = phase.kind === 'asking' ? phase.question.questionId : null;
  useEffect(() => {
    if (servedId === null || answeredToday === null) return;
    setNumbered((current) =>
      current?.id === servedId ? current : { id: servedId, n: answeredToday + 1 },
    );
  }, [servedId, answeredToday]);

  const outOfFree =
    phase.kind === 'asking' && phase.question.freeRemaining === 0 && phase.question.alreadyAnswered;

  useEffect(() => {
    if (!outOfFree) return;
    let live = true;
    void (async () => {
      try {
        const status = await api.mySubscription();
        if (live) setEverPaid(status.hasEverPaid);
      } catch {
        // Falls back to the first-timer wording, which is the safer of the two
        // to be wrong about: it never claims somebody has not paid.
      }
    })();
    return () => {
      live = false;
    };
  }, [outOfFree]);

  const submit = async (): Promise<void> => {
    if (phase.kind !== 'asking' || chosen === null || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.submitAttempt({
        questionId: phase.question.questionId,
        chosenLabel: chosen,
        timeTakenSec: Math.round((Date.now() - shownAt.current) / 1000),
      });
      setPhase({ kind: 'answered', question: phase.question, result });
      void refreshDay();
    } catch (e) {
      // 402 is not an error state, it is the end of the free tier — a different
      // screen with a different action.
      if (e instanceof ApiError && e.code === 'FREE_LIMIT_REACHED') {
        await paywall();
        return;
      }
      setPhase({
        kind: 'error',
        message: refusalMessage(e) ?? c.practice.didNotLoad,
        code: e instanceof ApiError ? e.code : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** Records the reason, then shows the verdict beside the explanation. */
  const nameReason = async (attemptId: string, chosenId: string): Promise<void> => {
    if (naming) return;
    setNaming(true);
    try {
      const graded = await api.answerReason(attemptId, chosenId);
      setReason({ correct: graded.reasonCorrect, chosenId });
    } catch {
      // Never a blocker. The answer and its explanation are already on screen,
      // and a failed bookkeeping write must not take them away — the question
      // stays unbeaten, which is the same outcome as skipping.
      setReason({ correct: false, chosenId });
    } finally {
      setNaming(false);
    }
  };

  if (phase.kind === 'loading') {
    return (
      <p data-state="loading" className="text-body text-ink-2 py-8 text-center">
        {c.practice.loading}
      </p>
    );
  }

  if (phase.kind === 'error') {
    /*
     * A refusal with somewhere to go.
     *
     * The open-mock lock says "Finish or submit your exam before practising",
     * which is the whole answer — and the only control under it was "Try again",
     * which tries the same thing and fails the same way. QA called it a dead
     * end, correctly: the screen states a condition the student can fix and
     * offers no way to fix it. The guard has always sent the code (and the
     * sitting id) alongside the sentence; nothing here read it.
     */
    const lockedByExam = phase.code === 'SITTING_IN_PROGRESS';
    return (
      <Card data-state="error" className="flex flex-col gap-4">
        <p className="text-body">{phase.message}</p>
        {lockedByExam ? (
          <a className="btn-primary" href="/exam">
            {c.practice.goToExam}
          </a>
        ) : (
          <Button onClick={() => void load()}>{c.common.tryAgain}</Button>
        )}
      </Card>
    );
  }

  if (phase.kind === 'exhausted') {
    return (
      <div className="flex flex-col gap-4" data-state="exhausted">
        <Card>
          <h1 className="text-title">{c.practice.doneForToday}</h1>
          <p className="text-body text-ink-2 mt-2">{c.practice.nothingLeftToday}</p>
        </Card>
        {phase.summary && <SessionSummary summary={phase.summary} />}
      </div>
    );
  }

  if (phase.kind === 'paywalled') return <Paywall plans={phase.plans} />;

  const { question } = phase;
  const questionNo = numbered?.id === question.questionId ? numbered.n : null;
  // The count the student is choosing under, not the one they have just spent:
  // the served question carries it while asking, the attempt result after.
  const freeLeft = phase.kind === 'answered' ? phase.result.freeRemaining : question.freeRemaining;

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-5">
      {/*
        The way back, and where today stands (redesign handoff, § Practice).

        "Today's plan" is a link, not a router back: somebody who arrived from a
        shared URL has no history to go back through. The count and the bar are
        today's answers against the daily target, read from the same two
        endpoints Today reads, so the two screens cannot disagree; when either
        read fails the bar is simply not drawn, never drawn as empty.
      */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <a
            href="/today"
            className="text-ink hover:text-link -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-[14px] font-semibold"
          >
            <Icon name="chevronLeft" size={18} />
            {c.practice.backToPlan}
          </a>
          {day ? (
            <span className="text-ink-3 num ml-auto text-[14px] font-semibold">
              {c.practice.ofTarget(day.answered, day.perDay)}
            </span>
          ) : null}
        </div>
        {day ? (
          <div
            className="bg-border h-1 overflow-hidden rounded-full"
            role="img"
            aria-label={c.practice.ofTarget(day.answered, day.perDay)}
          >
            <div
              className="bg-brand h-full rounded-full"
              style={{ width: `${Math.min(100, (day.answered / Math.max(1, day.perDay)) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>

      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/*
          "Question 16", smaller than the question itself.

          The handoff sets it at 24px, above a stem of 17 to 20. DESIGN.md's
          Stem Supremacy Rule says the stem is the largest type on any practice
          or exam screen, "Always", and lists it again under Don't. The rule
          wins; the heading is a label, and the layout sweep now measures it.
        */}
        <h1 className="font-display text-ink text-[16px] font-extrabold">
          {questionNo !== null ? c.practice.questionN(questionNo) : c.practice.title}
        </h1>
        <span className="text-caption text-ink-3 uppercase">{question.topic}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {/*
            The clock for this question (T-270).

            Counts *down* against the question's own budget while there is one
            left, and then keeps going as an overrun rather than stopping at
            zero or taking the question away. Nothing here is scored on it, and
            snatching a question from somebody who is thinking would punish the
            student this product is most careful with.

            The word "suggested" sits beside it: an unlabelled countdown puts a
            stressed student on a deadline nobody explained.
          */}
          {phase.kind === 'asking' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-caption text-ink-3 uppercase">{c.practice.suggestedTime}</span>
              <ExamTimer
                // Not clamped at zero; see the note above. The clamp was a bug.
                remainingSec={question.timeLimitSec - elapsed}
                durationSec={question.timeLimitSec}
                countUpPastZero
              />
            </span>
          )}
          {freeLeft !== null && (
            <Chip tone={freeLeft <= 2 ? 'pending' : 'neutral'} className="uppercase">
              {freeLeft <= 2 ? <Icon name="clock" size={14} /> : null}
              {c.practice.freeLeft(freeLeft)}
            </Chip>
          )}
        </span>
      </header>

      {/*
        Said once the allowance is gone, on the question itself.
        The server keeps offering questions after the tenth: they are ones the
        student has already answered, and going over them again is free. Unsaid,
        that reads as a free tier nobody is enforcing, so the screen states which
        of the two situations they are in, and where the new questions are.
      */}
      {freeLeft === 0 && question.alreadyAnswered && (
        <section
          data-out-of-new=""
          className="border-pending/30 bg-pending-soft rounded-option flex flex-col gap-2 border p-4"
        >
          <h2 className="text-ink text-[15px] font-bold">
            {everPaid ? c.practice.lapsedTitle : c.practice.outOfNewTitle}
          </h2>
          <p className="text-body text-ink">
            {everPaid ? c.practice.lapsedBody : c.practice.outOfNewBody}
          </p>
          <a className="btn-ghost self-start" href="/checkout">
            {c.practice.seePlans}
          </a>
        </section>
      )}

      {/*
        The stem, on the page rather than in a card (handoff).

        A card around the only thing on the screen that matters separated it
        from nothing, and spent 32px of a phone's width on padding the stem
        needed. "Seen before" stays on the question, every time: gated on the
        allowance, the hardest repeat to spot was the one with no label.
      */}
      <section className="flex flex-col gap-3">
        {freeLeft !== null && question.alreadyAnswered && (
          <p className="text-caption text-ink-2">{c.practice.seenBefore}</p>
        )}
        <p className="text-stem text-pretty" data-stem="">
          {question.stem}
        </p>
        {question.codeBlock && <CodeBlock code={question.codeBlock} />}
      </section>

      {phase.kind === 'asking' ? (
        <>
          <AnswerOptionGroup
            ariaLabel={question.stem}
            choices={question.options.map((o) => ({
              label: o.label as OptionLabel,
              text: o.text,
              state: chosen === o.label ? 'selected' : 'default',
            }))}
            onSelect={(label) => setChosen(label)}
          />
          {/*
            Sticky, not `mt-auto`.

            The handoff says pinned to the foot of the viewport, and `mt-auto`
            only manages that when the content is *shorter* than the viewport —
            with a long stem and four options it lands wherever the column ends.
            QA measured it around 500px below the fold and read the screen as a
            dead end, having to search the DOM to find the button.

            `sticky-foot` pins it for real: reachable at any content height,
            and above the phone's tab bar rather than under it (see the
            utility in the theme),
            on the screen a student uses more than any other. The negative margin
            and padding let its own background cover the gap the column would
            otherwise show through underneath it.
          */}
          {/*
            `sticky`, and NOT `mt-auto`.

            The two together were the worst of both: `mt-auto` pushed the button
            to the bottom of a `flex-1` column, so on a desktop the options ended
            and then eight hundred pixels of cream went by before anything else
            happened. Sticky alone puts it directly under the options where the
            eye already is, and still pins it to the foot once a long stem makes
            the page scroll.
          */}
          <div className="bg-bg sticky-foot -mx-1 px-1 pt-2 pb-2">
            <Button
              className="w-full"
              disabled={chosen === null || submitting}
              blockingReason={chosen === null ? c.practice.chooseFirst : undefined}
              onClick={() => void submit()}
            >
              {submitting ? c.practice.checking : c.practice.checkAnswer}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/*
            The options stay on screen after the check, resolved.
            Removing them and showing only the explanation asks a student to
            hold four sentences in their head while reading why one of them was
            wrong — and the handoff draws the row they picked, tinted and
            marked YOURS, directly above the verdict for exactly that reason.
          */}
          <AnswerOptionGroup
            ariaLabel={question.stem}
            disabled
            choices={phase.result.answerView.options.map((o) => ({
              label: o.label as OptionLabel,
              text: o.text,
              state: o.isCorrect
                ? ('correct' as const)
                : o.label === phase.result.answerView.chosenLabel
                  ? ('wrong' as const)
                  : ('default' as const),
              wasChosen: o.label === phase.result.answerView.chosenLabel,
            }))}
          />
          <AnswerView
            answer={phase.result.answerView}
            isCorrect={phase.result.isCorrect}
            pacing={phase.result.pacing}
            timeTakenSec={phase.result.timeTakenSec}
            /* The concept line IS one of the options below, and the per-option
               notes ARE the rest of them. Both held until the check is answered
               or skipped — otherwise the picker's four sentences are all
               printed above it, three of them already marked as wrong. */
            withholdConcept={phase.result.reasonCheck !== null && reason === null}
            withholdWhyWrongs={phase.result.reasonCheck !== null && reason === null}
          />

          {/*
            The second half of getting it right (T-255).

            A question counts as *beaten* only when the student names the reason
            as well as the letter — the exam is drawn from a bank, so questions
            repeat, and somebody who memorises the letter passes this app and
            fails the paper. The check is only offered on a correct answer to a
            question not yet beaten, and only where the question's own content
            can carry one.

            It sits under the explanation rather than replacing it, so a student
            who picks the wrong reason can read straight on to why the answer was
            right. Skipping is allowed and costs nothing they had: the question
            stays unbeaten and comes round again.
          */}
          {/*
            The options stay after the reason is named, with the one picked
            marked. They used to vanish and leave only the verdict, so the page
            jumped and "That was not the reason" pointed at nothing on screen.
          */}
          {phase.result.reasonCheck && (reason === null || reason.chosenId !== null) ? (
            <section
              data-reason-check=""
              className="border-border bg-surface rounded-option flex flex-col gap-3 border p-4"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-ink text-[16px] font-bold">{c.practice.reasonTitle}</h2>
                <p className="text-caption text-ink-2">{c.practice.reasonWhy}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {phase.result.reasonCheck.options.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      disabled={naming || reason !== null}
                      aria-pressed={reason ? reason.chosenId === option.id : undefined}
                      data-reason-option=""
                      onClick={() =>
                        void nameReason(phase.result.reasonCheck!.attemptId, option.id)
                      }
                      // The same row as an answer option, because it is one:
                      // a choice among sentences, pressed once.
                      className={`rounded-option text-body min-h-[52px] w-full border-[1.5px] px-3.5 py-3 text-left transition-[border-color] ${
                        reason?.chosenId === option.id
                          ? reason.correct
                            ? 'border-correct bg-correct-soft'
                            : 'border-pending bg-pending-soft'
                          : reason
                            ? 'border-border bg-surface text-ink-2'
                            : 'border-border bg-surface hover:border-border-strong'
                      }`}
                    >
                      {option.text}
                    </button>
                  </li>
                ))}
              </ul>
              {reason === null ? (
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    className="self-start"
                    disabled={naming}
                    onClick={() => void load()}
                  >
                    {naming ? c.practice.reasonChecking : c.practice.reasonSkip}
                  </Button>
                  {/*
                  What skipping costs, before it is skipped.

                  Skipping is allowed and takes nothing away — but the question
                  stays unbeaten, and coverage is the headline figure on
                  `/progress`. QA skipped twice, watched "0 of 20 beaten" not
                  move, and could not tell whether that was the rule or a bug.
                  The rule is stated above the options; this is the same fact
                  next to the control that triggers it, which is where somebody
                  deciding actually looks.
                */}
                  <p className="text-caption text-ink-2">{c.practice.reasonSkipCost}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {/*
            The reason's verdict. Green when it was the reason; the pending wash
            when it was not, because a wrong reason is unfinished rather than
            failed: the letter still stands and the question comes round again.
          */}
          {reason ? (
            <section
              data-reason-verdict={reason.correct}
              className={`rounded-option text-ink flex items-center gap-2 px-4 py-3.5 text-[15px] font-semibold ${
                reason.correct ? 'bg-correct-soft' : 'bg-pending-soft'
              }`}
            >
              <Icon name={reason.correct ? 'check' : 'clock'} size={18} strokeWidth={2.5} />
              {reason.correct ? c.practice.reasonRight : c.practice.reasonWrong}
            </section>
          ) : null}

          {/* Sticky, like Check answer before it: the next step stays under the
              thumb however long the explanation runs. */}
          <div className="bg-bg sticky-foot -mx-1 px-1 pt-2 pb-2">
            <Button className="w-full" onClick={() => void load()}>
              {phase.result.reasonCheck && reason === null
                ? c.practice.nextQuestion
                : c.practice.reasonNext}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
