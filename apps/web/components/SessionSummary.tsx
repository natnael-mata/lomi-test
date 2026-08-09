/**
 * How today's practice went (T-118).
 *
 * A study order, not a scoreboard. The headline is what was answered and how
 * much was right; the list is ordered weakest first, so the thing to do next is
 * at the top rather than buried under what already went well.
 */
import { Card } from './Card';
import { Chip } from './Chip';
import { PracticeCta } from './PracticeCta';
import { StatedFigure } from './StatedFigure';
import { PASS_SAFE_PCT } from './readiness';
import { copy } from '../lib/i18n';

export interface SessionSummaryData {
  answered: number;
  correct: number;
  scorePct: number;
  topics: {
    topicId: string;
    topic: string;
    answered: number;
    correct: number;
    scorePct: number;
    weightPct: number | null;
  }[];
  weakestTopic: string | null;
  /** Its id, so the CTA can target it (T-139). */
  weakestTopicId: string | null;
}

export function SessionSummary({ summary }: { summary: SessionSummaryData }) {
  const c = copy();

  if (summary.answered === 0) {
    return (
      <Card data-summary="empty">
        <h2 className="text-title">{c.summary.nothingAnswered}</h2>
        <p className="text-body text-ink-2 mt-2">{c.summary.answerToStart}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-summary="">
      {/* A proportion of questions answered, not a total that sums — so the
          stated treatment, never a total bar (T-096). */}
      <StatedFigure
        label={c.summary.today}
        value={`${summary.correct} / ${summary.answered}`}
        derivation={`${summary.scorePct}% across ${summary.topics.length} topic${
          summary.topics.length === 1 ? '' : 's'
        }`}
      />

      <ul className="flex flex-col gap-2">
        {summary.topics.map((topic) => {
          const pending = topic.scorePct < PASS_SAFE_PCT;
          return (
            <li
              key={topic.topic}
              data-topic={topic.topic}
              data-pending={pending ? 'yes' : 'no'}
              className="bg-surface rounded-card flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="text-label truncate">{topic.topic}</p>
                {topic.weightPct !== null && (
                  <p className="text-caption text-ink-2">
                    {c.summary.shareOfPastPapers(topic.weightPct)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-label num">
                  {topic.correct}/{topic.answered}
                </span>
                {topic.topic === summary.weakestTopic && (
                  <Chip tone="pending" data-next="">
                    {c.summary.practiseNext}
                  </Chip>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* T-139: the summary ends in the action it implies. */}
      <PracticeCta topicId={summary.weakestTopicId} topicName={summary.weakestTopic} />
    </div>
  );
}
