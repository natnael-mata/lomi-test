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
                A floor in pixels, not per cent — and a zero that looks like a
                zero (T-269).

                `Math.max(2, …)` of a 96px track is a 2px hairline, so a zero
                drew as an empty outlined box, which reads as a chart that
                failed to render rather than a score of nothing. The fix was a
                flat 6px foot on every bar, and that overshot: 6px is also what
                5% of the track comes to, so on a set of early scores every bar
                was the same 6px strip whatever it stood for. An audit found
                five bars rendering identically across 0% and 5%, and called the
                colour there meaningless. It was.

                So the foot is only for a genuine zero, and it is drawn in
                pencil rather than brand — a bar that stands for nothing scored
                should not be the same colour as one that stands for a score.
                Anything above zero uses its true height with a 3px minimum,
                which is thinner than the 6px zero and therefore never confused
                with it.
              */}
              <div
                className={`w-full rounded-t-[inherit] ${
                  point.scorePct === 0 ? 'bg-pending' : 'bg-brand'
                }`}
                style={
                  point.scorePct === 0
                    ? { height: '6px' }
                    : { minHeight: '3px', height: `${Math.min(100, point.scorePct)}%` }
                }
                aria-hidden="true"
              />
            </div>
            {/* `max-w-full`, or `truncate` has no width to truncate to: a flex
                column centring its items sizes each to its content. */}
            <span className="text-caption text-ink-2 max-w-full truncate">{point.label}</span>
          </li>
        ))}
      </ul>

      {/*
        The text list that used to sit here is gone (T-269).

        It restated every bar in words — label, a ran-out chip, and
        `correct / total` — on the reasoning that the chart is decoration and
        the numbers are the content. That reasoning still holds, and it is
        `SittingHistory` directly below that satisfies it: the same rows, with
        the date, the minutes taken, the correct/wrong/blank split, and a link
        into the paper. This list was a strictly smaller copy sitting between
        the chart and the full version of itself, so `/progress` printed every
        mock three times.

        The numbers stay on the chart — each bar carries its percentage above
        it — so nothing here depends on reading a shape.
      */}
    </div>
  );
}
