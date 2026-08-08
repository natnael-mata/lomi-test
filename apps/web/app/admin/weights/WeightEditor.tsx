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
import { api, type EffectiveWeight } from '../../../lib/api';

export function WeightEditor() {
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [rows, setRows] = useState<EffectiveWeight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ weightPct: '', reason: '' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fields = await api.myFields();
        const first = fields[0]?.id;
        if (!first) {
          if (!cancelled) setError('No published programme to weight yet.');
          return;
        }
        const weights = await api.adminWeights(first);
        if (cancelled) return;
        setFieldId(first);
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

  if (error && rows.length === 0) {
    return (
      <Card data-state="error">
        <p className="text-body">{error}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-admin-weights="">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-title">Topic weights</h1>
        {fieldId && (
          <Button variant="ghost" onClick={() => void run(() => api.adminDeriveWeights(fieldId))}>
            Recompute from the bank
          </Button>
        )}
      </header>

      {/* The live sum, above the rows: it is the thing a reviewer is watching
          while they edit, not a summary of what they have finished. */}
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

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.topicId} data-topic={row.topicId} className="bg-surface rounded-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label">{row.topicName}</span>
              <span className="text-label num">{row.weightPct}%</span>
            </div>

            <p className="text-caption text-ink-2 mt-1">
              {/* Both numbers, always. The size of a correction is only legible
                  next to what it corrected. */}
              {row.publishedCount} published · bank says {row.derivedPct}%
            </p>

            {row.weightSource === 'override' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Chip tone="pending" data-override="">
                  Set by a reviewer
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
                  aria-label={`Weight for ${row.topicName}, whole percent`}
                />
                <input
                  className="field"
                  value={draft.reason}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  aria-label={`Why ${row.topicName} is being overridden`}
                  placeholder="Past papers give this more than the bank does."
                />
                <div className="flex items-center gap-2">
                  <Button onClick={() => void save(row.topicId)}>Save</Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(row.topicId);
                    setDraft({ weightPct: String(row.weightPct), reason: '' });
                  }}
                >
                  Override
                </Button>
                {row.weightSource === 'override' && fieldId && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void run(() => api.adminClearWeightOverride(fieldId, row.topicId))
                    }
                  >
                    Back to the bank
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
