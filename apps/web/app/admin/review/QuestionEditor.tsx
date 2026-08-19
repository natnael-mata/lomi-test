'use client';

/**
 * Writing the answer content the import could not carry (T-233).
 *
 * **This is the only path from an uploaded row to a published question.**
 * `review-patch.ts` says so in its own header: why-wrongs and the concept line
 * are deliberately absent from the import template, so `PATCH
 * /admin/review/:id` is the only way anything imported ever becomes
 * publishable. The route existed with no screen — so the queue could tell
 * somebody *"Option B: why it is wrong is missing"* and offer them nothing to
 * do about it but edit the spreadsheet and import again.
 *
 * Three decisions:
 *
 * - **The blockers are above the fields, and they update on save.** A reviewer
 *   filling in a why-wrong watches the reason disappear, rather than finding
 *   out whether they fixed it by pressing publish and reading a refusal.
 * - **Only the changed fields are sent.** The patch route leaves an omitted
 *   field alone and clears one sent as empty, so posting the whole form back
 *   every time would erase anything a colleague edited between the load and the
 *   save.
 * - **The correct answer is a radio, and choosing one clears the others** — on
 *   the server, in one write. Two correct options is a state the gate refuses
 *   and the database should never hold in between.
 */
import { useState } from 'react';

import { Icon } from '../../../components/icons';
import { api, ApiError, type ReviewItem, type ReviewPatch } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

export interface QuestionEditorProps {
  item: ReviewItem;
  /** Reloads the queue. The parent owns the data; this owns the form. */
  onSaved: () => Promise<void>;
}

export function QuestionEditor({ item, onSaved }: QuestionEditorProps) {
  const c = copy();
  const answer = item.answerView;
  const isCalculation = answer.qType === 'CALCULATION';

  /**
   * The form, seeded from the question and keyed by its id.
   *
   * `useState` initialisers run once per mount, and the parent remounts this on
   * every new item because the key changes — which is what stops a reviewer's
   * half-typed why-wrong from following them onto the next question.
   */
  const [correct, setCorrect] = useState<string>(answer.correctLabel ?? '');
  const [whyWrong, setWhyWrong] = useState<Record<string, string>>(() =>
    Object.fromEntries(answer.options.map((o) => [o.label, o.whyWrong ?? ''])),
  );
  const [conceptLine, setConceptLine] = useState(answer.conceptLine ?? '');
  const [explanation, setExplanation] = useState(answer.explanation ?? '');
  const [timeLimit, setTimeLimit] = useState(String(answer.timeLimitSec));
  const [steps, setSteps] = useState<{ text: string; formula: string }[]>(() =>
    answer.steps.map((s) => ({ text: s.text, formula: s.formula ?? '' })),
  );

  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  /**
   * Only what actually changed.
   *
   * The patch route treats an omitted field as "leave it" and an empty one as
   * "clear it", so sending the whole form back would overwrite anything edited
   * elsewhere since this loaded — and would clear every field a reviewer had
   * not filled in.
   */
  const buildPatch = (): ReviewPatch => {
    const patch: ReviewPatch = {};

    if (correct && correct !== (answer.correctLabel ?? '')) patch.correctOption = correct;

    const changedWhy: Record<string, string | null> = {};
    for (const option of answer.options) {
      const before = option.whyWrong ?? '';
      const now = whyWrong[option.label] ?? '';
      if (now.trim() !== before.trim()) changedWhy[option.label] = now.trim() === '' ? null : now;
    }
    if (Object.keys(changedWhy).length > 0) patch.whyWrong = changedWhy;

    if (conceptLine.trim() !== (answer.conceptLine ?? '').trim()) {
      patch.conceptLine = conceptLine.trim() === '' ? null : conceptLine;
    }
    if (explanation.trim() !== (answer.explanation ?? '').trim()) {
      patch.explanation = explanation.trim() === '' ? null : explanation;
    }

    const seconds = Number(timeLimit);
    if (Number.isInteger(seconds) && seconds !== answer.timeLimitSec) patch.timeLimitSec = seconds;

    const before = answer.steps.map((s) => `${s.text}|${s.formula ?? ''}`).join('\n');
    const now = steps.map((s) => `${s.text}|${s.formula}`).join('\n');
    if (now !== before) {
      // Numbered here rather than by the reviewer: `stepNo` is the order they
      // are in, and asking somebody to keep a column of integers in step with a
      // list they are reordering is asking for a gap in the working.
      patch.steps = steps
        .filter((s) => s.text.trim() !== '')
        .map((s, index) => ({
          stepNo: index + 1,
          text: s.text.trim(),
          formula: s.formula.trim() === '' ? null : s.formula.trim(),
        }));
    }

    return patch;
  };

  const save = async (): Promise<void> => {
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setProblems([c.admin.review.nothingChanged]);
      return;
    }

    setSaving(true);
    setProblems([]);
    setSaved(false);
    try {
      await api.reviewPatch(item.id, patch);
      setSaved(true);
      await onSaved();
    } catch (error) {
      // The route reports every reason at once, like the gate does. Showing one
      // sends somebody round the loop for each of the others.
      const reasons =
        error instanceof ApiError
          ? ((error.body as { reasons?: string[]; message?: string } | null)?.reasons ?? [])
          : [];
      setProblems(reasons.length > 0 ? reasons : [c.admin.review.couldNotSave]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* What is stopping it, above the fields that fix it. */}
      {item.blockers.length > 0 ? (
        <span className="bg-pending-soft rounded-control flex flex-col gap-1 p-3">
          <span className="text-pending text-caption inline-flex items-center gap-1.5 uppercase">
            <Icon name="clock" size={14} />
            {c.admin.review.notReady(item.blockers.length)}
          </span>
          <ul className="flex flex-col gap-0.5">
            {item.blockers.map((blocker) => (
              <li key={blocker} className="text-caption text-pending">
                {blocker}
              </li>
            ))}
          </ul>
        </span>
      ) : (
        <span className="bg-correct-soft text-correct rounded-control text-label inline-flex items-center gap-2 p-3">
          <Icon name="check" size={18} strokeWidth={2.5} />
          {c.admin.review.ready}
        </span>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption text-ink-2 uppercase">{c.admin.review.whichCorrect}</legend>
        {answer.options.map((option) => (
          <label
            key={option.label}
            className={[
              'rounded-control flex min-h-[56px] cursor-pointer items-start gap-3 p-3',
              option.label === correct ? 'bg-correct-soft' : 'bg-surface-2',
            ].join(' ')}
          >
            <input
              type="radio"
              name={`correct-${item.id}`}
              className="mt-1"
              checked={option.label === correct}
              onChange={() => setCorrect(option.label)}
            />
            <span className="flex flex-1 flex-col gap-2">
              <span className="text-body">
                <span className="font-semibold">{option.label}.</span> {option.text}
              </span>

              {/*
                The rationale, on every option that is not the chosen answer.
                It disappears from the correct one rather than being greyed out:
                a disabled field for something the gate does not want is a field
                somebody spends time wondering about.
              */}
              {option.label !== correct ? (
                <input
                  className="field"
                  value={whyWrong[option.label] ?? ''}
                  placeholder={c.admin.review.whyWrongPlaceholder}
                  aria-label={c.admin.review.whyWrongFor(option.label)}
                  onChange={(e) =>
                    setWhyWrong((prev) => ({ ...prev, [option.label]: e.target.value }))
                  }
                />
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-2 uppercase">{c.admin.review.conceptLine}</span>
        <input
          className="field"
          value={conceptLine}
          placeholder={c.admin.review.conceptPlaceholder}
          onChange={(e) => setConceptLine(e.target.value)}
        />
        {/* The gate refuses two sentences here, so the rule is stated where it
            is broken rather than reported after the fact. */}
        <span className="text-caption text-ink-2">{c.admin.review.conceptHint}</span>
      </label>

      {isCalculation ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-caption text-ink-2 uppercase">{c.admin.review.stepsLabel}</legend>
          {steps.map((step, index) => (
            <span key={index} className="bg-surface-2 rounded-control flex flex-col gap-2 p-3">
              <span className="flex items-center gap-2">
                <span className="option-key">{index + 1}</span>
                <input
                  className="field"
                  value={step.text}
                  placeholder={c.admin.review.stepPlaceholder}
                  aria-label={c.admin.review.stepNumber(index + 1)}
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, text: e.target.value } : s)),
                    )
                  }
                />
              </span>
              <input
                className="field font-mono"
                value={step.formula}
                placeholder={c.admin.review.formulaPlaceholder}
                aria-label={c.admin.review.formulaFor(index + 1)}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((s, i) => (i === index ? { ...s, formula: e.target.value } : s)),
                  )
                }
              />
              <button
                type="button"
                className="text-caption text-wrong self-start rounded-control inline-flex min-h-11 items-center px-2"
                onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
              >
                {c.admin.review.removeStep}
              </button>
            </span>
          ))}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setSteps((prev) => [...prev, { text: '', formula: '' }])}
          >
            {c.admin.review.addStep}
          </button>
          {/* T-114: the publish gate refuses a calculation whose last step does
              not name the answer choice, so the rule is said here too. */}
          <span className="text-caption text-ink-2">
            {c.admin.review.lastStepHint(correct || 'B')}
          </span>
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-2 uppercase">{c.admin.review.explanation}</span>
          <input
            className="field"
            value={explanation}
            placeholder={c.admin.review.explanationPlaceholder}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-2 uppercase">{c.admin.review.timeLimit}</span>
        <input
          className="field num"
          inputMode="numeric"
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
        />
        <span className="text-caption text-ink-2">{c.admin.review.timeLimitHint}</span>
      </label>

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-0.5" aria-live="polite">
          {problems.map((problem) => (
            <li key={problem} className="text-caption text-wrong">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      {saved && problems.length === 0 ? (
        <p className="text-caption text-correct" aria-live="polite">
          {c.admin.review.savedChanges}
        </p>
      ) : null}

      <button type="button" className="btn-ghost" disabled={saving} onClick={() => void save()}>
        {saving ? c.admin.review.saving : c.admin.review.save}
      </button>
    </div>
  );
}
