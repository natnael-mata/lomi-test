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

import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.choose.title}</h1>
        {/* Says it is reversible, because a first-run choice that looks
            permanent is one people stall on. */}
        <p className="text-body text-ink-2">{c.choose.intro}</p>
      </header>

      {phase.fields.length === 0 ? (
        <p className="text-body text-ink-2">{c.choose.none}</p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{c.choose.title}</legend>
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
            return (
              <label
                key={field.id}
                className={[
                  'rounded-card flex min-h-[56px] items-center gap-3 p-4',
                  ready ? 'bg-surface-2' : 'bg-surface-2 opacity-60',
                ].join(' ')}
                data-selected={field.id === chosen}
                data-ready={ready}
              >
                <input
                  type="radio"
                  name="field"
                  value={field.id}
                  checked={field.id === chosen}
                  disabled={!ready}
                  onChange={() => setChosen(field.id)}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body">{field.name}</span>
                  <span className="text-caption text-ink-2">
                    {ready
                      ? c.choose.questionsAvailable(field.questionCount)
                      : c.choose.notReadyWhy}
                  </span>
                </span>
                {!ready && <Chip tone="pending">{c.choose.notReady}</Chip>}
              </label>
            );
          })}
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
      <Card as="section" className="flex flex-col gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.choose.retakerQuestion}</h2>
        <div className="flex flex-col gap-2">
          {[
            { value: false, label: c.choose.retakerNo },
            { value: true, label: c.choose.retakerYes },
          ].map((option) => (
            <label
              key={String(option.value)}
              className="bg-surface-2 rounded-card flex min-h-[52px] items-center gap-3 p-3"
            >
              <input
                type="radio"
                name="retaker"
                checked={retaker === option.value}
                onChange={() => setRetaker(option.value)}
              />
              <span className="text-body">{option.label}</span>
            </label>
          ))}
        </div>
        {/* Why it is asked, since it changes nothing they can see. A question
            with no visible consequence reads as data collection unless the
            reason is given. */}
        <p className="text-caption text-ink-2">{c.choose.retakerWhy}</p>
      </Card>
      )}

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
