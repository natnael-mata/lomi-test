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
              <div
                className="bg-brand w-full rounded-t-[inherit]"
                style={{ height: `${Math.max(2, Math.min(100, point.scorePct))}%` }}
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
          <li key={point.sittingId} className="flex items-center justify-between gap-2">
            <span className="text-caption text-ink-2">{point.label}</span>
            <span className="text-caption num">
              {point.scoreCorrect} / {point.totalQuestions}
            </span>
            {/* A mock that expired at question 60 is a different story from one
                finished badly, and a bar alone cannot tell them apart. */}
            {point.ranOutOfTime && (
              <Chip tone="pending" data-ran-out="">
                {c.progress.notReached(point.unanswered)}
              </Chip>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
