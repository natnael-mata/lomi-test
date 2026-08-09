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
  applyQueue,
  dequeue,
  enqueue,
  parseQueue,
  queueKey,
  replay,
  serialiseQueue,
  type QueuedAnswer,
} from '../../lib/answer-queue';
import {
  ApiError,
  api,
  type SittingItem,
  type SittingManifest,
  type SittingResult,
} from '../../lib/api';
import { copy } from '../../lib/i18n';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'sitting' }
  | { kind: 'closed'; result: SittingResult | null }
  | { kind: 'error'; message: string; code: string | null };

export function ExamScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [sittingId, setSittingId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<SittingManifest | null>(null);
  const [item, setItem] = useState<SittingItem | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The offline outbox (T-131).
   *
   * A three-hour mock on mobile data will lose the connection; the only
   * acceptable behaviour is that the student keeps answering and nothing is
   * lost. Changes go in here, are mirrored to storage so they survive a reload,
   * and are replayed when the network returns. `pending` also feeds the grid, so
   * an answer made offline shows as answered rather than looking lost.
   */
  const [pending, setPending] = useState<QueuedAnswer[]>([]);
  const pendingRef = useRef<QueuedAnswer[]>([]);

  const rememberQueue = useCallback((id: string, entries: QueuedAnswer[]) => {
    pendingRef.current = entries;
    setPending(entries);
    try {
      window.localStorage.setItem(queueKey(id), serialiseQueue(id, entries));
    } catch {
      // Storage full or disabled. The in-memory queue still works for this tab,
      // which is worse than surviving a reload and far better than refusing the
      // answer — so this is swallowed deliberately.
    }
  }, []);

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

  /** Replays the outbox; see `replay` for why it is sequential and stops early. */
  const flush = useCallback(
    async (id: string): Promise<void> => {
      const outcome = await replay(
        pendingRef.current,
        (position, patch) => api.answerExam(id, position, patch),
        (error) =>
          error instanceof ApiError &&
          (error.code === 'SITTING_EXPIRED' || error.code === 'SITTING_CLOSED'),
      );
      rememberQueue(id, outcome.remaining);
      if (outcome.closed) {
        await showResult();
        return;
      }
      if (outcome.sent === 0) return;
      try {
        setManifest(await api.sitting(id));
      } catch {
        // Still offline. The grid keeps showing the queue.
      }
    },
    [rememberQueue],
  );

  useEffect(() => {
    if (!sittingId) return;
    const onOnline = () => void flush(sittingId);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sittingId, flush]);

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
        setPhase({ kind: 'error', message: c.exam.chooseProgramme, code: 'FIELD_REQUIRED' });
        return;
      }
      const started = await api.startExam(fieldId);
      setSittingId(started.sittingId);
      applyClock(started.clock);

      // A reload mid-sitting rejoins, so anything queued before it is still this
      // student's unsent work. `parseQueue` refuses a queue from another sitting.
      let stored: QueuedAnswer[] = [];
      try {
        stored = parseQueue(
          window.localStorage.getItem(queueKey(started.sittingId)),
          started.sittingId,
        );
      } catch {
        stored = [];
      }
      pendingRef.current = stored;
      setPending(stored);
      if (stored.length > 0) await flush(started.sittingId);

      await goTo(started.sittingId, 1);
    } catch (e) {
      fail(e);
    }
  };

  /**
   * Records a change: locally first, then to the server.
   *
   * The order matters. Writing to the queue before the request means a change
   * made with no network is already safe by the time the request fails, and the
   * screen can show it immediately instead of waiting on a round trip that may
   * never complete.
   */
  const save = async (body: { chosenLabel?: string; isFlagged?: boolean }): Promise<void> => {
    if (!sittingId || !item || saving) return;
    const change: QueuedAnswer = { position: item.position, ...body };
    rememberQueue(sittingId, enqueue(pendingRef.current, change));
    setItem({
      ...item,
      ...(body.chosenLabel !== undefined ? { chosenLabel: body.chosenLabel } : {}),
      ...(body.isFlagged !== undefined ? { flagged: body.isFlagged } : {}),
    });

    setSaving(true);
    try {
      const saved = await api.answerExam(sittingId, item.position, body);
      rememberQueue(sittingId, dequeue(pendingRef.current, item.position));
      setItem((current) =>
        current && current.position === item.position
          ? { ...current, chosenLabel: saved.chosenLabel, flagged: saved.flagged }
          : current,
      );
      applyClock(saved.clock);
      setManifest(await api.sitting(sittingId));
    } catch (e) {
      // Running out mid-answer is not an error state — the sitting closed and
      // the earlier answers are safe. Say so rather than showing a stack.
      if (e instanceof ApiError && (e.code === 'SITTING_EXPIRED' || e.code === 'SITTING_CLOSED')) {
        rememberQueue(sittingId, []);
        await showResult();
        return;
      }
      // Anything else — no network, a 500, a dropped link — leaves the change in
      // the queue. It is not an error the student has to do anything about.
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
        <h1 className="text-title">{c.exam.title}</h1>
        <p className="text-body text-ink-2 mt-2">{c.exam.intro}</p>
        <Button className="mt-4" onClick={() => void start()}>
          {c.exam.start}
        </Button>
      </Card>
    );
  }

  if (phase.kind === 'loading') {
    return (
      <p data-state="loading" className="text-body text-ink-2 py-8 text-center">
        {c.exam.preparing}
      </p>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Card data-state="error">
        <p className="text-body">{phase.message}</p>
        {phase.code === 'SUBSCRIPTION_REQUIRED' && (
          <Button className="mt-4">{c.exam.seePlans}</Button>
        )}
      </Card>
    );
  }

  if (phase.kind === 'closed') {
    if (!phase.result) {
      return (
        <Card data-state="closed">
          <h1 className="text-title">{c.exam.finished}</h1>
          <p className="text-body text-ink-2 mt-2">{c.exam.answersRecorded}</p>
        </Card>
      );
    }
    return <ExamReview result={phase.result} />;
  }

  if (!item || !manifest || !sittingId) return null;

  // The grid shows the server's view with the outbox laid over it. Without this
  // an answer made offline reads as unanswered, and the reasonable thing for a
  // student to do about that is answer it a second time.
  const slots = applyQueue(manifest.slots, pending);
  const answeredCount = slots.filter((s) => s.answered).length;

  return (
    <div className="flex flex-col gap-4" data-state="sitting">
      <header className="flex items-center justify-between gap-2">
        <Chip>{c.exam.questionOf(item.position, item.totalQuestions)}</Chip>
        <ExamTimer remainingSec={remaining} durationSec={durationRef.current} />
      </header>

      {/* Says the work is safe, because the alternative is a student who thinks
          it is not and answers everything twice. It does not say "offline" —
          what they need to know is the state of their answers, not the state of
          the radio. */}
      {pending.length > 0 && (
        <p className="text-caption text-ink-2" data-pending-sync={pending.length}>
          {pending.length === 1
            ? '1 answer saved on this phone'
            : `${pending.length} answers saved on this phone`}
          , waiting to send. Keep going — they go up when the connection returns.
        </p>
      )}

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
          blockingReason={item.position <= 1 ? c.exam.firstQuestion : undefined}
          onClick={() => void goTo(sittingId, item.position - 1)}
        >
          {c.common.back}
        </Button>
        <Button
          variant="ghost"
          disabled={item.position >= item.totalQuestions}
          blockingReason={item.position >= item.totalQuestions ? c.exam.lastQuestion : undefined}
          onClick={() => void goTo(sittingId, item.position + 1)}
        >
          {c.common.next}
        </Button>
      </div>

      <Button
        variant="ghost"
        data-flag-toggle=""
        aria-pressed={item.flagged}
        onClick={() => void save({ isFlagged: !item.flagged })}
      >
        {item.flagged ? c.exam.unflag : c.exam.flag}
      </Button>

      <JumpGrid
        slots={slots}
        currentPosition={item.position}
        onJump={(position) => void goTo(sittingId, position)}
      />

      <Button onClick={() => void submit()}>
        {c.exam.submit(answeredCount, manifest.totalQuestions)}
      </Button>
    </div>
  );
}
