/**
 * How the mock went (T-130).
 *
 * A revision order, not a scoreboard — the same stance as the practice summary,
 * with a different rule behind it. Practice ranks by lowest score ("what am I
 * worst at"); a mock ranks by weight × miss rate ("where would another hour buy
 * me the most marks"). The two disagree often enough to matter: a topic answered
 * at 20% that is a fortieth of the paper is worth less than one answered at 60%
 * that is a third of it.
 *
 * The per-topic line says **share of past papers**, never "% of the exam". The
 * weights are computed from what has actually appeared; claiming they predict
 * this year's paper is a promise nobody can keep.
 */
import { Chip } from './Chip';
import { PracticeCta } from './PracticeCta';
import { PASS_SAFE_PCT } from './readiness';
import { StatedFigure } from './StatedFigure';
import { copy } from '../lib/i18n';

export interface ExamTopicRow {
  topicId: string;
  topic: string;
  asked: number;
  correct: number;
  scorePct: number;
  weightPct: number | null;
  weightedGapPct: number | null;
}

export interface ExamSummaryData {
  scoreCorrect: number;
  totalQuestions: number;
  scorePct: number;
  answeredCount: number;
  topics: ExamTopicRow[];
  weakestTopic: string | null;
  /** Its id, so the CTA can target it (T-139). */
  weakestTopicId: string | null;
}

export function ExamSummary({
  summary,
  showScore = true,
}: {
  summary: ExamSummaryData;
  /**
   * Whether this card states the score itself.
   *
   * The results page states it in its own dark card above (redesign, §
   * Results), and the same figure twice on one screen is one too many. Shown
   * everywhere else this summary stands on its own.
   */
  showScore?: boolean;
}) {
  const c = copy();

  if (summary.totalQuestions === 0) {
    return (
      <section
        data-exam-summary="empty"
        className="border-border bg-surface rounded-card flex flex-col gap-2 border p-6"
      >
        <h2 className="font-display text-[18px] font-bold">{c.summary.nothingToSummarise}</h2>
        <p className="text-body text-ink-2">{c.summary.noQuestions}</p>
      </section>
    );
  }

  const unanswered = summary.totalQuestions - summary.answeredCount;

  return (
    <section
      data-exam-summary=""
      className="border-border bg-surface rounded-card flex flex-col gap-5 border p-6"
    >
      {/* A proportion of a paper, not a total that sums: so the stated figure
          treatment, never a total bar (T-096). */}
      {showScore ? (
        <StatedFigure
          label={c.summary.thisMock}
          value={`${summary.scoreCorrect} / ${summary.totalQuestions}`}
          derivation={
            unanswered > 0
              ? c.summary.ofThePaperWithUnanswered(summary.scorePct, unanswered)
              : c.summary.ofThePaper(summary.scorePct)
          }
        />
      ) : null}

      <h2 className="font-display text-[18px] font-bold">{c.results.byTopic}</h2>

      <ul className="flex flex-col gap-4" data-topics="">
        {summary.topics.map((topic) => {
          const next = topic.topic === summary.weakestTopic;
          // Under the line, the same pending orange Today uses for a topic below
          // it: unfinished, not failed. The fraction beside the bar carries the
          // same fact in figures, so this is never colour alone.
          const low = topic.scorePct < PASS_SAFE_PCT;
          return (
            <li
              key={topic.topic}
              data-topic={topic.topic}
              data-revise-next={next ? 'yes' : 'no'}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="text-ink min-w-0 truncate text-[15px] font-semibold"
                  title={topic.topic}
                >
                  {topic.topic}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {next && (
                    <Chip tone="pending" data-next="">
                      {c.summary.reviseNext}
                    </Chip>
                  )}
                  <span
                    className={`num text-[14px] font-bold ${low ? 'text-pending' : 'text-ink'}`}
                  >
                    {topic.correct}/{topic.asked}
                  </span>
                </span>
              </div>
              <div
                className={`h-2 overflow-hidden rounded-full ${low ? 'bg-pending-soft' : 'bg-surface-2'}`}
              >
                <div
                  className={`h-full rounded-full ${low ? 'bg-pending' : 'bg-ink'}`}
                  style={{ width: `${Math.min(100, topic.scorePct)}%` }}
                />
              </div>
              <span className="text-ink-3 text-[12px]">
                {topic.weightPct === null
                  ? c.summary.shareNotWorkedOut
                  : c.summary.shareOfPastPapers(topic.weightPct)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Why this topic and not the one with the most misses: the ranking is
          weight times miss rate, and that is not the obvious reading. */}
      {summary.weakestTopic !== null && (
        <p className="text-caption text-ink-2" data-why-weakest="">
          {c.practice.whyRanked}
        </p>
      )}

      {/* Every analytics view ends in a practice action (T-139). */}
      <PracticeCta topicId={summary.weakestTopicId} topicName={summary.weakestTopic} />
    </section>
  );
}
