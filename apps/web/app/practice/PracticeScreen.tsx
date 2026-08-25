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
  const [reason, setReason] = useState<{ correct: boolean } | null>(null);
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
   * When this question was first shown.
   *
   * A ref, not state: it must not survive a re-render as a stale value and it
   * must never trigger one. The server treats whatever arrives as advisory
   * anyway (it clamps), so this is a best effort at honest pacing, not a
   * measurement anyone is scored on.
   */
  const shownAt = useRef<number>(Date.now());

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
      const question = await api.nextQuestion();
      shownAt.current = Date.now();
      setPhase({ kind: 'asking', question });
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
  }, [c.practice.didNotLoad, paywall]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setReason({ correct: graded.reasonCorrect });
    } catch {
      // Never a blocker. The answer and its explanation are already on screen,
      // and a failed bookkeeping write must not take them away — the question
      // stays unbeaten, which is the same outcome as skipping.
      setReason({ correct: false });
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
  // The count the student is choosing under, not the one they have just spent:
  // the served question carries it while asking, the attempt result after.
  const freeLeft = phase.kind === 'answered' ? phase.result.freeRemaining : question.freeRemaining;

  return (
    <div className="flex flex-1 flex-col gap-3 sm:gap-4">
      <header className="flex items-center justify-between gap-2">
        {/* The title is desktop-and-up. On a phone the bottom bar already says
            Practise and marks it as the current page, and 30px of repetition
            is 30px the question stem does not get. */}
        <h1 className="text-title hidden sm:block">{c.practice.title}</h1>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Chip className="uppercase">{question.topic}</Chip>
          {freeLeft !== null && (
            <Chip tone={freeLeft <= 2 ? 'pending' : 'neutral'} className="uppercase">
              {freeLeft <= 2 ? <Icon name="clock" size={14} /> : null}
              {c.practice.freeLeft(freeLeft)}
            </Chip>
          )}
        </div>
      </header>

      {/*
        Said once the allowance is gone, on the question itself.
        The server keeps offering questions after the tenth — they are ones the
        student has already answered, and going over them again is free. Unsaid,
        that reads as a free tier nobody is enforcing: QA answered two more,
        watched the counter sit still, and filed it as a blocker. So the screen
        states which of the two situations they are in, and where the new
        questions are.
      */}
      {freeLeft === 0 && question.alreadyAnswered && (
        <Card as="section" data-out-of-new="" className="flex flex-col gap-2">
          <h2 className="text-label">
            {everPaid ? c.practice.lapsedTitle : c.practice.outOfNewTitle}
          </h2>
          <p className="text-body text-ink-2">
            {everPaid ? c.practice.lapsedBody : c.practice.outOfNewBody}
          </p>
          <a className="btn-ghost self-start" href="/checkout">
            {c.practice.seePlans}
          </a>
        </Card>
      )}

      <Card as="section" className="p-4 sm:p-5">
        {/*
          On the question, every time, not only while allowance remains.
          This was gated on `freeLeft > 0`, so the one case where a repeat is
          hardest to spot — the paywall panel above it and a fresh-looking stem
          below — was the one case with no label. Both testers read it as a new
          question being served past the wall.
        */}
        {freeLeft !== null && question.alreadyAnswered && (
          <p className="text-caption text-ink-2 mb-2">{c.practice.seenBefore}</p>
        )}
        <p className="text-stem" data-stem="">
          {question.stem}
        </p>
        {question.codeBlock && (
          <div className="mt-3">
            <CodeBlock code={question.codeBlock} />
          </div>
        )}
      </Card>

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

            `sticky bottom-0` pins it for real: reachable at any content height,
            on the screen a student uses more than any other. The negative margin
            and padding let its own background cover the gap the column would
            otherwise show through underneath it.
          */}
          <div className="bg-bg sticky bottom-0 -mx-1 mt-auto px-1 pt-2 pb-1">
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
            /* The concept line IS one of the options below. Held until the
               check is answered or skipped — see `withholdConcept`. */
            withholdConcept={phase.result.reasonCheck !== null && reason === null}
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
          {phase.result.reasonCheck && reason === null ? (
            <Card as="section" data-reason-check="" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-label">{c.practice.reasonTitle}</h2>
                <p className="text-caption text-ink-2">{c.practice.reasonWhy}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {phase.result.reasonCheck.options.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      disabled={naming}
                      data-reason-option=""
                      onClick={() =>
                        void nameReason(phase.result.reasonCheck!.attemptId, option.id)
                      }
                      className="bg-surface-2 rounded-card text-body min-h-11 w-full p-3 text-left"
                    >
                      {option.text}
                    </button>
                  </li>
                ))}
              </ul>
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
            </Card>
          ) : null}

          {reason ? (
            <Card as="section" data-reason-verdict={reason.correct} className="flex flex-col gap-1">
              <p className="text-body">
                {reason.correct ? c.practice.reasonRight : c.practice.reasonWrong}
              </p>
            </Card>
          ) : null}

          <Button onClick={() => void load()}>
            {phase.result.reasonCheck && reason === null
              ? c.practice.nextQuestion
              : c.practice.reasonNext}
          </Button>
        </>
      )}
    </div>
  );
}
