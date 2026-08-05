'use client';

/**
 * Readiness and the mock trend (T-135–T-139).
 *
 * Everything here is computed on the server and rendered as given. The client
 * deliberately does no arithmetic of its own: DESIGN.md requires the headline to
 * be reconstructible from the rows on screen, and two implementations of the
 * same weighted mean is how the headline and the rows start to disagree.
 */
import { useEffect, useState } from 'react';

import { Card } from '../../components/Card';
import { PracticeCta } from '../../components/PracticeCta';
import { ReadinessStatement } from '../../components/ReadinessStatement';
import { ScoreTrend } from '../../components/ScoreTrend';
import { StatedFigure } from '../../components/StatedFigure';
import { api, type Readiness, type TrendPoint } from '../../lib/api';

export function ProgressScreen() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fields = await api.myFields();
        const fieldId = fields[0]?.id;
        if (!fieldId) {
          if (!cancelled) setError('Choose a programme to see your progress.');
          return;
        }
        const [r, t] = await Promise.all([api.readiness(fieldId), api.trend(fieldId)]);
        if (cancelled) return;
        setReadiness(r);
        setTrend(t);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card data-state="error">
        <p className="text-body">{error}</p>
      </Card>
    );
  }

  if (!readiness) {
    return (
      <p data-state="loading" className="text-body text-ink-2 py-8 text-center">
        Working out where you are…
      </p>
    );
  }

  // A student who has answered nothing gets the honest version: no figure, and
  // the action that would produce one. Inventing a 0% here would be a score.
  if (readiness.headlinePct === null) {
    return (
      <div className="flex flex-col gap-4" data-state="unassessed">
        <h1 className="text-title">Progress</h1>
        <Card>
          <p className="text-body">
            Nothing answered yet, so there is no readiness figure to show. Answer a few questions
            and it starts here.
          </p>
        </Card>
        <PracticeCta topicId={null} topicName={null} />
      </div>
    );
  }

  const scored = readiness.topics.filter((t) => t.scorePct !== null);

  return (
    <div className="flex flex-col gap-6" data-state="ready">
      <h1 className="text-title">{readiness.fieldName}</h1>

      <ReadinessStatement
        statement={{
          rows: scored.map((t) => ({
            topic: t.topicName,
            scorePct: t.scorePct!,
            weightPct: t.weightPct,
          })),
          // The unassessed share, stated rather than hidden. A statement whose
          // weights visibly stop short of 100 is the one thing DESIGN.md forbids
          // leaving unexplained.
          elided:
            readiness.unassessedWeightPct > 0
              ? {
                  label: 'other topics',
                  weightPct: readiness.unassessedWeightPct,
                  topicCount: readiness.topics.length - scored.length,
                }
              : null,
          headlinePct: readiness.headlinePct,
          focus: readiness.focus.map((t) => ({
            topic: t.topicName,
            scorePct: t.scorePct ?? 0,
            weightPct: t.weightPct,
          })),
        }}
        derivation={`weighted mean across ${readiness.assessedWeightPct}% of past papers · ${readiness.totalAnswered} questions answered`}
        practiceNext={readiness.practiceNext}
      />

      {/* Said out loud rather than folded into a score: a question nobody
          reached is a pacing fact, not a knowledge one. */}
      {readiness.unansweredInMocks > 0 && (
        <p className="text-caption text-ink-2" data-unanswered-note="">
          {readiness.unansweredInMocks} mock question
          {readiness.unansweredInMocks === 1 ? '' : 's'} ran out of time and{' '}
          {readiness.unansweredInMocks === 1 ? 'is' : 'are'} not counted above.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-title">Mock scores</h2>
        <StatedFigure
          label="Mocks sat"
          value={String(trend.length)}
          derivation={
            trend.length === 0 ? 'none yet' : `most recent: ${trend[trend.length - 1]!.scorePct}%`
          }
        />
        <ScoreTrend points={trend} />
      </section>
    </div>
  );
}
