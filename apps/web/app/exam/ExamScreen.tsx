'use client';

/**
 * Sitting a mock exam (T-125, T-126, T-128).
 *
 * One question at a time, Back and Next, and a jump grid. Every choice and every
 * flag is written to the server as it happens: the server is the only authority
 * on what was answered before the deadline, and a sitting that loses ninety
 * minutes to a closed tab is a worse trade than a few more requests.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { AnswerOptionGroup } from '../../components/AnswerOptionGroup';
import type { OptionLabel } from '../../components/AnswerOption';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { CodeBlock } from '../../components/CodeBlock';
import { ExamTimer } from '../../components/ExamTimer';
import { JumpGrid } from '../../components/JumpGrid';
import { ExamReview } from './ExamReview';
import {
  ApiError,
  api,
  type SittingItem,
  type SittingManifest,
  type SittingResult,
} from '../../lib/api';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'sitting' }
  | { kind: 'closed'; result: SittingResult | null }
  | { kind: 'error'; message: string; code: string | null };

export function ExamScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [sittingId, setSittingId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<SittingManifest | null>(null);
  const [item, setItem] = useState<SittingItem | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The clock ticks locally between requests, from the server's own numbers.
   *
   * Only for display. Every response carries a fresh `remainingSec`, so a drifted
   * or tampered client clock is corrected on the next interaction — and the
   * server decides what was in time regardless of what this shows.
   */
  const [remaining, setRemaining] = useState(0);
  const durationRef = useRef(0);

  useEffect(() => {
    if (phase.kind !== 'sitting') return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [phase.kind]);

  const applyClock = useCallback((clock: { remainingSec: number; durationSec: number }) => {
    setRemaining(clock.remainingSec);
    durationRef.current = clock.durationSec;
  }, []);

  const fail = (e: unknown): void => {
    const code = e instanceof ApiError ? e.code : null;
    setPhase({
      kind: 'error',
      message: e instanceof Error ? e.message : 'Something went wrong.',
      code,
    });
  };

  const goTo = useCallback(
    async (id: string, position: number) => {
      try {
        const [next, shape] = await Promise.all([api.sittingItem(id, position), api.sitting(id)]);
        setItem(next);
        setManifest(shape);
        applyClock(next.clock);
        if (shape.clock.state === 'closed') {
          setSittingId(id);
          setPhase({ kind: 'closed', result: null });
          void api.examResult(id).then(
            (result) => setPhase({ kind: 'closed', result }),
            () => undefined,
          );
          return;
        }
        setPhase({ kind: 'sitting' });
      } catch (e) {
        fail(e);
      }
    },
    [applyClock],
  );

  const start = async (): Promise<void> => {
    setPhase({ kind: 'loading' });
    try {
      const fields = await api.myFields();
      const fieldId = fields[0]?.id;
      if (!fieldId) {
        setPhase({ kind: 'error', message: 'Choose a programme first.', code: 'FIELD_REQUIRED' });
        return;
      }
      const started = await api.startExam(fieldId);
      setSittingId(started.sittingId);
      applyClock(started.clock);
      await goTo(started.sittingId, 1);
    } catch (e) {
      fail(e);
    }
  };

  const save = async (body: { chosenLabel?: string; isFlagged?: boolean }): Promise<void> => {
    if (!sittingId || !item || saving) return;
    setSaving(true);
    try {
      const saved = await api.answerExam(sittingId, item.position, body);
      setItem({ ...item, chosenLabel: saved.chosenLabel, flagged: saved.flagged });
      applyClock(saved.clock);
      setManifest(await api.sitting(sittingId));
    } catch (e) {
      // Running out mid-answer is not an error state — the sitting closed and
      // the earlier answers are safe. Say so rather than showing a stack.
      if (e instanceof ApiError && (e.code === 'SITTING_EXPIRED' || e.code === 'SITTING_CLOSED')) {
        await showResult();
        return;
      }
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reads the closed sitting back rather than trusting the submit response.
   *
   * The sitting also closes without a submit — the deadline passes, or a stale
   * one is swept — and both paths land here, so the review is fetched the same
   * way every time. If the fetch fails the screen still says the sitting ended
   * rather than showing an error over answers that were saved perfectly well.
   */
  const showResult = async (): Promise<void> => {
    if (!sittingId) {
      setPhase({ kind: 'closed', result: null });
      return;
    }
    try {
      setPhase({ kind: 'closed', result: await api.examResult(sittingId) });
    } catch {
      setPhase({ kind: 'closed', result: null });
    }
  };

  const submit = async (): Promise<void> => {
    if (!sittingId) return;
    try {
      await api.submitExam(sittingId);
      await showResult();
    } catch (e) {
      fail(e);
    }
  };

  if (phase.kind === 'idle') {
    return (
      <Card data-state="idle">
        <h1 className="text-title">Mock exam</h1>
        <p className="text-body text-ink-2 mt-2">
          100 questions in 3 hours, sat once through. Nothing is marked until you submit.
        </p>
        <Button className="mt-4" onClick={() => void start()}>
          Start the mock
        </Button>
      </Card>
    );
  }

  if (phase.kind === 'loading') {
    return (
      <p data-state="loading" className="text-body text-ink-2 py-8 text-center">
        Preparing your paper…
      </p>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Card data-state="error">
        <p className="text-body">{phase.message}</p>
        {phase.code === 'SUBSCRIPTION_REQUIRED' && <Button className="mt-4">See the plans</Button>}
      </Card>
    );
  }

  if (phase.kind === 'closed') {
    if (!phase.result) {
      return (
        <Card data-state="closed">
          <h1 className="text-title">Sitting finished</h1>
          <p className="text-body text-ink-2 mt-2">
            Your answers are recorded. The review is on its way.
          </p>
        </Card>
      );
    }
    return <ExamReview result={phase.result} />;
  }

  if (!item || !manifest || !sittingId) return null;

  return (
    <div className="flex flex-col gap-4" data-state="sitting">
      <header className="flex items-center justify-between gap-2">
        <Chip>
          Question {item.position} of {item.totalQuestions}
        </Chip>
        <ExamTimer remainingSec={remaining} durationSec={durationRef.current} />
      </header>

      <Card as="section">
        <p className="text-stem" data-stem="">
          {item.question.stem}
        </p>
        {item.question.codeBlock && (
          <div className="mt-3">
            <CodeBlock code={item.question.codeBlock} />
          </div>
        )}
      </Card>

      <AnswerOptionGroup
        ariaLabel={item.question.stem}
        choices={item.question.options.map((o) => ({
          label: o.label as OptionLabel,
          text: o.text,
          state: item.chosenLabel === o.label ? 'selected' : 'default',
        }))}
        onSelect={(label) => void save({ chosenLabel: label })}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          disabled={item.position <= 1}
          blockingReason={item.position <= 1 ? 'This is the first question' : undefined}
          onClick={() => void goTo(sittingId, item.position - 1)}
        >
          Back
        </Button>
        <Button
          variant="ghost"
          disabled={item.position >= item.totalQuestions}
          blockingReason={
            item.position >= item.totalQuestions ? 'This is the last question' : undefined
          }
          onClick={() => void goTo(sittingId, item.position + 1)}
        >
          Next
        </Button>
      </div>

      <Button
        variant="ghost"
        data-flag-toggle=""
        aria-pressed={item.flagged}
        onClick={() => void save({ isFlagged: !item.flagged })}
      >
        {item.flagged ? 'Remove flag' : 'Flag for review'}
      </Button>

      <JumpGrid
        slots={manifest.slots}
        currentPosition={item.position}
        onJump={(position) => void goTo(sittingId, position)}
      />

      <Button onClick={() => void submit()}>
        Submit — {manifest.answeredCount} of {manifest.totalQuestions} answered
      </Button>
    </div>
  );
}
