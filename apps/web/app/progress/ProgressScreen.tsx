'use client';

/**
 * Progress: coverage, readiness by topic, and activity (T-135 to T-139,
 * redesigned 2026-10-01).
 *
 * Everything here is computed on the server and rendered as given. The client
 * deliberately does no arithmetic of its own: DESIGN.md requires the headline to
 * be reconstructible from the rows on screen, and two implementations of the
 * same weighted mean is how the headline and the rows start to disagree.
 *
 * **What the redesign changed** (handoff, § Progress):
 *
 * 1. Four figures across the top, each with how it was worked out beside it.
 *    The handoff's four are readiness, latest mock, day streak and topics
 *    below 60%. Coverage takes the first slot, because T-256 made it the
 *    product's headline (a count a student can check); "topics below the
 *    line" moves into the readiness card's own header, where the topics are;
 *    and the streak is "study days", because the API counts days shown up,
 *    not days in a row.
 * 2. Readiness for every topic, with how many answers each score rests on
 *    folded into its row, where it used to be a second list under the first.
 * 3. Five weeks of activity, counted from the points ledger, and only when the
 *    ledger can vouch for all five weeks (see `components/activity.ts`).
 * 4. The mock trend and the paper history left. Mocks lists every paper with
 *    its score and its results now, and printing them here as well made every
 *    mock appear on two screens.
 */
import { useEffect, useState } from 'react';

import { activityFrom, levelOf, type ActivityCell } from '../../components/activity';
import { Button } from '../../components/Button';
import { CoveragePanel } from '../../components/CoveragePanel';
import { Icon } from '../../components/icons';
import { PracticeCta } from '../../components/PracticeCta';
import { ReadinessStatement } from '../../components/ReadinessStatement';
import {
  type CoverageView,
  api,
  refusalMessage,
  signInRequired,
  type LedgerRow,
  type Readiness,
  type StandingView,
  type TrendPoint,
} from '../../lib/api';
import { copy } from '../../lib/i18n';

/** The server's maximum ledger page. See `activityFrom`. */
const LEDGER_PAGE = 200;

export function ProgressScreen() {
  const c = copy();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * No programme chosen. Readiness is per programme, so there is nothing to
   * show and somewhere specific to go.
   */
  const [noProgramme, setNoProgramme] = useState(false);
  /** The headline. Null when it could not be read, which hides its card. */
  const [coverage, setCoverage] = useState<CoverageView | null>(null);
  const [standing, setStanding] = useState<StandingView | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  /** Bumped by "Try again" to rerun the load. */
  const [attempt, setAttempt] = useState(0);
  const reload = (): void => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fields = await api.myFields();
        const fieldId = fields.find((f) => f.chosen)?.id;
        if (!fieldId) {
          if (!cancelled) setNoProgramme(true);
          return;
        }
        /*
         * Readiness is the screen; without it there is nothing to show, so a
         * failure there is the page's error. Everything else is settled on its
         * own: a slow ledger must not cost a student their coverage.
         */
        const [r, rest] = await Promise.all([
          api.readiness(fieldId),
          Promise.allSettled([
            api.trend(fieldId),
            api.coverage(fieldId),
            api.standing(),
            api.pointsLedger(LEDGER_PAGE),
          ] as const),
        ]);
        if (cancelled) return;
        const [t, cov, st, led] = rest;
        setReadiness(r);
        setTrend(t.status === 'fulfilled' ? t.value : []);
        setCoverage(cov.status === 'fulfilled' ? cov.value : null);
        setStanding(st.status === 'fulfilled' ? st.value : null);
        setLedger(led.status === 'fulfilled' ? led.value : null);
      } catch (e) {
        if (signInRequired(e)) {
          window.location.assign('/signin');
          return;
        }
        if (!cancelled) setError(refusalMessage(e) ?? c.progress.couldNotLoad);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (noProgramme) {
    return (
      <section
        data-state="no-programme"
        className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6"
      >
        <p className="text-body">{c.progress.chooseProgramme}</p>
        <a className="btn-primary" href="/choose">
          {c.progress.chooseFirst}
        </a>
      </section>
    );
  }

  if (error) {
    return (
      <section
        data-state="error"
        className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6"
      >
        <p className="text-body">{error}</p>
        {/* The error says to try again; this is the control that does it,
            rather than leaving the reload button to the browser. */}
        <Button variant="ghost" className="self-start" onClick={() => void reload()}>
          {c.common.tryAgain}
        </Button>
      </section>
    );
  }

  if (!readiness) {
    return (
      <p data-state="loading" className="text-body text-ink-2 py-8 text-center">
        {c.progress.working}
      </p>
    );
  }

  const header = (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[clamp(26px,3vw,32px)] leading-[1.2] font-extrabold tracking-[-0.025em]">
        {c.progress.title}
      </h1>
      <p className="text-ink-2 text-[15px]">
        {c.progress.subtitle(readiness.fieldName, readiness.totalAnswered)}
      </p>
    </header>
  );

  // Nothing answered: there is no readiness figure, and inventing one (a zero)
  // would be the first false number a new student sees.
  if (readiness.headlinePct === null) {
    return (
      <div className="flex flex-col gap-6" data-state="unassessed">
        {header}
        <section className="border-border bg-surface rounded-card flex flex-col gap-2 border p-6">
          <h2 className="font-display text-[18px] font-bold">{c.progress.nothingYetTitle}</h2>
          <p className="text-body text-ink-2">{c.progress.nothingYet}</p>
        </section>
        <PracticeCta topicId={null} topicName={null} />
      </div>
    );
  }

  const scored = readiness.topics.filter((t) => t.scorePct !== null);
  const latest = trend.at(-1) ?? null;
  const cells = ledger ? activityFrom(ledger, Date.now(), LEDGER_PAGE) : null;

  /*
   * The four figures. Each states how it was worked out, under it: DESIGN.md's
   * rule for a derived figure, and the reason none of these is a bare number.
   */
  const tiles: { label: string; value: string; how: string; lead?: boolean }[] = [
    ...(coverage
      ? [
          {
            label: c.progress.kpiCoverage,
            value: `${coverage.pct}%`,
            how: c.progress.kpiCoverageHow(coverage.beaten, coverage.total),
            lead: true,
          },
        ]
      : []),
    {
      label: c.progress.kpiReadiness,
      value: `${readiness.headlinePct}%`,
      how: c.progress.kpiReadinessHow(readiness.assessedWeightPct),
    },
    {
      label: c.progress.kpiLatestMock,
      value: latest ? `${latest.scorePct}%` : c.progress.kpiNoneValue,
      how: latest ? c.progress.kpiLatestMockHow(latest.label) : c.progress.kpiNoMock,
    },
    ...(standing
      ? [
          {
            label: c.progress.kpiStudyDays,
            value: standing.streakDays.toLocaleString('en'),
            how: c.progress.kpiStudyDaysHow,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6" data-state="ready">
      {header}

      {/* Four tiles: one column on a phone, two by two in between, a row of
          four from `lg`. `auto-fit` left three and an orphan at tablet width. */}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="border-border bg-surface rounded-card flex flex-col gap-1 border p-5"
          >
            {/* `dt` before `dd` in the source, so a screen reader hears
                "Coverage, 15%"; the figure is drawn first with `order-first`,
                and at the top of the tile, so all four line up whatever the
                caption under them runs to. */}
            <dt className="text-ink-3 text-[14px] font-medium">
              {tile.label}
              <span className="text-ink-3 block text-[12px] font-normal">{tile.how}</span>
            </dt>
            <dd
              className={`font-display num order-first text-[34px] leading-10 font-extrabold ${
                tile.lead ? 'text-link' : 'text-ink'
              }`}
            >
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {coverage ? <CoveragePanel coverage={coverage} answered={readiness.totalAnswered} /> : null}

        <div className="flex flex-col gap-3">
          <ReadinessStatement
            showHeadline={false}
            statement={{
              rows: scored.map((t) => ({
                topic: t.topicName,
                scorePct: t.scorePct!,
                weightPct: t.weightPct,
                answered: t.answered,
              })),
              elided:
                readiness.unassessedWeightPct > 0
                  ? {
                      label: c.progress.otherTopics,
                      weightPct: readiness.unassessedWeightPct,
                      topicCount: readiness.topics.length - scored.length,
                      topics: readiness.topics
                        .filter((t) => t.scorePct === null)
                        .map((t) => t.topicName),
                    }
                  : null,
              headlinePct: readiness.headlinePct,
              focus: readiness.focus.map((t) => ({
                topic: t.topicName,
                scorePct: t.scorePct ?? 0,
                weightPct: t.weightPct,
              })),
            }}
            derivation={c.progress.weightedAcross(
              readiness.assessedWeightPct,
              readiness.totalAnswered,
            )}
            practiceNext={readiness.practiceNext}
          />

          {/* The two big percentages, told apart where both are on screen. */}
          {coverage ? (
            <p className="text-caption text-ink-2">{c.progress.readinessVsCoverage}</p>
          ) : null}

          {/* Unanswered mock questions count against readiness, and a student
              who left them blank deserves to know that is where it went. */}
          {readiness.unansweredInMocks > 0 && (
            <p className="text-caption text-ink-2" data-unanswered-note="">
              {c.progress.unansweredInMocks(readiness.unansweredInMocks)}
            </p>
          )}
        </div>
      </div>

      {cells ? <Activity cells={cells} /> : null}

      {/*
        Standing left the navigation in the redesign and was promised a home
        here: points, tier and the leaderboard are about progress too, and a
        built screen nothing links to is the defect this product has shipped
        before.
      */}
      <a
        href="/standing"
        className="border-border bg-surface rounded-card hover:border-border-strong flex items-center justify-between gap-3 border p-5"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-ink text-[15px] font-semibold">{c.progress.standingLink}</span>
          <span className="text-caption text-ink-2">{c.progress.standingLinkWhy}</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </a>

      {trend.length > 0 ? (
        <p className="text-caption text-ink-2">
          <a
            href="/mocks"
            className="text-link hover:text-link-hover inline-flex min-h-11 items-center font-semibold"
          >
            {c.progress.mocksLink}
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** The four shades, lightest to darkest, keyed by `levelOf`. */
// Level 1 is the softest lemon, so the first step up from nothing is a
// different family from level 2 rather than a near twin of it.
const SHADE = ['bg-surface-2', 'bg-brand-soft', 'bg-brand', 'bg-link'] as const;

/**
 * Five weeks, a row a week, Monday first.
 *
 * Each cell says its date and its count to a screen reader; the shade is for
 * the eye and is keyed under the grid with the numbers it stands for, so it is
 * never the only way to read a day.
 */
function Activity({ cells }: { cells: ActivityCell[] }) {
  const c = copy();
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <section className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[18px] font-bold">{c.progress.activityTitle}</h2>
        <span className="text-ink-3 text-[13px]">{c.progress.activityWhy}</span>
      </div>

      <div className="grid max-w-[420px] grid-cols-7 gap-1.5">
        {weekdays.map((d, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="text-ink-3 text-center text-[11px] font-semibold"
          >
            {d}
          </span>
        ))}
        {cells.map((cell) => (
          <span
            key={cell.day}
            {...(cell.future
              ? { 'aria-hidden': true as const }
              : {
                  role: 'img',
                  'aria-label': c.progress.activityDay(
                    new Date(`${cell.day}T12:00:00Z`).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    }),
                    cell.answered,
                  ),
                })}
            className={[
              'aspect-square rounded-[4px]',
              cell.future ? 'border-border border border-dashed' : SHADE[levelOf(cell.answered)],
              cell.today ? 'ring-ink ring-2 ring-offset-1' : '',
            ].join(' ')}
          />
        ))}
      </div>

      <ul
        aria-hidden="true"
        className="text-ink-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium"
      >
        {c.progress.activityKey.map((label, level) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <span className={`size-3 rounded-[3px] ${SHADE[level]}`} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
