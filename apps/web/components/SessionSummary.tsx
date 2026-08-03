/**
 * How today's practice went (T-118).
 *
 * A study order, not a scoreboard. The headline is what was answered and how
 * much was right; the list is ordered weakest first, so the thing to do next is
 * at the top rather than buried under what already went well.
 */
import { Card } from './Card';
import { Chip } from './Chip';
import { StatedFigure } from './StatedFigure';
import { PASS_SAFE_PCT } from './readiness';

export interface SessionSummaryData {
  answered: number;
  correct: number;
  scorePct: number;
  topics: {
    topic: string;
    answered: number;
    correct: number;
    scorePct: number;
    weightPct: number | null;
  }[];
  weakestTopic: string | null;
}

export function SessionSummary({ summary }: { summary: SessionSummaryData }) {
  if (summary.answered === 0) {
    return (
      <Card data-summary="empty">
        <h2 className="text-title">Nothing answered yet</h2>
        <p className="text-body text-ink-2 mt-2">Answer a question and the summary starts here.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-summary="">
      {/* A proportion of questions answered, not a total that sums — so the
          stated treatment, never a total bar (T-096). */}
      <StatedFigure
        label="Today"
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
                  <p className="text-caption text-ink-2">{topic.weightPct}% share of past papers</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-label num">
                  {topic.correct}/{topic.answered}
                </span>
                {topic.topic === summary.weakestTopic && (
                  <Chip tone="pending" data-next="">
                    Practise next
                  </Chip>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
