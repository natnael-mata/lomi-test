/**
 * The readiness statement (T-097).
 *
 * The signature component: topic rows with the student's percentage, a bar, and
 * the topic's **share of past papers** as a caption — never "% of exam" (T-097a,
 * decision D5: no official MoE blueprint exists, so the stronger claim is one
 * the product cannot support).
 *
 * Weights sum to 100 including an explicit elided row, and the headline is their
 * weighted mean — which is why it uses `<StatedFigure>` and not `<TotalBar>`. A
 * mean is not a column that adds up, and dressing it as one tells a student they
 * could redo the addition themselves.
 */
import { Chip } from './Chip';
import { PracticeCta } from './PracticeCta';
import { StatedFigure } from './StatedFigure';
import { elidedLabel, PASS_SAFE_PCT, type ReadinessStatement as Statement } from './readiness';
import { copy } from '../lib/i18n';

export interface ReadinessStatementProps {
  statement: Statement;
  /** How the headline was derived, for the stated figure's chip. */
  derivation?: string | undefined;
  /**
   * The topic to practise next (T-139). DESIGN.md: "Every statement ends in a
   * practice action": a screen that diagnoses a student and stops has done
   * half the job.
   */
  practiceNext?: { topicId: string; topicName: string } | null;
  /**
   * Whether this card states the headline itself.
   *
   * Progress states it in a figure tile above (redesign, § Progress), with the
   * same derivation, and the same figure twice on one screen is once too many.
   * Everywhere else the statement stands on its own.
   */
  showHeadline?: boolean;
}

/**
 * The bar, read against the pass safe line.
 *
 * Ink above the line and pending orange below it, the same pair Today and a
 * mock's results use, so one topic looks the same on every screen it is on. It
 * was correct green above, which read as "right" rather than "on track". The
 * line is drawn on the track (handoff), so how far from it is a distance.
 */
function Bar({ pct, pending }: { pct: number; pending: boolean }) {
  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full ${
        pending ? 'bg-pending-soft' : 'bg-surface-2'
      }`}
      aria-hidden="true"
    >
      <div
        className={`h-full rounded-full ${pending ? 'bg-pending' : 'bg-ink'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
      <span className="bg-ink-3 absolute inset-y-0 w-0.5" style={{ left: `${PASS_SAFE_PCT}%` }} />
    </div>
  );
}

export function ReadinessStatement({
  statement,
  derivation,
  practiceNext,
  showHeadline = true,
}: ReadinessStatementProps) {
  const c = copy();

  const { rows, elided, headlinePct } = statement;
  const listedCount = rows.length + (elided ? 1 : 0);
  const below = rows.filter((row) => row.scorePct < PASS_SAFE_PCT).length;

  return (
    <section className="border-border bg-surface rounded-card flex flex-col gap-5 border p-6">
      {showHeadline ? (
        <StatedFigure
          label={c.progress.readiness}
          value={`${headlinePct}%`}
          derivation={derivation ?? c.progress.weightedMeanOf(listedCount)}
        />
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[18px] font-bold">{c.progress.byTopicTitle}</h2>
        <span className="text-ink-3 text-[12px] font-semibold">
          {c.progress.byTopicLine(PASS_SAFE_PCT)} · {c.progress.belowLine(below)}
        </span>
      </div>

      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const pending = row.scorePct < PASS_SAFE_PCT;
          return (
            <li
              key={row.topic}
              data-topic={row.topic}
              data-pending={pending ? 'yes' : 'no'}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="text-ink min-w-0 truncate text-[15px] font-semibold"
                  title={row.topic}
                >
                  {row.topic}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {pending && (
                    <Chip tone="pending" data-focus-chip="">
                      {c.progress.focus}
                    </Chip>
                  )}
                  <span
                    className={`num text-[14px] font-bold ${pending ? 'text-pending' : 'text-ink'}`}
                  >
                    {row.scorePct}%
                  </span>
                </span>
              </div>
              <Bar pct={row.scorePct} pending={pending} />
              {/* The share of past papers, never "% of exam" (D5), and what the
                  score rests on: a 100% from one answer is not one from forty. */}
              <span className="text-ink-3 text-[12px]" data-topic-evidence="">
                {c.progress.shareOf(row.weightPct)}
                {row.answered !== undefined ? ` · ${c.progress.fromAnswers(row.answered)}` : ''}
                {row.answered !== undefined && row.answered < 3
                  ? ` · ${c.progress.thinEvidence}`
                  : ''}
              </span>
            </li>
          );
        })}

        {elided && (
          <li data-elided="" className="border-border flex flex-col gap-1 border-t pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-2 text-[15px] font-semibold">{elidedLabel(elided)}</span>
              <span className="text-ink-3 text-[13px]">{c.progress.untried}</span>
            </div>
            <span className="text-ink-3 num text-[12px]">
              {c.progress.shareOf(elided.weightPct)}
            </span>
          </li>
        )}
      </ul>

      <PracticeCta
        topicId={practiceNext?.topicId ?? null}
        topicName={practiceNext?.topicName ?? null}
      />
    </section>
  );
}
