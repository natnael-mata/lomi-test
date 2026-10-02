'use client';

/**
 * Choosing a programme (PLAN.md § 4.1).
 *
 * *"On first sign-in the student picks their Field / Department, which scopes
 * all their questions."*
 *
 * **This was specified, enforced by the API, and never built.** `PUT /me/field`
 * has existed for weeks and `FIELD_REQUIRED` is returned by practice, exams and
 * the community — so a signed-in student hit a wall with no way past it. This is
 * the screen that was missing.
 *
 * It also asks the retaker question, because `TASK.md` T-166 calls the programme
 * choice *"the only onboarding question the product asks now that sign-in is a
 * deep link with no form behind it"*. Asking it anywhere else would mean
 * inventing a second onboarding step for one boolean.
 */
import { useCallback, useEffect, useState } from 'react';

import { Chip } from '../../components/Chip';
import { Icon } from '../../components/icons';
import { day } from '../../lib/dates';
import { ApiError, api, type FieldOption } from '../../lib/api';
import { copy } from '../../lib/i18n';

/*
 * The shared type, not a local copy of it.
 *
 * This declared its own `Field` with the same four fields, which is the drift
 * `contracts.test.ts` exists to catch — except that guard watches the exported
 * `FieldOption` in `lib/api.ts` and could not see a private duplicate. Adding
 * `questionCount` to the real one left this screen quietly reading a type that
 * no longer described what the server sends.
 */
type Field = FieldOption;

type Phase =
  { kind: 'loading' } | { kind: 'ready'; fields: Field[] } | { kind: 'error'; message: string };

export function ChooseProgrammeScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [chosen, setChosen] = useState<string | null>(null);
  /**
   * Null until answered, and it stays null if they never do.
   *
   * `TASK.md` T-166: null means nobody asked, which is not the same as "no".
   * Defaulting to false here would put a wrong number in a report later.
   */
  const [retaker, setRetaker] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const fields = await api.myFields();
        if (!live) return;
        setPhase({ kind: 'ready', fields });
        // Pre-selected when they already have one, because this screen is also
        // how a programme is *changed* — and a change screen that opens with
        // nothing selected does not say what it is changing from.
        setChosen(fields.find((f) => f.chosen)?.id ?? null);
      } catch {
        if (live) setPhase({ kind: 'error', message: c.choose.couldNotLoad });
      }
    })();
    return () => {
      live = false;
    };
  }, [c.choose.couldNotLoad]);

  const save = useCallback(async (): Promise<void> => {
    if (!chosen) return;
    setSaving(true);
    try {
      // Never sent for a school track, where the question is not asked — an
      // unanswered question must stay unanswered rather than becoming a false.
      const schoolTrack =
        phase.kind === 'ready' &&
        phase.fields.find((field) => field.id === chosen)?.maxGrade != null;
      await api.chooseField(chosen, schoolTrack ? undefined : (retaker ?? undefined));
      // Straight to practice: the student came here to start, not to land on a
      // confirmation screen.
      window.location.assign('/practice');
    } catch (error) {
      setPhase({
        kind: 'error',
        message: error instanceof ApiError ? error.message : c.choose.couldNotSave,
      });
    } finally {
      setSaving(false);
    }
  }, [c.choose.couldNotSave, chosen, retaker, phase]);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.choose.working}</p>;
  }
  if (phase.kind === 'error') {
    return <p className="text-body">{phase.message}</p>;
  }

  /**
   * Whether the selected programme is a school year rather than an exit exam.
   *
   * `maxGrade` is non-null exactly for the school tracks — the same test the
   * pricing and the leaderboard bands turn on, rather than a fourth way of
   * asking the question.
   */
  const isSchoolTrack = phase.fields.find((field) => field.id === chosen)?.maxGrade != null;

  /** The sitting this programme counts down to, once one is picked. */
  const selected = phase.fields.find((field) => field.id === chosen) ?? null;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-3 uppercase">{c.choose.setUp}</span>
        <h1 className="font-display text-[clamp(26px,4vw,32px)] leading-[1.15] font-extrabold tracking-[-0.025em]">
          {c.choose.title}
        </h1>
        {/* Says it is reversible, because a first-run choice that looks
            permanent is one people stall on. */}
        <p className="text-ink-2 text-[15px] leading-[1.55]">{c.choose.intro}</p>
      </header>

      {phase.fields.length === 0 ? (
        <p className="text-body text-ink-2">{c.choose.none}</p>
      ) : (
        /*
          A grid of cards, not a stack of radio rows (handoff § Onboarding).

          The handoff draws the programmes as a two-up grid of pressable tiles
          with the question count under each name, which is the right shape for
          a set of eight peers: a vertical list of eight asks somebody to read
          down it, and a grid asks them to look.

          Still real radios underneath. The input is `sr-only` rather than
          removed, so the group is one tab stop, arrow keys move within it, and
          a screen reader hears a radio group — none of which a row of buttons
          gives you for free, and all of which the previous list had.
        */
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="text-ink mb-1 text-[14px] font-semibold">
            {c.choose.fieldLegend}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {phase.fields.map((field) => {
              /*
               * Listed, and honest about whether it can be sat.
               *
               * `isPublished` says we mean to offer a subject; it does not say
               * there is anything in it. Three programmes were published and
               * empty, and choosing one put a student behind the field gate with
               * every screen working and nothing to show — practice reported
               * "nothing left to practise today" about a bank that had never held
               * a question.
               *
               * Shown rather than hidden: a student whose subject is listed but
               * unfinished has learned something true. Dropping it from the list
               * would say we do not cover their exam at all.
               */
              const ready = field.questionCount > 0;
              const picked = field.id === chosen;
              return (
                <label
                  key={field.id}
                  className={[
                    'rounded-card flex min-h-[72px] cursor-pointer flex-col justify-center gap-1 border p-4',
                    'transition-[background-color,border-color]',
                    picked
                      ? 'border-link bg-brand-soft border-2'
                      : 'border-border bg-surface hover:border-border-strong',
                    ready ? '' : 'cursor-not-allowed opacity-60',
                  ].join(' ')}
                  data-selected={picked}
                  data-ready={ready}
                >
                  <input
                    type="radio"
                    name="field"
                    className="sr-only"
                    value={field.id}
                    checked={picked}
                    disabled={!ready}
                    onChange={() => setChosen(field.id)}
                  />
                  <span className="text-ink text-[16px] font-semibold">{field.name}</span>
                  <span className="text-ink-2 flex items-center gap-2 text-[13px]">
                    {ready ? (
                      <span className="num">
                        {c.choose.questionsAvailable(field.questionCount)}
                      </span>
                    ) : (
                      <Chip tone="pending">{c.choose.notReady}</Chip>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {/* The "being written" programmes explain themselves once, under the
              grid, rather than repeating the same sentence inside every empty
              tile. */}
          {phase.fields.some((field) => field.questionCount === 0) ? (
            <p className="text-ink-3 text-[13px]">{c.choose.notReadyWhy}</p>
          ) : null}
        </fieldset>
      )}

      {/*
        Only asked of somebody it could apply to (T-268).

        "Have you sat the exit exam before?" was on the screen whatever was
        selected, including Grade 6 and Grade 8 — where there is no exit exam to
        have sat, and the question reads as either a mistake or a demand for
        information about somebody else. `maxGrade` is non-null exactly for the
        school tracks, which is the same test the pricing and the leaderboard
        bands use.

        Nothing is sent for a school track, so `isRetaker` stays unset rather
        than being recorded as a false everybody was never asked about.
      */}
      {isSchoolTrack ? null : (
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="text-ink mb-1 text-[14px] font-semibold">
            {c.choose.retakerQuestion}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { value: false, label: c.choose.retakerNo },
              { value: true, label: c.choose.retakerYes },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={[
                  'rounded-card flex min-h-[56px] cursor-pointer items-center gap-3 border p-4',
                  retaker === option.value
                    ? 'border-link bg-brand-soft border-2'
                    : 'border-border bg-surface hover:border-border-strong',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="retaker"
                  className="sr-only"
                  checked={retaker === option.value}
                  onChange={() => setRetaker(option.value)}
                />
                <span className="text-ink text-[15px] font-semibold">{option.label}</span>
              </label>
            ))}
          </div>
          {/* Why it is asked, since it changes nothing they can see. A question
              with no visible consequence reads as data collection unless the
              reason is given. */}
          <p className="text-ink-3 text-[13px]">{c.choose.retakerWhy}</p>
        </fieldset>
      )}

      {/*
        The sitting date, and only when there is one.

        The handoff prints "Exam day: Thursday, November 12. That's 43 days, so
        your plan covers every topic at least twice" as settled fact. Both halves
        are assumptions: most programmes here have no `examDate` set, and the
        plan does not exist until this screen is saved. So the date is read from
        the field the student actually picked, the coverage claim is dropped, and
        a programme with no date says so — naming it as ours to fix rather than
        leaving a blank where a countdown should be.
      */}
      {selected ? (
        <div className="border-border bg-surface rounded-card text-ink-2 flex items-start gap-3 border p-4 text-[14px] leading-[1.55]">
          <span className="text-ink-3 shrink-0 pt-0.5">
            <Icon name="calendar" size={20} />
          </span>
          {selected.examDate ? (
            <span>
              <span className="text-ink font-semibold">
                {c.choose.examDayLabel}: {day(selected.examDate)}.
              </span>{' '}
              {c.choose.examDayIn(daysUntil(selected.examDate))}
            </span>
          ) : (
            <span>{c.choose.examDayUnset}</span>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="btn-primary"
        onClick={() => void save()}
        disabled={!chosen || saving}
      >
        {saving ? c.choose.saving : c.choose.confirm}
      </button>
    </div>
  );
}

/**
 * Whole days from today to a sitting, counted in the browser's own zone.
 *
 * Both sides floored to midnight first. Subtracting the raw instants makes "in
 * 43 days" flip to 42 at whatever hour of the afternoon the student opens the
 * app, which is a countdown that disagrees with itself between two taps.
 */
function daysUntil(iso: string): number {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  return Math.round((midnight(new Date(iso)) - midnight(new Date())) / DAY);
}
