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
import { ApiError, api } from '../../lib/api';
import { copy } from '../../lib/i18n';

interface Field {
  id: string;
  name: string;
  slug: string;
}

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
        if (live) setPhase({ kind: 'ready', fields });
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
      await api.chooseField(chosen, retaker ?? undefined);
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
  }, [c.choose.couldNotSave, chosen, retaker]);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.choose.working}</p>;
  }
  if (phase.kind === 'error') {
    return <p className="text-body">{phase.message}</p>;
  }

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
          {phase.fields.map((field) => (
            <label
              key={field.id}
              className="bg-surface-2 rounded-card flex min-h-[56px] items-center gap-3 p-4"
              data-selected={field.id === chosen}
            >
              <input
                type="radio"
                name="field"
                value={field.id}
                checked={field.id === chosen}
                onChange={() => setChosen(field.id)}
              />
              <span className="text-body">{field.name}</span>
            </label>
          ))}
        </fieldset>
      )}

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
