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
import { Card } from './Card';
import { Chip } from './Chip';
import { PracticeCta } from './PracticeCta';
import { StatedFigure } from './StatedFigure';

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

export function ExamSummary({ summary }: { summary: ExamSummaryData }) {
  if (summary.totalQuestions === 0) {
    return (
      <Card data-exam-summary="empty">
        <h2 className="text-title">Nothing to summarise</h2>
        <p className="text-body text-ink-2 mt-2">This paper had no questions on it.</p>
      </Card>
    );
  }

  const unanswered = summary.totalQuestions - summary.answeredCount;

  return (
    <div className="flex flex-col gap-4" data-exam-summary="">
      {/* A proportion of a paper, not a total that sums — so the stated figure
          treatment, never a total bar (T-096). */}
      <StatedFigure
        label="This mock"
        value={`${summary.scoreCorrect} / ${summary.totalQuestions}`}
        derivation={
          unanswered > 0
            ? `${summary.scorePct}% of the paper · ${unanswered} left unanswered`
            : `${summary.scorePct}% of the paper`
        }
      />

      <ul className="flex flex-col gap-2" data-topics="">
        {summary.topics.map((topic) => (
          <li
            key={topic.topic}
            data-topic={topic.topic}
            data-revise-next={topic.topic === summary.weakestTopic ? 'yes' : 'no'}
            className="bg-surface rounded-card flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <p className="text-label truncate">{topic.topic}</p>
              <p className="text-caption text-ink-2">
                {topic.weightPct === null
                  ? 'Share of past papers not worked out yet'
                  : `${topic.weightPct}% share of past papers`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-label num">
                {topic.correct}/{topic.asked}
              </span>
              {topic.topic === summary.weakestTopic && (
                <Chip tone="pending" data-next="">
                  Revise next
                </Chip>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Says why that topic and not the one with the most red marks. Without
          this the ranking looks wrong to anyone who counted their own misses. */}
      {summary.weakestTopic !== null && (
        <p className="text-caption text-ink-2" data-why-weakest="">
          Ranked by how many marks each topic cost — a topic's share of past papers against how much
          of it you missed, not the number of misses.
        </p>
      )}

      {/* T-139: the summary ends in the action it implies. */}
      <PracticeCta topicId={summary.weakestTopicId} topicName={summary.weakestTopic} />
    </div>
  );
}
