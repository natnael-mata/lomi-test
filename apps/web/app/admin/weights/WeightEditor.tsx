'use client';

/**
 * The topic weight editor (T-162a).
 *
 * Shows what the bank derived, what a reviewer overrode and why, and the live
 * sum. Every number here can be checked against the row above it — a weight an
 * operator cannot reconstruct is the decoration DESIGN.md forbids, and this is
 * the screen where a wrong one silently reshapes every mock paper.
 */
import { useEffect, useState } from 'react';

import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { WeightSumIndicator } from '../../../components/WeightSumIndicator';
import { validateOverride } from '../../../components/weight-sum';
import { api, type EffectiveWeight, type FieldOption } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

export function WeightEditor() {
  const c = copy();
  const [fieldId, setFieldId] = useState<string | null>(null);
  /*
   * Which programme these weights belong to, kept so the screen can say so.
   *
   * It loaded `fields[0]` and named nothing (T-237). An operator with two
   * programmes was editing one of them without being told which, on the screen
   * where a wrong number silently reshapes every mock paper that programme
   * generates. The list is kept as well as the choice, because the fix for "you
   * cannot tell which" is not a label if you also cannot reach the other one.
   */
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [rows, setRows] = useState<EffectiveWeight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  /** The field's sitting date as `YYYY-MM-DD`, or '' for none (T-269). */
  const [examDate, setExamDate] = useState('');
  const [draft, setDraft] = useState({ weightPct: '', reason: '' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mine = await api.myFields();
        /*
         * Open on a programme that has something in it.
         *
         * `mine[0]` is alphabetical, which put an operator on Accounting &
         * Finance — published, empty, and showing weights for a bank with no
         * questions as the first thing they see. The picker below still reaches
         * every programme; this only chooses where to land.
         */
        const first = (mine.find((f) => f.questionCount > 0) ?? mine[0])?.id;
        if (!first) {
          if (!cancelled) setError(c.admin.noProgramme);
          return;
        }
        const weights = await api.adminWeights(first);
        if (cancelled) return;
        setFields(mine);
        setFieldId(first);
        setExamDate(mine.find((f) => f.id === first)?.examDate?.slice(0, 10) ?? '');
        setRows(weights);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (work: () => Promise<EffectiveWeight[]>): Promise<void> => {
    try {
      setRows(await work());
      setError(null);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const save = async (topicId: string): Promise<void> => {
    if (!fieldId) return;
    const weightPct = Number(draft.weightPct);
    // Checked here so a reviewer is told before they lose what they typed. The
    // server checks the same things and remains the authority.
    const valid = validateOverride(weightPct, draft.reason);
    if (!valid.ok) {
      setError(valid.message);
      return;
    }
    await run(() => api.adminOverrideWeight(fieldId, topicId, weightPct, draft.reason));
  };

  /** The programme these rows belong to. */
  const current = fields.find((f) => f.id === fieldId) ?? null;

  const switchTo = async (id: string): Promise<void> => {
    setEditing(null);
    setFieldId(id);
    // The date belongs to the programme, so it changes with it. Leaving it put
    // would show one field's sitting under another field's name.
    setExamDate(fields.find((f) => f.id === id)?.examDate?.slice(0, 10) ?? '');
    await run(() => api.adminWeights(id));
  };

  /**
   * Writes the sitting date, or clears it.
   *
   * Its own handler rather than `run`, which exists to swallow a weights
   * response — this returns the saved date, and the two have no reason to share
   * a shape. The local value is kept so the field does not jump back while the
   * request is in flight; the list is updated too, so switching away and back
   * shows what was actually saved.
   */
  const saveExamDate = async (value: string): Promise<void> => {
    if (!fieldId) return;
    setExamDate(value);
    try {
      const saved = await api.adminSetExamDate(fieldId, value || null);
      setFields((all) =>
        all.map((f) => (f.id === fieldId ? { ...f, examDate: saved.examDate } : f)),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  if (error && rows.length === 0) {
    return (
      <Card data-state="error">
        <p className="text-body">{error}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-admin-weights="">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-title">{c.admin.topicWeights}</h1>
          {current && (
            <p className="text-caption text-ink-2">
              {c.admin.weightingProgramme}: <span className="text-ink">{current.name}</span>
            </p>
          )}
        </div>
        {fieldId && (
          <Button
            variant="ghost"
            className="w-auto self-start px-5"
            onClick={() => void run(() => api.adminDeriveWeights(fieldId))}
          >
            {c.admin.recompute}
          </Button>
        )}
      </header>

      {/* Only when there is a choice to make. A select with one option is a
          control that cannot be used, and it would push the sum further down the
          screen for every operator who runs a single programme. */}
      {fields.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-2">{c.admin.switchProgramme}</span>
          <select
            className="border-border-input bg-surface text-body rounded-control min-h-12 max-w-[34rem] border px-3"
            value={fieldId ?? ''}
            onChange={(e) => void switchTo(e.target.value)}
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* What these numbers reach. The editor showed a table of percentages with
          no statement of what they govern — and they govern every mock paper the
          programme generates. */}
      {current && <p className="text-caption text-ink-2">{c.admin.weightsScope(current.name)}</p>}

      {/*
        The sitting this programme counts down to (T-269).

        **Nothing in the product could set it.** `Field.examDate` has existed
        since the schema was written, the study plan divides the remaining
        questions by the days left, and the landing page sells that as step
        three of four — "the app works out how many a day you need to reach 80%
        before your exam, and recalculates it every morning". With no control
        anywhere, `/progress` answered "No exam date is set yet, so there is no
        daily target to work out" for every student, permanently.

        Here rather than on its own screen because this is already the page
        about one programme, and it is the same operator: somebody who sets a
        field's weights is somebody who knows when its exam is.

        Clearing is deliberately as easy as setting. A date against the wrong
        programme is worse than none — the daily target it produces looks every
        bit as authoritative as a correct one.
      */}
      {fieldId && (
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-2">{c.admin.examDateLabel}</span>
          <input
            type="date"
            className="border-border-input bg-surface text-body rounded-control min-h-12 max-w-[16rem] border px-3"
            value={examDate}
            onChange={(e) => void saveExamDate(e.target.value)}
          />
          <span className="text-caption text-ink-2">
            {examDate ? c.admin.examDateGoverns(current?.name ?? '') : c.admin.examDateNone}
          </span>
        </label>
      )}

      {/*
       * The rows beside the sum, from `lg`.
       *
       * The sum was above the rows, and the comment below says why it exists:
       * it is what a reviewer watches *while* editing. Stacked at the 1200px
       * admin measure it scrolled out of view as soon as the topic list was
       * longer than a screen — visible only when it had nothing left to tell
       * them. `lg:sticky` keeps it in the corner of the eye instead, which is
       * what the original intention asked for and the original layout denied.
       */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <ul className="flex flex-col gap-2 lg:order-1">
          {rows.map((row) => (
            <li
              key={row.topicId}
              data-topic={row.topicId}
              className="border-border bg-surface rounded-card border p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label">{row.topicName}</span>
                <span className="text-label num">{row.weightPct}%</span>
              </div>

              <p className="text-caption text-ink-2 mt-1">
                {/* Both numbers, always. The size of a correction is only legible
                  next to what it corrected. */}
                {c.admin.publishedBankSays(row.publishedCount, row.derivedPct)}
              </p>

              {row.weightSource === 'override' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip tone="pending" data-override="">
                    {c.admin.setByReviewer}
                  </Chip>
                  <span className="text-caption text-ink-2">{row.overrideReason}</span>
                </div>
              )}

              {editing === row.topicId ? (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    className="field num"
                    inputMode="numeric"
                    value={draft.weightPct}
                    onChange={(e) => setDraft({ ...draft, weightPct: e.target.value })}
                    aria-label={c.admin.weightLabel(row.topicName)}
                  />
                  <input
                    className="field"
                    value={draft.reason}
                    onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                    aria-label={c.admin.reasonLabel(row.topicName)}
                    placeholder={c.admin.reasonPlaceholder}
                  />
                  <div className="flex items-center gap-2">
                    <Button className="w-auto px-5" onClick={() => void save(row.topicId)}>
                      {c.common.save}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-auto px-5"
                      onClick={() => setEditing(null)}
                    >
                      {c.common.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="w-auto px-5"
                    onClick={() => {
                      setEditing(row.topicId);
                      setDraft({ weightPct: String(row.weightPct), reason: '' });
                    }}
                  >
                    {c.admin.override}
                  </Button>
                  {row.weightSource === 'override' && fieldId && (
                    <Button
                      variant="ghost"
                      className="w-auto px-5"
                      onClick={() =>
                        void run(() => api.adminClearWeightOverride(fieldId, row.topicId))
                      }
                    >
                      {c.admin.backToBank}
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* The live sum, and the error beside it. Sticky from `lg` so it stays
            in view while the rows below it are edited. */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:order-2">
          <Card>
            <WeightSumIndicator
              rows={rows.map((r) => ({
                topicId: r.topicId,
                topicName: r.topicName,
                weightPct: r.weightPct,
              }))}
            />
          </Card>

          {error && (
            <p className="text-caption text-wrong" data-error="">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
