/**
 * Score across mock sittings (T-138).
 *
 * **The axis is "Mock 1, Mock 2, Mock 3", never a date.** A date axis spaces
 * points by calendar time, so a student who sat two mocks in a week and a third
 * two months later gets a chart whose shape is about their holiday rather than
 * their revision. Ethiopia also runs its own calendar alongside the Gregorian
 * one, so a formatted date is a decision with a wrong answer per student, where
 * an ordinal has none.
 *
 * Drawn as bars rather than a line. A line implies the values in between mean
 * something, and there is nothing between Mock 1 and Mock 2 — it is a sequence
 * of separate events, not a continuous measurement.
 */
import { Chip } from './Chip';
import { copy } from '../lib/i18n';

export interface TrendPoint {
  sittingId: string;
  label: string;
  scorePct: number;
  scoreCorrect: number;
  totalQuestions: number;
  unanswered: number;
  ranOutOfTime: boolean;
}

export function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const c = copy();

  if (points.length === 0) {
    return (
      <div data-trend="empty">
        <p className="text-body text-ink-2">{c.progress.trendEmpty}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-trend="">
      <ul className="flex items-end gap-2" data-trend-bars="">
        {points.map((point) => (
          <li
            key={point.sittingId}
            data-trend-point={point.label}
            data-score={point.scorePct}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span className="text-caption num">{point.scorePct}%</span>
            {/* Fixed-height track, so the bars are read against a common
                baseline rather than against whichever was tallest. */}
            <div className="bg-surface-2 rounded-control flex h-24 w-full items-end overflow-hidden">
              {/*
                A floor in pixels, not per cent.
                `Math.max(2, …)` of a 96px track is a 2px hairline, so a zero
                drew as an empty outlined box — which reads as a chart that
                failed to render rather than a score of nothing. QA reported it
                as a rendering fault, and from the outside that is exactly what
                it looks like. A 6px foot is unmistakably a bar at the bottom.
              */}
              <div
                className="bg-brand w-full rounded-t-[inherit]"
                style={{ minHeight: '6px', height: `${Math.min(100, point.scorePct)}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-caption text-ink-2 truncate">{point.label}</span>
          </li>
        ))}
      </ul>

      {/* Every bar restated in words. The chart is decoration for anyone not
          looking at it, and the numbers are the content. */}
      <ul className="flex flex-col gap-1" data-trend-rows="">
        {points.map((point) => (
          /*
           * The score last and fixed-width, so it holds one column.
           *
           * These were three children under `justify-between` with the chip
           * conditional, so a row with a chip put the score in the middle and a
           * row without it put the score on the right. Two of three rows lined
           * up and the third did not — which reads as a glitch, and on a screen
           * whose whole claim is that every number can be checked, a column
           * that moves undermines the numbers in it.
           */
          <li key={point.sittingId} className="flex items-center gap-2">
            <span className="text-caption text-ink-2 min-w-0 flex-1 truncate">{point.label}</span>
            {/* A mock that expired at question 60 is a different story from one
                finished badly, and a bar alone cannot tell them apart. */}
            {point.ranOutOfTime && (
              <Chip tone="pending" data-ran-out="">
                {c.progress.notReached(point.unanswered)}
              </Chip>
            )}
            <span className="text-caption num w-16 shrink-0 text-right">
              {point.scoreCorrect} / {point.totalQuestions}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
