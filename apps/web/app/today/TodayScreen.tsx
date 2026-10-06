'use client';

/**
 * Today — the hub a signed-in student lands on (redesign handoff, 2026-10-01,
 * § Today). It replaces `/home`, which now redirects here.
 *
 * **Every figure is read, none is drawn.** The handoff's Today is dense with
 * numbers, and almost all of them have a real source in this API:
 *
 *   countdown, coverage meter   ← `coverage(fieldId)`
 *   the ring, n of the target   ← `practiceSummary()` (today, in Addis) over
 *                                  `coverage.perDay`
 *   "Continue with …"           ← `readiness.practiceNext`
 *   topics by exam weight       ← `readiness.topics`, with `PASS_SAFE_PCT`
 *   mock scores                 ← `trend(fieldId)`
 *   study days, points, week    ← `standing()` and `pointsLedger(200)`
 *
 * Where the handoff prints something nothing can supply, it is not printed —
 * "Week 9 of 15", "About 25 minutes", a per-topic split of today's target, and
 * "Mock 5 opens Saturday" (mocks are on demand here, never scheduled).
 *
 * **The hero is coverage, not readiness.** The handoff leads with "Readiness
 * 62%" against a 60% line. T-256 made coverage the product's headline because
 * it is a count a student can check — "412 of 1,240 beaten" — where readiness is
 * a weighted mean of per-topic scores they cannot. Readiness keeps its place, in
 * the topic bars and their 60% line, which is the job it is good at.
 *
 * Each block renders only from its own data and fails on its own. A dropped
 * request for the mock trend must not blank the countdown.
 *
 * **Plain `<a>`, not a router push.** These are page transitions, they work
 * before the JavaScript arrives, and on a slow connection that difference is the
 * product working or not.
 */
import { useEffect, useState } from 'react';

import { PASS_SAFE_PCT } from '../../components/readiness';
import { ScoreTrend } from '../../components/ScoreTrend';
import { SignOutButton } from '../../components/SignOutButton';
import {
  api,
  type CoverageView,
  type LedgerRow,
  type PracticeSummary,
  type Readiness,
  type StandingView,
  type TrendPoint,
} from '../../lib/api';
import { addisDay, DAY_MS } from '../../lib/addis-day';
import { day } from '../../lib/dates';
import { copy } from '../../lib/i18n';

type Session =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | {
      kind: 'signedIn';
      activeUntil: string | null;
      /**
       * When a plan has run out, the day it ran out on.
       *
       * Null for somebody who has never paid. The two are different sentences
       * and this screen used to say the same one to both: a student whose
       * access had lapsed the previous day was told "You are on the free
       * questions", which is technically what they are now and says nothing
       * about what just happened to them.
       */
      lapsedOn: string | null;
      /** A bank transfer waiting to be checked, so the hub can say so. */
      pendingClaim: { txRef: string; amountEtb: number } | null;
      /** Free questions left. Null with no programme chosen. */
      freeRemaining: number | null;
      /**
       * Whether they have picked a programme yet (T-268).
       *
       * The hub was once the one signed-in screen that did not ask. Practise,
       * Mock and Ask all redirect to `/choose`; it rendered a full set of
       * destinations, three of which immediately bounced — on the first screen a
       * fresh sign-in sees.
       */
      needsProgramme: boolean;
      /** The programme they are on, when they are on one. */
      field: { id: string; name: string; examDate: string | null } | null;
    };

/** What the blocks read. Each is null until it loads, and stays null if it fails. */
interface Detail {
  name: string | null;
  coverage: CoverageView | null;
  readiness: Readiness | null;
  today: PracticeSummary | null;
  trend: TrendPoint[] | null;
  standing: StandingView | null;
  ledger: LedgerRow[] | null;
}

const NOTHING: Detail = {
  name: null,
  coverage: null,
  readiness: null,
  today: null,
  trend: null,
  standing: null,
  ledger: null,
};

/** The server's maximum page. See `weekFrom`. */
const LEDGER_PAGE = 200;

export function TodayScreen() {
  const c = copy();
  const [session, setSession] = useState<Session>({ kind: 'checking' });
  const [detail, setDetail] = useState<Detail>(NOTHING);
  const [partial, setPartial] = useState(false);
  // Null in `detail` means "not here yet" before this, and "did not come" after.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        // Both, together: the hub cannot say anything useful about a student
        // whose programme it does not know, and a second round trip after the
        // first has painted would move the page under them.
        const [me, fields] = await Promise.all([
          api.mySubscription(),
          api.myFields().catch(() => []),
        ]);
        if (!live) return;
        const chosen = fields.find((field) => field.chosen) ?? null;
        setSession({
          kind: 'signedIn',
          activeUntil: me.active ? me.expiresAt : null,
          lapsedOn: !me.active && me.hasEverPaid ? me.expiresAt : null,
          pendingClaim: me.pendingClaim,
          freeRemaining: me.freeRemaining,
          // An empty list means the request failed, and a student who has one
          // must not be nagged to choose because of a dropped connection.
          needsProgramme: fields.length > 0 && chosen === null,
          field: chosen ? { id: chosen.id, name: chosen.name, examDate: chosen.examDate } : null,
        });
      } catch {
        // Any failure here means "not signed in as far as this screen is
        // concerned". It only decides which sentence to show — nothing is
        // gated on it, and the API refuses on its own regardless.
        if (live) setSession({ kind: 'signedOut' });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const fieldId = session.kind === 'signedIn' ? (session.field?.id ?? null) : null;

  useEffect(() => {
    if (fieldId === null) return;
    let live = true;
    void (async () => {
      /*
       * Settled, not all-or-nothing.
       *
       * Six independent reads feed six independent blocks. `Promise.all` would
       * let one slow or failing endpoint take the whole page down with it, and
       * the countdown has nothing to do with whether the leaderboard service is
       * up.
       */
      const results = await Promise.allSettled([
        api.me(),
        api.coverage(fieldId),
        api.readiness(fieldId),
        api.practiceSummary(),
        api.trend(fieldId),
        api.standing(),
        api.pointsLedger(LEDGER_PAGE),
      ] as const);
      if (!live) return;
      const value = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' ? r.value : null;
      const [me, coverage, readiness, today, trend, standing, ledger] = results;
      setDetail({
        name: value(me)?.displayName ?? null,
        coverage: value(coverage),
        readiness: value(readiness),
        today: value(today),
        trend: value(trend),
        standing: value(standing),
        ledger: value(ledger),
      });
      setPartial(results.some((r) => r.status === 'rejected'));
      setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, [fieldId]);

  /**
   * The one thing to do next, which depends on where the student is (T-269).
   *
   * **The hub once had no primary action in the state that most needed one.** A
   * paywalled student was told "Your free questions are used up" in caption
   * text with no control attached, while a student who had *not* chosen a
   * programme got a proper button — so the product was clearest with the
   * visitor who had the least urgent problem.
   *
   * The practise case now names a topic when readiness has one to suggest, and
   * goes straight to it: `?topic=` is honoured by the practice screen and the
   * API since the QA round that found it built and never read.
   */
  const practiceNext = detail.readiness?.practiceNext ?? null;
  const nextStep =
    session.kind !== 'signedIn'
      ? null
      : session.needsProgramme
        ? { href: '/choose', label: c.home.chooseProgramme }
        : session.activeUntil === null && session.freeRemaining === 0
          ? // Out of free questions and not paying. The only move that opens
            // anything new is the one this button is.
            { href: '/checkout', label: c.home.goCheckout }
          : practiceNext
            ? {
                href: `/practice?topic=${encodeURIComponent(practiceNext.topicId)}`,
                label: c.today.continueWith(practiceNext.topicName),
              }
            : { href: '/practice', label: c.home.startPractising };

  const action = nextStep ? (
    <a href={nextStep.href} className="btn-primary" data-next-step="">
      {nextStep.label}
    </a>
  ) : null;

  /*
   * The access line, when there is something to say.
   *
   * What is true of THIS student rather than of students in general: a lapse
   * yesterday, a transfer waiting to be checked, the free questions running
   * out. An active plan says nothing here — the sidebar's access card carries
   * it on a desktop and Account carries it on a phone, and a line restating
   * "Full access until …" every morning is a line people stop reading.
   */
  const notices: string[] = [];
  if (session.kind === 'signedIn' && !session.needsProgramme) {
    if (session.lapsedOn) notices.push(c.home.lapsedOn(day(session.lapsedOn)));
    else if (session.activeUntil === null && session.freeRemaining !== null) {
      notices.push(c.home.freeLeft(session.freeRemaining));
    }
    if (session.pendingClaim) notices.push(c.home.claimWaiting(session.pendingClaim.txRef));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-caption text-ink-3 uppercase">{todayLabel()}</span>
        <h1 className="font-display text-[clamp(24px,3.4vw,30px)] leading-[1.15] font-extrabold tracking-[-0.025em]">
          {c.today.greeting(new Date().getHours(), detail.name)}
        </h1>
      </header>

      {session.kind === 'signedOut' ? (
        <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-5">
          <p className="text-body">{c.home.signedOut}</p>
          {/* What to do if you have no account yet, since the button below is
              for people who do. */}
          <p className="text-caption text-ink-2">{c.home.signedOutWhy}</p>
          <a href="/signin" className="btn-primary">
            {c.signIn.signInAction}
          </a>
          <a href="/signup" className="btn-ghost">
            {c.signIn.noAccount}
          </a>
        </section>
      ) : null}

      {/*
        No programme yet: this is the whole screen.

        Practise, Mock and Ask all redirect to `/choose`, so a student with no
        programme met three dead links before finding the one screen that
        unblocks them. None of the blocks below has anything to read until there
        is a programme, so none of them is drawn as an empty shell.
      */}
      {session.kind === 'signedIn' && session.needsProgramme ? (
        <section
          className="border-border bg-surface rounded-card flex flex-col gap-3 border p-5"
          data-standing=""
        >
          <p className="text-body">{c.home.chooseFirst}</p>
          <p className="text-caption text-ink-2">{c.home.chooseFirstWhy}</p>
          {action}
        </section>
      ) : null}

      {notices.length > 0 ? (
        <div
          className="border-pending/30 bg-pending-soft rounded-card text-ink flex flex-col gap-1 border px-4 py-3 text-[14px]"
          data-standing=""
          {...(session.kind === 'signedIn' && session.pendingClaim
            ? { 'data-pending-claim': '' }
            : {})}
        >
          {notices.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      {session.kind === 'signedIn' && session.field ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Countdown fieldName={session.field.name} coverage={detail.coverage} loaded={loaded} />
            <Plan coverage={detail.coverage} today={detail.today}>
              {action}
            </Plan>
          </div>

          <div
            className={[
              /*
                `grid-cols-1`, not the implicit column. An implicit track is
                `auto`, whose minimum is the widest thing in it, so six mock
                bars with their labels pushed the phone column 26px past the
                screen. `grid-cols-1` is `minmax(0, 1fr)`, which lets it shrink.
              */
              'grid grid-cols-1 gap-4',
              // Two columns only when there are two things to put in them; a
              // failed readiness read must not leave a blank column.
              detail.readiness ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]' : '',
            ].join(' ')}
          >
            {detail.readiness ? <Topics readiness={detail.readiness} /> : null}
            <div className="flex flex-col gap-4">
              {detail.trend ? <Mocks points={detail.trend} /> : null}
              {detail.standing ? (
                <Streak standing={detail.standing} ledger={detail.ledger} />
              ) : null}
            </div>
          </div>

          {partial ? <p className="text-caption text-ink-2">{c.today.couldNotLoad}</p> : null}

          {/*
            Ask is the exception, and the only destination with a link here.

            Everything else is a tab away in the navigation. Ask left the bar in
            the redesign and was promised a home on Today — and it is the one
            destination a student does not reach by habit, so a line pointing at
            it is the difference between a discussion surface that is used and
            one that is not.
          */}
          <a
            href="/community"
            className="border-border bg-surface rounded-card hover:border-border-strong flex flex-col gap-0.5 border p-4"
          >
            <span className="text-ink text-[15px] font-semibold">{c.home.goAsk}</span>
            {/* What it is, on the link itself. A bare noun makes somebody
                guess, and a stressed student guesses wrong. */}
            <span className="text-caption text-ink-2">{c.home.goAskWhy}</span>
          </a>
        </>
      ) : null}

      {/*
        The way out, on a phone.

        The sidebar carries one from `lg` up, and the bottom bar has five
        destinations and no room for a sixth. Without this the foot of the
        Account page would be the only sign-out on a phone.
      */}
      {session.kind === 'signedIn' ? <SignOutButton className="self-start lg:hidden" /> : null}
    </div>
  );
}

/* --------------------------------------------------------------- the blocks */

/**
 * The dark hero: days to the sitting, and coverage against its target.
 *
 * `ink-deep` is a surface, not a mode, the same object as the landing's bands —
 * which is why it uses the `on-deep` inks and nothing from the light set.
 */
function Countdown({
  fieldName,
  coverage,
  loaded,
}: {
  fieldName: string;
  coverage: CoverageView | null;
  loaded: boolean;
}) {
  const c = copy();
  const days = coverage?.daysToExam ?? null;
  /*
   * "No sitting date" is a statement about the student, so it waits for the
   * answer. Before this, every student with a date was told they had none for
   * the second the coverage took to arrive. A failed read says nothing either:
   * the banner above the page already says some of it did not load.
   */
  const unknown = coverage === null;

  return (
    <section className="bg-ink-deep on-deep text-on-deep rounded-panel flex flex-col gap-6 p-6">
      <span className="text-caption text-on-deep-3 uppercase">{fieldName}</span>

      <div className="flex flex-col gap-1">
        {unknown ? (
          <span
            aria-hidden="true"
            data-countdown-pending=""
            className={`bg-on-deep/10 block h-14 w-40 rounded-option ${loaded ? '' : 'animate-pulse'}`}
          />
        ) : days !== null && days > 0 ? (
          <div className="flex items-baseline gap-3">
            {/* The one hero figure on the page. */}
            <span className="font-display num text-[56px] leading-none font-extrabold tracking-[-0.03em]">
              {days}
            </span>
            <span className="text-on-deep-2 text-[16px] font-semibold">
              {c.today.daysLeft(days)}
            </span>
          </div>
        ) : (
          <p className="font-display text-[22px] leading-tight font-bold">
            {days === null ? c.today.noDate : days === 0 ? c.today.examToday : c.today.examPassed}
          </p>
        )}
      </div>

      {coverage ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-on-deep-2 text-[14px] font-semibold">{c.today.coverage}</span>
            <span className="num text-[15px] font-semibold">{coverage.pct}%</span>
          </div>
          {/*
            The meter, with the target as a place on it.

            Track and fill from the same family — a lemon fill on a faint
            on-deep track — so the state reads across the whole bar rather than
            only where the fill stops. The target is a tick, not a sentence, so
            "how far to go" is a distance you can see.
          */}
          <div
            className="bg-on-deep/10 relative h-2.5 rounded-full"
            role="img"
            aria-label={`${coverage.pct}% of ${coverage.targetPct}%`}
          >
            <div
              className="bg-brand h-full rounded-full"
              style={{ width: `${Math.min(100, coverage.pct)}%` }}
            />
            <span
              aria-hidden="true"
              className="bg-on-deep absolute -top-1 h-[18px] w-0.5 rounded-full"
              style={{ left: `${Math.min(100, coverage.targetPct)}%` }}
            />
          </div>
          <span className="text-on-deep-2 text-[14px] leading-[1.5]">
            {c.today.coverageLine(
              coverage.beaten,
              coverage.total,
              coverage.toTarget,
              coverage.targetPct,
            )}
          </span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Today's plan: how many done of the daily target, and the one button.
 *
 * The target is `perDay`, which the server derives — questions left to the 80%
 * target over days to the sitting, floored at twelve. Null means there is no
 * date to divide by, and that is said in words rather than drawn as a zero:
 * a zero against a target draws a full ring, which is the one wrong answer
 * worse than no answer.
 */
function Plan({
  coverage,
  today,
  children,
}: {
  coverage: CoverageView | null;
  today: PracticeSummary | null;
  children: React.ReactNode;
}) {
  const c = copy();
  const answered = today?.answered ?? 0;
  const perDay = coverage?.perDay ?? null;
  const done = perDay !== null && answered >= perDay;

  return (
    <section className="border-border bg-surface rounded-panel flex flex-col gap-5 border p-6">
      <h2 className="text-ink text-[16px] font-bold">{c.today.planTitle}</h2>

      <div className="flex items-center gap-5">
        {perDay !== null ? <PlanRing done={answered} of={Math.max(perDay, 1)} /> : null}
        <div className="flex flex-col gap-0.5">
          <span className="text-ink text-[17px] font-semibold">
            {perDay === null
              ? c.today.answeredToday(answered)
              : done
                ? c.today.doneToday
                : c.today.toGo(perDay - answered)}
          </span>
          <span className="text-ink-2 text-[14px]">
            {perDay === null ? c.today.noTarget : done ? c.today.doneTodayWhy : null}
          </span>
        </div>
      </div>

      <div className="mt-auto">{children}</div>
    </section>
  );
}

/** n of the target, as a ring with the count written inside it. */
function PlanRing({ done, of }: { done: number; of: number }) {
  const size = 84;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Clamped: past the target the ring is full, not wrapped round a second time.
  const progress = (Math.min(done, of) / of) * circumference;

  return (
    <div className="relative grid size-[84px] shrink-0 place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        {/*
          Not drawn at zero.

          A zero-length arc with a round cap is still a dot — a yellow one at
          twelve o'clock, on a ring reading 0/12, which looks like a sliver of
          progress that has not happened. Nothing done draws nothing.
        */}
        {done > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      {/* The count is the content; the ring only draws it. */}
      <span className="font-display num absolute text-[18px] font-extrabold">
        {done}/{of}
      </span>
    </div>
  );
}

/**
 * Topics by their share of past papers, with the 60% line.
 *
 * The five heaviest — the ones that move the most marks. Below `PASS_SAFE_PCT`
 * the bar is pending orange and the row says "Focus" in words, because colour
 * never carries a state alone. Orange, not the wrong red the progress screen
 * used: a topic under the line is unfinished, not failed, and the design keeps
 * those two visibly apart.
 */
function Topics({ readiness }: { readiness: Readiness }) {
  const c = copy();
  const heaviest = [...readiness.topics].sort((a, b) => b.weightPct - a.weightPct).slice(0, 5);
  const below = readiness.topics.filter((topic) => topic.focus).length;

  return (
    <section className="border-border bg-surface rounded-panel flex flex-col gap-5 border p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ink text-[16px] font-bold">{c.today.topicsTitle}</h2>
        <a
          href="/progress"
          className="text-link hover:text-link-hover -mr-1 inline-flex min-h-11 items-center px-1 text-[14px] font-semibold"
        >
          {c.today.allTopics(readiness.topics.length)}
        </a>
      </div>

      <ul className="flex flex-col gap-4">
        {heaviest.map((topic) => {
          const tried = topic.scorePct !== null;
          const low = topic.focus;
          return (
            <li key={topic.topicId} className="flex flex-col gap-1.5" data-focus={low}>
              <div className="flex items-baseline justify-between gap-3">
                {/* Wrapped, not truncated: on a phone "Principles of
                    Accounting and…" hid the very word that told two topics
                    apart. */}
                <span className="text-ink min-w-0 text-[15px] font-semibold break-words">
                  {topic.topicName}
                </span>
                <span className="text-ink-3 num shrink-0 text-[13px]">
                  {c.today.weightOf(topic.weightPct)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={[
                    'relative h-2 flex-1 overflow-hidden rounded-full',
                    low ? 'bg-pending-soft' : 'bg-surface-2',
                  ].join(' ')}
                >
                  <div
                    className={['h-full rounded-full', low ? 'bg-pending' : 'bg-ink'].join(' ')}
                    style={{ width: `${tried ? Math.min(100, topic.scorePct!) : 0}%` }}
                  />
                </div>
                <span
                  className={[
                    'num min-w-[4.5rem] shrink-0 text-right text-[13px] font-semibold whitespace-nowrap',
                    low ? 'text-pending' : 'text-ink',
                  ].join(' ')}
                >
                  {tried ? `${topic.scorePct}%` : c.today.notTried}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Nothing tried is its own sentence. "Every topic you have tried is
          above 60%" is vacuously true of nobody-has-started, and reads as
          praise for work that has not happened. */}
      <p className="text-ink-2 text-[14px] leading-[1.5]">
        {readiness.topics.some((topic) => topic.scorePct !== null)
          ? c.today.belowLine(below, PASS_SAFE_PCT)
          : c.today.noneTried}
      </p>
    </section>
  );
}

/** Mock scores, as the product already draws them: bars, by sitting. */
function Mocks({ points }: { points: TrendPoint[] }) {
  const c = copy();
  const last = points.at(-1);
  const before = points.at(-2);

  return (
    <section className="border-border bg-surface rounded-panel flex flex-col gap-4 border p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-ink text-[16px] font-bold">{c.today.mocksTitle}</h2>
        {last && before ? (
          <span className="text-ink-2 num text-[13px] font-semibold">
            {c.today.sinceLast(last.scorePct - before.scorePct, before.label)}
          </span>
        ) : null}
      </div>
      {/*
        `ScoreTrend`, not the handoff's line.

        T-138 decided this in as many words: "A line implies the values in
        between mean something, and there is nothing between Mock 1 and Mock 2."
        Progress draws the same component, so the two screens cannot disagree
        about what a mock score looks like. Its styling is step 9's to redo.
      */}
      <ScoreTrend points={points.slice(-6)} />
      {points.length === 0 ? (
        <a href="/mocks" className="btn-ghost">
          {c.today.sitAMock}
        </a>
      ) : null}
    </section>
  );
}

/**
 * Study days, points, and the last seven days.
 *
 * The week is drawn **only when the ledger page provably covers it.** Each
 * answer earns ledger rows, so a busy student's 200-row page can stop four days
 * back — and the days before that would be drawn as empty although they were
 * not. If the page is full and does not reach back seven days, the row is left
 * out rather than drawn wrong.
 */
function Streak({ standing, ledger }: { standing: StandingView; ledger: LedgerRow[] | null }) {
  const c = copy();
  const week = ledger ? weekFrom(ledger) : null;

  return (
    <section className="border-border bg-surface rounded-panel flex flex-col gap-4 border p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-ink text-[16px] font-bold">
          {c.today.streak(standing.streakDays)}
        </span>
        <span className="text-ink-2 num text-[14px]">
          {c.today.points(standing.totalPoints, week?.todayPoints ?? null)}
        </span>
      </div>

      {week ? (
        <ol aria-label={c.today.weekLabel} className="grid grid-cols-7 gap-1.5">
          {week.days.map((d) => (
            <li
              key={d.day}
              className="flex flex-col items-center gap-1"
              aria-label={d.active ? c.today.weekDayDone(d.label) : c.today.weekDayOpen(d.label)}
            >
              {/*
                Studied is a filled lemon dot; not studied is an outline, never
                a red one. A day off is not a failure here, and the count above
                never goes down for it.
              */}
              <span
                aria-hidden="true"
                className={[
                  'size-7 rounded-full border',
                  d.active ? 'border-brand-hover bg-brand' : 'border-border-input bg-surface',
                  d.isToday ? 'ring-ink ring-2 ring-offset-2' : '',
                ].join(' ')}
              />
              <span aria-hidden="true" className="text-ink-3 text-[11px] font-semibold">
                {d.label.slice(0, 1)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <p className="text-ink-3 text-[13px]">{c.today.streakWhy}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- the clock */

// `addisDay` is shared with Progress: `lib/addis-day.ts`.

/**
 * The last seven Addis days, oldest first, marked from the ledger — or null when
 * the page cannot vouch for all seven.
 *
 * The page vouches for a day when it is not full (it is the whole history) or
 * when its oldest row is older than that day (everything after it is present).
 * Today's points need the same guarantee, so they come back null too rather
 * than as an undercount.
 */
function weekFrom(ledger: LedgerRow[]): {
  days: { day: string; label: string; active: boolean; isToday: boolean }[];
  todayPoints: number | null;
} | null {
  const now = Date.now();
  const days = Array.from({ length: 7 }, (_, i) => addisDay(now - (6 - i) * DAY_MS));
  const today = days[6]!;
  const oldest = ledger.at(-1)?.day ?? null;
  const complete = ledger.length < LEDGER_PAGE || (oldest !== null && oldest < days[0]!);
  if (!complete) return null;

  const active = new Set(ledger.map((row) => row.day));
  return {
    days: days.map((d) => ({
      day: d,
      label: new Date(`${d}T12:00:00Z`).toLocaleDateString('en', {
        weekday: 'short',
        timeZone: 'UTC',
      }),
      active: active.has(d),
      isToday: d === today,
    })),
    todayPoints: ledger
      .filter((row) => row.day === today)
      .reduce((sum, row) => sum + row.points, 0),
  };
}

/** "Saturday, October 3", in the reader's own locale. */
function todayLabel(): string {
  return new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
}
