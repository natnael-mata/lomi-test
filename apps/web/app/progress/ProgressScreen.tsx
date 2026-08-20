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
import {
  api,
  refusalMessage,
  signInRequired,
  type Readiness,
  type TrendPoint,
} from '../../lib/api';
import { copy } from '../../lib/i18n';

export function ProgressScreen() {
  const c = copy();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fields = await api.myFields();
        // The student's own programme, not whichever sorts first. Reading
        // `fields[0]` showed a Public Health student Accounting & Finance's
        // readiness — "Nothing answered yet" over a screen full of their
        // answers.
        const fieldId = fields.find((f) => f.chosen)?.id;
        if (!fieldId) {
          if (!cancelled) setError(c.progress.chooseProgramme);
          return;
        }
        const [r, t] = await Promise.all([api.readiness(fieldId), api.trend(fieldId)]);
        if (cancelled) return;
        setReadiness(r);
        setTrend(t);
      } catch (e) {
        if (signInRequired(e)) {
          window.location.assign('/signin');
          return;
        }
        if (!cancelled) setError(refusalMessage(e) ?? c.progress.couldNotLoad);
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
        {c.progress.working}
      </p>
    );
  }

  // A student who has answered nothing gets the honest version: no figure, and
  // the action that would produce one. Inventing a 0% here would be a score.
  if (readiness.headlinePct === null) {
    return (
      <div className="flex flex-col gap-4" data-state="unassessed">
        <h1 className="text-title">{c.progress.title}</h1>
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
          answered is a pacing fact, not a knowledge one.

          It used to say the questions "ran out of time", which is a cause the
          figure does not know. The field is `unansweredInMocks` — it counts
          blanks, and a blank is as easily a paper submitted early as a deadline
          reached. QA submitted with eighteen to spare and was told they had run
          out of time. It reports what it counted. */}
      {readiness.unansweredInMocks > 0 && (
        <p className="text-caption text-ink-2" data-unanswered-note="">
          {c.progress.unansweredInMocks(readiness.unansweredInMocks)}
        </p>
      )}

      {/*
        How much each score rests on.
        A topic can read 100% off a single mock question, and one more answer
        can move the headline twenty points — QA watched exactly that and asked,
        reasonably, where the caveat was. Every figure on this screen is
        checkable except this one, because the count behind it was never shown.
        It always existed on the row; it was simply not rendered.
      */}
      {scored.length > 0 && (
        <section className="flex flex-col gap-2" data-evidence="">
          <h2 className="text-label">{c.progress.evidenceTitle}</h2>
          <ul className="flex flex-col gap-1.5">
            {scored.map((t) => (
              <li
                key={t.topicId}
                data-topic-evidence=""
                className="text-caption text-ink-2 flex flex-wrap items-baseline justify-between gap-2"
              >
                <span className="text-ink">{t.topicName}</span>
                <span className="num">
                  {c.progress.fromAnswers(t.scorePct!, t.answered)}
                  {t.answered < 3 ? ` · ${c.progress.thinEvidence}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-title">{c.progress.mockScores}</h2>
        <StatedFigure
          label={c.progress.mocksSat}
          value={String(trend.length)}
          derivation={
            trend.length === 0
              ? c.progress.noneYet
              : c.progress.mostRecent(trend[trend.length - 1]!.scorePct)
          }
        />
        <ScoreTrend points={trend} />
      </section>
    </div>
  );
}
