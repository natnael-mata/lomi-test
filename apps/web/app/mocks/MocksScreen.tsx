'use client';

/**
 * Mocks: the next paper, and the ones already sat (redesign handoff, § Mocks).
 *
 * A dark "Next up" card that starts a paper, or goes back to the open one, and
 * under it every past paper with its score and a way into its results. It
 * replaced a redirect to `/exam`, whose own idle card was the only way in.
 *
 * **Starting is the simulator's job, not this screen's.** The button goes to
 * `/exam?start=1`, and `ExamScreen` does what it always did: replays any
 * answers queued offline, settles an expired paper, resumes at the right
 * question. Starting here as well would be a second copy of that, and the
 * first place the two would disagree is the student who lost signal mid paper.
 *
 * Every figure is read: the paper's shape from the preview, the past papers
 * from the trend. The next paper's number is the count of papers sat plus one,
 * the same ordinal the trend labels them with.
 */
import { useEffect, useState } from 'react';

import { Icon } from '../../components/icons';
import { api, signInRequired, type ExamPreview, type TrendPoint } from '../../lib/api';
import { day } from '../../lib/dates';
import { PASS_MARK_PCT } from '../../lib/pass-mark';
import { copy } from '../../lib/i18n';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; preview: ExamPreview | null; past: TrendPoint[] }
  | { kind: 'error' };

/**
 * Past papers listed at once. A student who sits a mock a day has sixty by the
 * exam, and sixty rows is a page nobody scrolls to the bottom of.
 */
const PAGE = 10;

export function MocksScreen() {
  const c = copy();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const fields = await api.myFields();
        const field = fields.find((f) => f.chosen);
        if (!field) {
          // Nothing here can work without a programme; the chooser is where
          // every other screen sends them too.
          window.location.assign('/choose');
          return;
        }
        // Settled separately: a failed preview must not hide the past papers,
        // and a failed trend must not hide the button.
        const [preview, trend] = await Promise.allSettled([api.examPreview(), api.trend(field.id)]);
        if (!live) return;
        if (preview.status === 'rejected' && trend.status === 'rejected') {
          setState({ kind: 'error' });
          return;
        }
        setState({
          kind: 'ready',
          preview: preview.status === 'fulfilled' ? preview.value : null,
          past: trend.status === 'fulfilled' ? trend.value : [],
        });
      } catch (e) {
        if (signInRequired(e)) {
          window.location.assign('/signin');
          return;
        }
        if (live) setState({ kind: 'error' });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.exam.preparing}</p>;
  }
  if (state.kind === 'error') {
    return <p className="text-body">{c.mocks.couldNotLoad}</p>;
  }

  const { preview, past } = state;
  const minutes = preview ? Math.round(preview.durationSec / 60) : null;
  const open = preview?.open ?? null;
  const nextNumber = past.length + 1;
  // Newest first: the paper a student just sat is the one they came to read.
  const newestFirst = [...past].reverse();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[clamp(26px,3vw,32px)] leading-[1.2] font-extrabold tracking-[-0.025em]">
          {c.mocks.title}
        </h1>
        {preview && minutes !== null ? (
          <p className="text-ink-2 text-[15px]">
            {c.mocks.shape(preview.totalQuestions, minutes)}
            {PASS_MARK_PCT !== null ? ` · ${c.mocks.passMark(PASS_MARK_PCT)}` : ''}
          </p>
        ) : null}
      </header>

      {/*
        Next up, on the dark surface.

        The one primary action on the screen. An open paper takes it over
        entirely: starting a second while one is running is not something the
        API allows, and offering it would be a button that only explains itself
        after it is pressed.
      */}
      {preview ? (
        <section className="bg-ink-deep on-deep text-on-deep rounded-card flex flex-wrap items-center gap-x-8 gap-y-5 p-[clamp(20px,3vw,32px)]">
          <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
            <span className="text-caption text-brand uppercase">{c.mocks.nextUp}</span>
            <span className="font-display text-[28px] leading-[34px] font-extrabold">
              {open ? c.mocks.openTitle : c.mocks.nextMock(nextNumber)}
            </span>
            <span className="text-on-deep-2 text-[15px] leading-[23px]">
              {open
                ? c.exam.resumeBody(open.answeredCount, preview.totalQuestions)
                : c.mocks.setAside(minutes ?? 0)}
            </span>
          </div>
          <a
            href="/exam?start=1"
            className="bg-brand hover:bg-brand-hover text-on-brand rounded-control inline-flex min-h-[52px] items-center px-7 text-[16px] font-semibold"
          >
            {open ? c.exam.resume(open.position) : c.mocks.start(nextNumber)}
          </a>
        </section>
      ) : null}

      <section className="border-border bg-surface rounded-card overflow-hidden border">
        <h2 className="border-border font-display border-b px-6 py-4 text-[18px] font-bold">
          {c.mocks.pastTitle}
        </h2>
        {newestFirst.length === 0 ? (
          <p className="text-ink-2 px-6 py-5 text-[15px]">{c.mocks.noneYet}</p>
        ) : (
          <ul>
            {newestFirst.slice(0, shown).map((paper) => (
              <li key={paper.sittingId} className="border-border border-b last:border-b-0">
                {/* The whole row is the link: a 56px target, and the place a
                    thumb lands is anywhere on it. */}
                <a
                  href={`/exam/review/${paper.sittingId}`}
                  className="hover:bg-bg flex min-h-[56px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4"
                >
                  <span className="flex min-w-[9rem] flex-col sm:w-44 sm:shrink-0">
                    <span className="text-ink text-[15px] font-semibold">{paper.label}</span>
                    <span className="text-ink-3 text-[13px]">
                      {c.mocks.pastMeta(day(paper.closedAt ?? paper.startedAt), paper.minutesUsed)}
                    </span>
                  </span>
                  <span className="flex flex-1 items-center gap-3">
                    <span className="bg-surface-2 h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full">
                      <span
                        className="bg-brand block h-full rounded-full"
                        style={{ width: `${Math.min(100, paper.scorePct)}%` }}
                      />
                    </span>
                    <span className="font-display num w-14 text-right text-[18px] font-extrabold">
                      {paper.scorePct}%
                    </span>
                  </span>
                  <span className="text-link inline-flex items-center gap-1 text-[14px] font-semibold">
                    {c.mocks.review}
                    <Icon name="chevronRight" size={16} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {newestFirst.length > shown ? (
          <div className="border-border border-t p-4">
            <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + PAGE)}>
              {c.exam.showMore(Math.min(newestFirst.length - shown, PAGE))}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
