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
import { Icon } from '../../components/icons';
import { CodeBlock } from '../../components/CodeBlock';
import { ExamTimer } from '../../components/ExamTimer';
import { JumpGrid } from '../../components/JumpGrid';
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
  signInRequired,
  type ExamPreview,
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
  /** Whether the submit button has been pressed with questions still blank. */
  const [confirming, setConfirming] = useState(false);
  /*
   * The confirmation takes focus when it opens. It replaces the question in
   * place, so focus was left on a submit button that no longer existed and a
   * screen reader announced nothing: the alertdialog role alone does not move
   * focus.
   */
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (confirming) confirmHeading.current?.focus();
  }, [confirming]);
  /** The question grid on a phone, opened above the question. */
  const [gridOpen, setGridOpen] = useState(false);
  /** The paper on offer and any sitting already open, read before starting. */
  const [preview, setPreview] = useState<ExamPreview | null>(null);
  /** Set when the preview was refused, so the splash stops saying "preparing". */
  const [previewFailed, setPreviewFailed] = useState(false);
  /** Set when starting had to settle an expired paper first. See `startExam`. */
  const [settledNotice, setSettledNotice] = useState<string | null>(null);

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

  /*
   * Asked once, on arrival, and only while nothing is under way.
   *
   * A read with no side effects — notably it does not close an expired sitting,
   * so looking at this screen can never end somebody's paper.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const seen = await api.examPreview();
        if (!cancelled) setPreview(seen);
      } catch (e) {
        /*
         * A refused preview has to reach the screen.
         *
         * This swallowed everything, and the splash renders "Preparing your
         * paper…" until a preview arrives — so a student with no programme sat
         * on that sentence forever while the server had already answered 409
         * FIELD_REQUIRED. Nothing was being prepared and nothing ever would be.
         * The one refusal worth acting on is routed to the screen that fixes
         * it; anything else falls back to the plain splash, because a preview
         * that cannot be fetched is still not a reason to block starting.
         */
        if (!cancelled && e instanceof ApiError && e.code === 'FIELD_REQUIRED') {
          window.location.assign('/choose');
          return;
        }
        if (!cancelled) setPreviewFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        refused,
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

  /*
   * And on a timer while anything waits.
   *
   * The `online` event only fires on a change of state. A save that failed
   * while the phone stayed online (a server hiccup, a request that timed out)
   * never got one, so it waited for an event that was never coming.
   */
  const waiting = pending.length > 0;
  useEffect(() => {
    if (!sittingId || !waiting) return;
    const timer = setInterval(() => {
      if (navigator.onLine) void flush(sittingId);
    }, RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [sittingId, waiting, flush]);

  const fail = (e: unknown): void => {
    if (signInRequired(e)) {
      window.location.assign('/signin');
      return;
    }
    const code = e instanceof ApiError ? e.code : null;
    setPhase({
      kind: 'error',
      message: e instanceof Error ? e.message : c.exam.didNotGoThrough,
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
          // Already marked. Its results have their own page now.
          setPhase({ kind: 'closed', result: null });
          window.location.assign(`/exam/review/${id}`);
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
      // The student's own programme. `fields[0]` would hand somebody a paper
      // from a subject they are not sitting.
      const fieldId = fields.find((f) => f.chosen)?.id;
      if (!fieldId) {
        setPhase({ kind: 'error', message: c.exam.chooseProgramme, code: 'FIELD_REQUIRED' });
        return;
      }
      const started = await api.startExam(fieldId);
      setSittingId(started.sittingId);
      applyClock(started.clock);

      /*
       * Say so when a previous paper had to be settled first.
       *
       * A student who walked away from a paper and came back after the clock ran
       * out gets a new one, which is right — but landing on "Question 1 of 20"
       * with a full clock and no explanation reads as their answers having been
       * thrown away. QA filed exactly that as lost work. They were marked, and
       * the result is on `/progress` where every other sat paper is.
       */
      setSettledNotice(started.settledPrevious === 'EXPIRED' ? c.exam.previousExpired : null);

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

      /*
       * Where they stopped, not the beginning.
       *
       * `start` rejoins an open sitting, and rejoining used to drop the student
       * on question one regardless of how far in they were — on a twenty
       * question paper that is nineteen taps back to where they were. The
       * preview works out the first question with no answer on it; with no
       * preview yet, or a genuinely fresh paper, that is one anyway.
       */
      await goTo(started.sittingId, started.resumed ? (preview?.open?.position ?? 1) : 1);
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
      // The link works, so anything still waiting from earlier goes now.
      if (pendingRef.current.length > 0) void flush(sittingId);
      setManifest(await api.sitting(sittingId));
    } catch (e) {
      // Running out mid-answer is not an error state — the sitting closed and
      // the earlier answers are safe. Say so rather than showing a stack.
      if (e instanceof ApiError && (e.code === 'SITTING_EXPIRED' || e.code === 'SITTING_CLOSED')) {
        rememberQueue(sittingId, []);
        await showResult();
        return;
      }
      /*
       * A refusal is not a lost connection. The server read this change and
       * said no, so sending it again cannot help, and keeping it left "1 answer
       * saved on this phone, waiting to send" on screen while online, forever.
       */
      if (refused(e)) {
        rememberQueue(sittingId, dequeue(pendingRef.current, item.position));
        return;
      }
      // Anything else (no network, a 500, a dropped link) leaves the change in
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
  /*
   * The results have their own page (redesign, § Results), so a closed paper
   * goes there rather than rendering them in place. One address for a result
   * means the one Mocks links to, the one a refresh lands on, and the one a
   * student is sent to the moment they submit are the same page.
   */
  const showResult = async (): Promise<void> => {
    setPhase({ kind: 'closed', result: null });
    if (sittingId) window.location.assign(`/exam/review/${sittingId}`);
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

  /*
   * Starting and resuming without a second press (redesign, § Mocks).
   *
   * The Mocks screen's button is the decision, and it arrives here as
   * `?start=1`; making the student confirm it again on a second screen is a
   * click spent on the way into a three hour paper. An open paper resumes on a
   * plain visit too: its clock is already running on the server, and every
   * second spent on a "resume" card is a second off the paper. A plain visit
   * with nothing open still shows the card, because nothing should start a
   * clock on its own because somebody typed an address.
   */
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || phase.kind !== 'idle') return;
    if (preview === null && !previewFailed) return;
    const asked = new URLSearchParams(window.location.search).get('start') === '1';
    if (!asked && !preview?.open) return;
    autoStarted.current = true;
    // The address goes back to plain `/exam`, so a refresh resumes rather than
    // asking to start again.
    window.history.replaceState(null, '', '/exam');
    void start();
    // `start` is recreated every render and deliberately not a dependency;
    // the ref is what makes this run once.
  }, [preview, previewFailed, phase.kind]);

  /*
   * The keyboard (handoff: "← → to move, A to D or 1 to 4 to answer, F to
   * flag"). Ignored with a modifier held, inside anything editable, while the
   * confirmation is up, and for any key a focused control has already handled:
   * the answer options use the arrows to move between themselves, and call
   * `preventDefault` when they do.
   */
  useEffect(() => {
    if (phase.kind !== 'sitting' || confirming || !item || !sittingId) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const letter = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' }[
        key
      ];
      if (key === 'arrowleft' && item.position > 1) {
        event.preventDefault();
        void goTo(sittingId, item.position - 1);
      } else if (key === 'arrowright' && item.position < item.totalQuestions) {
        event.preventDefault();
        void goTo(sittingId, item.position + 1);
      } else if (letter && item.question.options.some((o) => o.label === letter)) {
        event.preventDefault();
        void save({ chosenLabel: letter });
      } else if (key === 'f') {
        event.preventDefault();
        void save({ isFlagged: !item.flagged });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (phase.kind === 'idle' || phase.kind === 'loading') {
    /*
     * Before the paper: reached by typing `/exam` with nothing open, or while
     * the paper is being fetched. Said in the simulator's own frame, with the
     * way back to Mocks, since this route has no navigation.
     */
    const open = preview?.open ?? null;
    const waiting = phase.kind === 'loading' || (preview === null && !previewFailed);
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 py-8">
        <a
          href="/mocks"
          className="text-ink hover:text-link -ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-[14px] font-semibold"
        >
          <Icon name="chevronLeft" size={18} />
          {c.exam.backToMocks}
        </a>
        <section
          data-state={phase.kind}
          className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6"
        >
          <h1 className="font-display text-[24px] font-extrabold">
            {open ? c.exam.resumeTitle : c.exam.readyTitle}
          </h1>
          <p className="text-body text-ink-2">
            {waiting
              ? c.exam.preparing
              : preview
                ? open
                  ? c.exam.resumeBody(open.answeredCount, preview.totalQuestions)
                  : c.exam.intro(preview.totalQuestions, Math.round(preview.durationSec / 60))
                : c.exam.title}
          </p>
          {waiting ? null : (
            <Button className="mt-2" onClick={() => void start()}>
              {open ? c.exam.resume(open.position) : c.exam.start}
            </Button>
          )}
        </section>
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 py-8">
        <a
          href="/mocks"
          className="text-ink hover:text-link -ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-[14px] font-semibold"
        >
          <Icon name="chevronLeft" size={18} />
          {c.exam.backToMocks}
        </a>
        <section
          data-state="error"
          className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6"
        >
          <p className="text-body">{phase.message}</p>
          {/* A link, and it goes somewhere. This was a `<Button>` with no
              handler: "Get full access", pressed, did nothing at all. */}
          {phase.code === 'SUBSCRIPTION_REQUIRED' && (
            <a href="/checkout" className="btn-primary">
              {c.exam.seePlans}
            </a>
          )}
          {phase.code === 'FIELD_REQUIRED' && (
            <a href="/choose" className="btn-primary">
              {c.home.chooseProgramme}
            </a>
          )}
        </section>
      </div>
    );
  }

  if (phase.kind === 'closed') {
    return (
      <p data-state="closed" className="text-body text-ink-2 px-4 py-12 text-center">
        {c.exam.openingResults}
      </p>
    );
  }

  if (!item || !manifest || !sittingId) return null;
  const slots = applyQueue(manifest.slots, pending);
  const answeredCount = slots.filter((s) => s.answered).length;
  const flaggedCount = slots.filter((s) => s.flagged).length;
  const blankCount = manifest.totalQuestions - answeredCount;
  const last = item.position >= item.totalQuestions;

  /*
   * The question navigator, with the counts and the way to submit.
   *
   * One component for both places it appears: the panel beside the paper on a
   * desktop, and the panel a phone opens above the question. Two copies are how
   * the counts on one end up disagreeing with the other.
   */
  const panel = (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold">{c.exam.allQuestions}</h2>
        <button
          type="button"
          className="btn-ghost w-auto px-4 lg:hidden"
          onClick={() => setGridOpen(false)}
        >
          {c.exam.hideQuestions}
        </button>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          [c.exam.countAnswered, answeredCount, 'text-ink'],
          [c.exam.countBlank, blankCount, 'text-ink'],
          [c.exam.countFlagged, flaggedCount, 'text-pending'],
        ].map(([label, value, tone]) => (
          <div
            key={label}
            className="bg-bg rounded-control flex flex-col items-center gap-0.5 py-2.5"
          >
            {/* 18px, under the stem: the handoff's 22px out-sized the question on
                a desktop, which the Stem Supremacy Rule does not allow. */}
            <dd className={`font-display num text-[18px] font-extrabold ${tone}`}>{value}</dd>
            <dt className="text-ink-3 text-[12px] font-medium">{label}</dt>
          </div>
        ))}
      </dl>
      <JumpGrid
        slots={slots}
        currentPosition={item.position}
        onJump={(position) => {
          setGridOpen(false);
          void goTo(sittingId, position);
        }}
      />
      <button
        type="button"
        className="bg-brand hover:bg-brand-hover text-on-brand rounded-control min-h-[52px] text-[15px] font-semibold"
        onClick={() => {
          setGridOpen(false);
          setConfirming(true);
        }}
      >
        {c.exam.reviewAndSubmit}
      </button>
    </div>
  );

  return (
    <div className="bg-bg flex min-h-dvh flex-col" data-state="sitting">
      {/*
        The paper's own header: the way out, what this is, how far through,
        and the clock. Sticky, so the clock is never scrolled away from.
      */}
      <header className="bg-surface border-border sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b px-3 lg:px-6">
        <a
          href="/mocks"
          aria-label={c.exam.leave}
          title={c.exam.leave}
          className="text-ink hover:bg-surface-2 rounded-control inline-flex size-11 shrink-0 items-center justify-center"
        >
          <Icon name="cross" size={20} />
        </a>
        <div className="flex min-w-0 flex-col">
          <span className="font-display truncate text-[16px] leading-5 font-bold">
            {manifest.examName}
          </span>
          <span className="text-ink-3 num text-[13px]">
            {c.exam.answeredOf(answeredCount, manifest.totalQuestions)}
          </span>
        </div>
        <div className="ml-auto">
          <ExamTimer remainingSec={remaining} durationSec={durationRef.current} />
        </div>
      </header>

      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-6 lg:px-8">
            {/*
              Said once, after a stale sitting was closed out to make room for
              this one. Not an error: their answers to it were kept and marked.
            */}
            {settledNotice !== null && (
              <p className="text-caption text-ink-2" data-settled-previous>
                {settledNotice}
              </p>
            )}

            {/* Says the work is safe, because the alternative is a student who
                thinks it is not and answers everything twice. */}
            {pending.length > 0 && (
              <p className="text-caption text-ink-2" data-pending-sync={pending.length}>
                {c.exam.pendingSync(pending.length)}
              </p>
            )}

            {gridOpen ? (
              <section className="border-border bg-surface rounded-card border p-5 lg:hidden">
                {panel}
              </section>
            ) : null}

            {confirming ? (
              /*
                The confirmation, in place of the question.

                Every time, with the counts and the time left: a submitted paper
                cannot be reopened. Not a modal, because DESIGN.md allows one in
                the whole product and it is the emergency retire. The safe choice
                is the primary button.
              */
              <section
                role="alertdialog"
                aria-labelledby="submit-confirm"
                aria-describedby="submit-confirm-body"
                className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6"
              >
                <h1
                  id="submit-confirm"
                  ref={confirmHeading}
                  tabIndex={-1}
                  className="font-display text-[22px] font-extrabold outline-none"
                >
                  {blankCount > 0 ? c.exam.confirmTitle : c.exam.confirmReadyTitle}
                </h1>
                <p id="submit-confirm-body" className="text-body text-ink-2">
                  {blankCount > 0 ? c.exam.confirmBody(blankCount) : c.exam.confirmReadyBody}
                </p>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    [c.exam.countAnswered, String(answeredCount)],
                    [c.exam.countBlank, String(blankCount)],
                    [c.exam.countFlagged, String(flaggedCount)],
                    [c.exam.timeLeft, clockText(remaining)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="bg-bg rounded-control flex flex-col items-center gap-0.5 py-3"
                    >
                      <dd className="font-display num text-[20px] font-extrabold">{value}</dd>
                      <dt className="text-ink-3 text-[12px] font-medium">{label}</dt>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                  <Button className="sm:flex-1" onClick={() => setConfirming(false)}>
                    {blankCount > 0 ? c.exam.confirmBack : c.exam.backToPaper}
                  </Button>
                  <Button variant="ghost" className="sm:flex-1" onClick={() => void submit()}>
                    {blankCount > 0 ? c.exam.confirmSubmit : c.exam.submitNow}
                  </Button>
                </div>
              </section>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* A label, smaller than the stem: the Stem Supremacy Rule,
                      measured by the layout sweep. */}
                  <span className="font-display text-ink text-[17px] font-extrabold">
                    {c.exam.questionNumber(item.position)}
                  </span>
                  <span className="text-ink-3 text-[14px]">
                    {c.exam.ofTotalTopic(item.totalQuestions, item.question.topic)}
                  </span>
                  <button
                    type="button"
                    data-flag-toggle=""
                    aria-pressed={item.flagged}
                    onClick={() => void save({ isFlagged: !item.flagged })}
                    className={[
                      'rounded-control ml-auto inline-flex min-h-11 items-center gap-2 border px-3 text-[14px] font-semibold',
                      item.flagged
                        ? 'border-pending bg-pending-soft text-pending'
                        : 'border-border-input bg-surface text-ink',
                    ].join(' ')}
                  >
                    <Icon name="flag" size={16} />
                    {item.flagged ? c.exam.flagged : c.exam.flag}
                  </button>
                </div>

                <p className="text-stem text-pretty" data-stem="">
                  {item.question.stem}
                </p>
                {item.question.codeBlock && <CodeBlock code={item.question.codeBlock} />}

                <AnswerOptionGroup
                  ariaLabel={item.question.stem}
                  choices={item.question.options.map((o) => ({
                    label: o.label as OptionLabel,
                    text: o.text,
                    state: item.chosenLabel === o.label ? 'selected' : 'default',
                  }))}
                  onSelect={(label) => void save({ chosenLabel: label })}
                />
              </>
            )}
          </main>

          {/* Previous and Next, pinned. On the last question Next becomes the
              way to submit, so the end of the paper is not a dead end. */}
          {confirming ? null : (
            <footer className="bg-surface border-border sticky bottom-0 z-10 border-t px-4 py-3">
              <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 lg:px-4">
                <span className="text-ink-3 hidden text-[13px] lg:block">{c.exam.keys}</span>
                <button
                  type="button"
                  className="btn-ghost w-auto px-4 lg:ml-auto"
                  disabled={item.position <= 1}
                  title={item.position <= 1 ? c.exam.firstQuestion : undefined}
                  onClick={() => void goTo(sittingId, item.position - 1)}
                >
                  <Icon name="chevronLeft" size={18} />
                  {c.exam.previous}
                </button>
                <button
                  type="button"
                  aria-expanded={gridOpen}
                  aria-label={c.exam.allQuestions}
                  className="btn-ghost w-auto px-3 lg:hidden"
                  onClick={() => {
                    setGridOpen((open) => !open);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <Icon name="grid" size={20} />
                </button>
                <button
                  type="button"
                  // Ink, not the lemon: the handoff's one ink button. The
                  // lemon is "Review and submit" in the panel, and two lemon
                  // buttons on one screen would be two primary actions.
                  className="bg-ink text-on-state hover:bg-ink-2 rounded-control text-label ml-auto inline-flex min-h-[52px] items-center justify-center gap-2 px-5 lg:ml-0"
                  onClick={() =>
                    last ? setConfirming(true) : void goTo(sittingId, item.position + 1)
                  }
                >
                  {last ? c.exam.reviewAndSubmit : c.exam.next}
                  {last ? null : <Icon name="chevronRight" size={18} />}
                </button>
              </div>
            </footer>
          )}
        </div>

        <aside className="bg-surface border-border sticky top-16 hidden h-[calc(100dvh-4rem)] w-[360px] shrink-0 overflow-y-auto border-l p-6 lg:block">
          {panel}
        </aside>
      </div>
    </div>
  );
}

/**
 * A change the server read and declined, as opposed to one that never arrived.
 * 408 and 429 are the server asking for later, so they stay queued.
 */
function refused(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

/** How often the outbox is retried while it holds anything. */
const RETRY_EVERY_MS = 15_000;

/** h:mm:ss or m:ss, for the time left on the confirmation. */
function clockText(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}
