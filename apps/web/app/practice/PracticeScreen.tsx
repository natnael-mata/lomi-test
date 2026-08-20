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
  | { kind: 'error'; message: string };

export function PracticeScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [chosen, setChosen] = useState<OptionLabel | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setPhase({ kind: 'error', message: refusalMessage(e) ?? c.practice.didNotLoad });
    }
  }, [c.practice.didNotLoad, paywall]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setPhase({ kind: 'error', message: refusalMessage(e) ?? c.practice.didNotLoad });
    } finally {
      setSubmitting(false);
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
    return (
      <Card data-state="error" className="flex flex-col gap-4">
        <p className="text-body">{phase.message}</p>
        <Button onClick={() => void load()}>{c.common.tryAgain}</Button>
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
          <h2 className="text-label">{c.practice.outOfNewTitle}</h2>
          <p className="text-body text-ink-2">{c.practice.outOfNewBody}</p>
          <a className="btn-ghost self-start" href="/checkout">
            {c.practice.seePlans}
          </a>
        </Card>
      )}

      <Card as="section" className="p-4 sm:p-5">
        {freeLeft !== null && freeLeft > 0 && question.alreadyAnswered && (
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
          {/* Pinned to the foot of the viewport, per the handoff. */}
          <Button
            className="mt-auto"
            disabled={chosen === null || submitting}
            blockingReason={chosen === null ? c.practice.chooseFirst : undefined}
            onClick={() => void submit()}
          >
            {submitting ? c.practice.checking : c.practice.checkAnswer}
          </Button>
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
          />
          <Button onClick={() => void load()}>{c.practice.nextQuestion}</Button>
        </>
      )}
    </div>
  );
}
