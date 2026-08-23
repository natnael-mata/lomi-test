'use client';

/**
 * Coverage — the headline figure (T-256, design handoff § 9).
 *
 * **Of the questions in your track, how many have you beaten**, against a target
 * of 80%. It replaces the weighted mean because it is a count of things done out
 * of things to do, which a fifteen-year-old can check against the screen. A
 * weighted mean of per-topic percentages is not checkable, and this product's
 * rule is that every figure must be.
 *
 * Three things the design is specific about, and each is here for a reason:
 *
 * **The target is drawn ON the ring**, not stated beside it, so the goal is
 * visible before it is reached. A ring with no goal on it says "you are at 41%"
 * and leaves the student to guess whether that is good.
 *
 * **The daily number is derived and shown with its arithmetic.** "12 a day"
 * over "5 to go, 120 days left" is a division anybody can check; a bare number
 * is something to be taken on trust, and this screen does not ask for trust.
 *
 * **The per-year breakdown reads its own column count.** Four for Grade 12, two
 * for Grade 8, three for Grade 6 — the server sends the span, because a
 * hard-coded four-column grid is wrong on three of the four school tracks. A
 * university exit exam sends null and the section does not render at all, since
 * a degree draws on no school year.
 */
import { Card } from './Card';
import { copy } from '../lib/i18n';
import type { CoverageSlice, CoverageView } from '../lib/api';

/** The ring. Plain SVG — no chart library for one arc. */
function Ring({ pct, targetPct }: { pct: number; targetPct: number }) {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Clamped: a percentage over 100 would draw an arc past its own start and
  // read as a much smaller number.
  const progress = (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  // The target as a short tick on the same circle, so the goal is a place on
  // the ring rather than a sentence next to it.
  const targetAngle = (Math.min(100, targetPct) / 100) * 360 - 90;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${pct}% of ${targetPct}%`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-surface-2)"
        strokeWidth={stroke}
      />
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
      {/* The target tick, in ink so it reads against the lemon it may sit on. */}
      <line
        x1={size / 2 + (r - stroke / 2 - 3) * Math.cos((targetAngle * Math.PI) / 180)}
        y1={size / 2 + (r - stroke / 2 - 3) * Math.sin((targetAngle * Math.PI) / 180)}
        x2={size / 2 + (r + stroke / 2 + 3) * Math.cos((targetAngle * Math.PI) / 180)}
        y2={size / 2 + (r + stroke / 2 + 3) * Math.sin((targetAngle * Math.PI) / 180)}
        stroke="var(--color-ink)"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="fill-ink text-[34px] font-bold"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {pct}%
      </text>
      <text x="50%" y="63%" textAnchor="middle" className="fill-ink-2 text-[13px]">
        {copy().progress.coverageTarget(targetPct)}
      </text>
    </svg>
  );
}

/**
 * Below this, a topic is drawn as weak (handoff frame 5a).
 *
 * Not a pass mark and never presented as one: it is the line where the design
 * changes the bar's colour so a student can find the topics worth an hour
 * without reading eleven numbers.
 */
const WEAK_BELOW_PCT = 60;

/** One breakdown row, with its own share drawn as a bar. */
function SliceRow({ slice }: { slice: CoverageSlice }) {
  const c = copy();
  return (
    <li className="flex flex-col gap-1" data-slice={slice.key}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-body truncate">{slice.label}</span>
        <span className="text-caption text-ink-2 num shrink-0">
          {c.progress.coverageRow(slice.beaten, slice.total, slice.pct)}
        </span>
      </span>
      <span className="bg-surface-2 h-2 w-full overflow-hidden rounded-full">
        {/*
          Terracotta below 60, forest above (handoff frame 5a).

          The bar was the lemon, which made every topic look the same amount of
          fine — the marker says "look here", not "this is healthy". Two fills
          split the list into the topics that need an hour and the ones that do
          not, at a glance and before reading a single number.

          Sixty because that is where the design draws it, and it is a threshold
          rather than a gradient on purpose: a continuous ramp asks a student to
          judge a hue, and the number is already printed beside the bar for
          anyone who wants precision.

          The width carries the same fact, so this is never colour alone.
        */}
        <span
          className={[
            'block h-full rounded-full',
            slice.pct < WEAK_BELOW_PCT ? 'bg-wrong' : 'bg-ink',
          ].join(' ')}
          style={{ width: `${Math.min(100, slice.pct)}%` }}
        />
      </span>
    </li>
  );
}

export function CoveragePanel({ coverage }: { coverage: CoverageView }) {
  const c = copy();

  return (
    <section className="flex flex-col gap-4" data-coverage="">
      <h2 className="text-title">{c.progress.coverageTitle}</h2>

      <Card as="section" className="flex flex-wrap items-center gap-5">
        <Ring pct={coverage.pct} targetPct={coverage.targetPct} />

        <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
          <p className="text-label num">{c.progress.coverageOf(coverage.beaten, coverage.total)}</p>
          {/* Said plainly, because "beaten" is not the obvious meaning of a
              count. A student who reads it as "answered" finds the number lower
              than they expect and concludes the product is broken. */}
          <p className="text-caption text-ink-2">{c.progress.coverageWhatBeaten}</p>

          <p className="text-body">
            {coverage.toTarget === 0
              ? c.progress.coverageDone
              : c.progress.coverageToTarget(coverage.toTarget)}
          </p>

          {/*
            The daily target, with the division that produced it.
            `perDay` is null when no exam date is set — rendered as a sentence
            saying so, never as a zero. A zero against a target draws a full
            progress bar, which is the one wrong answer worse than no answer.
          */}
          {coverage.perDay === null ? (
            <p className="text-caption text-ink-2">{c.progress.coverageNoDate}</p>
          ) : coverage.toTarget > 0 && coverage.daysToExam !== null ? (
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-label num">{c.progress.coverageDaily(coverage.perDay)}</span>
              <span className="text-caption text-ink-2 num">
                {c.progress.coverageDailyWhy(coverage.toTarget, coverage.daysToExam)}
              </span>
            </p>
          ) : null}
        </div>
      </Card>

      {/*
        The diagnostic. Rendered only where the track has school years — an exit
        exam draws on a degree, and a "which year" section over a degree names
        nothing. The rows come from the server already ordered by year.
      */}
      {coverage.years && coverage.byGrade.length > 0 ? (
        <Card as="section" className="flex flex-col gap-3">
          <h3 className="text-label">{c.progress.coverageByGrade}</h3>
          <ul className="flex flex-col gap-3">
            {coverage.byGrade.map((slice) => (
              <SliceRow key={slice.key} slice={slice} />
            ))}
          </ul>
        </Card>
      ) : null}

      {coverage.bySubject.length > 0 ? (
        <Card as="section" className="flex flex-col gap-3">
          <h3 className="text-label">{c.progress.coverageBySubject}</h3>
          {/* Weakest first, from the server — this list is read to decide what
              to do next, and the thing to do next belongs at the top. */}
          <ul className="flex flex-col gap-3">
            {coverage.bySubject.map((slice) => (
              <SliceRow key={slice.key} slice={slice} />
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
