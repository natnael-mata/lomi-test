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
  type CoverageView,
  api,
  refusalMessage,
  signInRequired,
  type Readiness,
  type TrendPoint,
} from '../../lib/api';
import { CoveragePanel } from '../../components/CoveragePanel';
import { SittingHistory } from '../../components/SittingHistory';
import { copy } from '../../lib/i18n';

export function ProgressScreen() {
  const c = copy();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** No programme chosen yet — fixable, so it gets a door rather than an error. */
  const [noProgramme, setNoProgramme] = useState(false);
  /**
   * Coverage, the headline (T-256).
   *
   * Fetched beside readiness rather than replacing it: readiness answers "how
   * am I doing on what I have tried" and coverage answers "how much of the exam
   * have I got", and a student wants both. Null while it loads, and null for
   * good if the programme cannot report it — the panel is then simply absent,
   * which is the honest rendering of a figure that does not exist.
   */
  const [coverage, setCoverage] = useState<CoverageView | null>(null);

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
          // Flagged as fixable rather than as a failure — this one has a door.
          if (!cancelled) setNoProgramme(true);
          return;
        }
        const [r, t, cov] = await Promise.all([
          api.readiness(fieldId),
          api.trend(fieldId),
          // Never fatal: progress that refuses to render because one panel could
          // not load is worse than progress with one panel missing.
          api.coverage(fieldId).catch(() => null),
        ]);
        if (cancelled) return;
        setReadiness(r);
        setTrend(t);
        setCoverage(cov);
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

  /*
   * A condition the student can fix, with the control that fixes it.
   *
   * This shared the error card, so "Choose a programme to see your progress."
   * appeared with nothing to press — the same dead end QA found on `/practice`'s
   * refusal. Telling somebody to do a thing the screen gives them no way to do
   * is worse than saying nothing.
   */
  if (noProgramme) {
    return (
      <Card data-state="no-programme" className="flex flex-col gap-4">
        <p className="text-body">{c.progress.chooseProgramme}</p>
        <a className="btn-primary" href="/choose">
          {c.progress.chooseFirst}
        </a>
      </Card>
    );
  }

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

      {/* Above readiness, because it is the headline. Of the exam you are
          sitting, how much have you actually got. */}
      {coverage && (
        <CoveragePanel coverage={coverage} answered={readiness?.totalAnswered ?? null} />
      )}

      {/*
       * Two columns from `lg`, one below it (DESIGN.md § Layout, the data measure).
       *
       * The left is the claim and what it rests on — the readiness statement and
       * the per-topic evidence, which are read together or not at all. The right
       * is a different measurement: how the mocks have gone over time.
       *
       * They used to be four full-width blocks in one stack, which at 640px ran
       * 1254px tall on a 900px screen. `items-start` so the trend does not
       * stretch to the height of the statement beside it.
       */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
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
                      // Named, not just counted. These are the topics with no
                      // answers on them — see `ElidedRow.topics`.
                      topics: readiness.topics
                        .filter((t) => t.scorePct === null)
                        .map((t) => t.topicName),
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

          {/*
            The two big percentages, told apart.

            Coverage and readiness answer different questions and can differ
            wildly — a student who has tried seven questions and got them all
            right reads 41% coverage and 100% readiness on one screen. Both are
            true, and side by side with nothing between them they look like a
            product that cannot count. Only shown where coverage is on screen to
            be confused with.
          */}
          {coverage && <p className="text-caption text-ink-2">{c.progress.readinessVsCoverage}</p>}

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
        </div>

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

      {/* Every paper kept and readable, below the trend that summarises them
          (T-258). The trend says whether it is going up; this says what
          happened in each one, which is the part you can act on. */}
      {trend.length > 0 && <SittingHistory points={trend} />}
    </div>
  );
}
