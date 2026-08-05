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

export interface ReadinessStatementProps {
  statement: Statement;
  /** How the headline was derived, for the stated figure's chip. */
  derivation?: string | undefined;
  /**
   * The topic to practise next (T-139). DESIGN.md: "Every statement ends in a
   * practice action" — a screen that diagnoses a student and stops has done
   * half the job.
   */
  practiceNext?: { topicId: string; topicName: string } | null;
}

function Bar({ pct, pending }: { pct: number; pending: boolean }) {
  return (
    <div className="bg-surface-2 h-2 w-full overflow-hidden rounded-full" aria-hidden="true">
      <div
        className={`h-full rounded-full ${pending ? 'bg-pending' : 'bg-correct'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function ReadinessStatement({
  statement,
  derivation,
  practiceNext,
}: ReadinessStatementProps) {
  const { rows, elided, headlinePct } = statement;
  const listedCount = rows.length + (elided ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <StatedFigure
        label="Readiness"
        value={`${headlinePct}%`}
        derivation={derivation ?? `weighted mean of ${listedCount} topic groups`}
      />

      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const pending = row.scorePct < PASS_SAFE_PCT;
          return (
            <li key={row.topic} data-topic={row.topic} data-pending={pending ? 'yes' : 'no'}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label">{row.topic}</span>
                <span className="text-label num">{row.scorePct}%</span>
              </div>
              <div className="mt-1.5">
                <Bar pct={row.scorePct} pending={pending} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {/* T-097a: never "% of exam". */}
                <span className="text-caption text-ink-2">
                  {row.weightPct}% share of past papers
                </span>
                {pending && (
                  <Chip tone="pending" data-focus-chip="">
                    Focus
                  </Chip>
                )}
              </div>
            </li>
          );
        })}

        {elided && (
          <li data-elided="" className="border-border border-t pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label text-ink-2">{elidedLabel(elided)}</span>
              <span className="text-caption text-ink-2 num">
                {elided.weightPct}% share of past papers
              </span>
            </div>
          </li>
        )}
      </ul>

      <PracticeCta
        topicId={practiceNext?.topicId ?? null}
        topicName={practiceNext?.topicName ?? null}
      />
    </div>
  );
}
