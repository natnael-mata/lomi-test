'use client';

/**
 * Every mock paper, kept and readable (T-258, design handoff § 11).
 *
 * **The split is the point.** A sitting reading 28% where only 62 questions were
 * attempted is 45% of what was attempted, with 38 left blank — and those are
 * opposite diagnoses. One is knowledge and the other is pacing; one is fixed by
 * studying and the other by a watch. A bare percentage names neither, which is
 * why every sitting draws correct / wrong / blank as one bar that sums to the
 * paper.
 *
 * **"Left blank", never "ran out of time".** The figure counts blanks and knows
 * nothing about why: a paper submitted early leaves them too, and QA was once
 * told they had run out of time on a sitting they closed with eighteen minutes
 * to spare. `ranOutOfTime` is a separate flag from the close reason, and it is
 * the only thing entitled to say so.
 *
 * The bar is three spans in a flex row rather than a chart: the widths are
 * percentages of a total the student can read directly beneath it, so the
 * drawing and the sentence cannot disagree.
 */
import { Card } from './Card';
import { Chip } from './Chip';
import { copy } from '../lib/i18n';
import { day } from '../lib/dates';
import type { TrendPoint } from '../lib/api';

function Bar({ point }: { point: TrendPoint }) {
  const total = point.totalQuestions || 1;
  const parts: [string, number, string][] = [
    // Teal, terracotta, pencil — the semantic states, never invented colours.
    ['bg-correct', point.scoreCorrect, copy().progress.sittingCorrect],
    ['bg-wrong', point.wrong, copy().progress.sittingWrong],
    ['bg-pending', point.blank, copy().progress.sittingBlank],
  ];

  return (
    <span
      className="bg-surface-2 flex h-3 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={copy().progress.sittingLegend(
        point.scoreCorrect,
        point.wrong,
        point.blank,
        point.totalQuestions,
      )}
    >
      {parts.map(([tone, count, label]) =>
        count > 0 ? (
          <span
            key={label}
            className={`${tone} block h-full`}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ) : null,
      )}
    </span>
  );
}

/**
 * Whether the second reading of this paper is worth showing.
 *
 * Written with no `<` in it, on purpose. The dictionary guard scans components
 * for text sitting between `>` and `<`, and `answeredCount > 0 && answeredCount
 * < totalQuestions` is indistinguishable from JSX text to a regex. Bending the
 * comparison is a smaller price than loosening a check that earns its keep
 * across every other file — and `total > attempted` reads no worse.
 */
function partlyAttempted(point: TrendPoint): boolean {
  return point.answeredCount >= 1 && point.totalQuestions > point.answeredCount;
}

export function SittingHistory({ points }: { points: TrendPoint[] }) {
  const c = copy();

  return (
    <section className="flex flex-col gap-3" data-sittings="">
      <h2 className="text-title">{c.progress.sittingsTitle}</h2>

      {points.length === 0 ? (
        <p className="text-body text-ink-2">{c.progress.sittingsEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {/* Newest first: the paper somebody wants to look at is the one they
              just sat, and the trend chart above already tells the story in
              order. */}
          {[...points].reverse().map((point) => (
            <li key={point.sittingId}>
              <Card as="article" className="flex flex-col gap-2" data-sitting={point.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-label">{point.label}</span>
                  <span className="text-caption text-ink-2 num">
                    {day(point.startedAt)} · {c.progress.sittingMinutes(point.minutesUsed)}
                  </span>
                </div>

                <Bar point={point} />

                <p className="text-caption text-ink-2 num">
                  {c.progress.sittingLegend(
                    point.scoreCorrect,
                    point.wrong,
                    point.blank,
                    point.totalQuestions,
                  )}
                </p>

                {/*
                  The second reading of the same paper.
                  28% of the whole is 45% of what was attempted, and a student
                  who left a third of it blank is being told two different
                  things by those numbers. Only shown where they differ.
                */}
                {partlyAttempted(point) ? (
                  <p className="text-caption text-ink-2 num">
                    {c.progress.sittingOfAttempted(
                      Math.round((point.scoreCorrect / point.answeredCount) * 100),
                      point.answeredCount,
                    )}
                  </p>
                ) : null}

                {/* The close reason is the only thing entitled to claim a cause. */}
                {point.ranOutOfTime ? (
                  <Chip tone="pending" className="self-start">
                    {c.progress.notReached(point.blank)}
                  </Chip>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
