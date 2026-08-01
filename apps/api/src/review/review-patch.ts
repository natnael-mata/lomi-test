/**
 * Validating a reviewer's edit, with no database involved.
 *
 * This is the write path T-031a's decision rests on: why-wrongs and the concept
 * line are deliberately absent from the import template, so **this endpoint is
 * the only way anything imported ever becomes publishable**. That makes its
 * validation worth testing on its own, in milliseconds.
 *
 * It validates shape, not soundness. Whether the resulting question is fit to
 * serve is the publish gate's judgement and nobody else's — this rejects only
 * what could not be stored coherently.
 */
import { OPTION_LABELS, type OptionLabelLetter } from '../import/map-row';
import { MAX_TIME_LIMIT_SEC, MIN_TIME_LIMIT_SEC } from '../questions/publish-gate';

export interface ReviewPatch {
  /** Which option is correct. Setting one clears every other. */
  correctOption?: string;
  /** Per-label rationale. `null` clears one; omitted labels are left alone. */
  whyWrong?: Record<string, string | null>;
  conceptLine?: string | null;
  explanation?: string | null;
  timeLimitSec?: number;
  /** Replaces the whole step list — a partial list of working is not working. */
  steps?: { stepNo: number; text: string; formula?: string | null }[];
}

export type PatchResult = { ok: true; patch: NormalisedPatch } | { ok: false; reasons: string[] };

export interface NormalisedPatch {
  correctOption?: OptionLabelLetter;
  whyWrong: { label: OptionLabelLetter; value: string | null }[];
  conceptLine?: string | null;
  explanation?: string | null;
  timeLimitSec?: number;
  steps?: { stepNo: number; text: string; formula: string | null }[];
}

const isLabel = (s: string): s is OptionLabelLetter =>
  (OPTION_LABELS as readonly string[]).includes(s);

/** Empty string means "cleared" everywhere here; `null` and `''` are one thing. */
const orNull = (s: string | null | undefined): string | null => {
  if (s == null) return null;
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
};

export function normalisePatch(input: ReviewPatch): PatchResult {
  const reasons: string[] = [];
  const patch: NormalisedPatch = { whyWrong: [] };

  if (Object.keys(input).length === 0) {
    // Not pedantry: an empty patch that silently "succeeds" reads to the caller
    // as "saved", and a reviewer walks away believing they wrote something.
    return { ok: false, reasons: ['Nothing to change — the patch is empty.'] };
  }

  if (input.correctOption !== undefined) {
    const label = input.correctOption.trim().toUpperCase();
    if (!isLabel(label)) {
      reasons.push(`correctOption "${input.correctOption}" is not one of A, B, C, D.`);
    } else {
      patch.correctOption = label;
    }
  }

  if (input.whyWrong !== undefined) {
    for (const [rawLabel, value] of Object.entries(input.whyWrong)) {
      const label = rawLabel.trim().toUpperCase();
      if (!isLabel(label)) {
        reasons.push(`whyWrong names option "${rawLabel}", which is not one of A, B, C, D.`);
        continue;
      }
      patch.whyWrong.push({ label, value: orNull(value) });
    }
  }

  // A why-wrong on the option being marked correct is a contradiction, and
  // storing both would leave the gate's "exactly one correct" rule passing while
  // the answer view shows the right answer explained as wrong.
  if (patch.correctOption !== undefined) {
    const contradiction = patch.whyWrong.find(
      (w) => w.label === patch.correctOption && w.value !== null,
    );
    if (contradiction) {
      reasons.push(
        `Option ${patch.correctOption} is being marked correct and given a why-wrong at the same time.`,
      );
    }
  }

  if (input.conceptLine !== undefined) patch.conceptLine = orNull(input.conceptLine);
  if (input.explanation !== undefined) patch.explanation = orNull(input.explanation);

  if (input.timeLimitSec !== undefined) {
    const limit = input.timeLimitSec;
    if (!Number.isInteger(limit) || limit < MIN_TIME_LIMIT_SEC || limit > MAX_TIME_LIMIT_SEC) {
      reasons.push(
        `timeLimitSec must be a whole number of seconds between ${MIN_TIME_LIMIT_SEC} and ${MAX_TIME_LIMIT_SEC}.`,
      );
    } else {
      patch.timeLimitSec = limit;
    }
  }

  if (input.steps !== undefined) {
    const steps = input.steps.map((s) => ({
      stepNo: s.stepNo,
      text: (s.text ?? '').trim(),
      formula: orNull(s.formula),
    }));

    if (steps.some((s) => !Number.isInteger(s.stepNo) || s.stepNo < 1)) {
      reasons.push('Every step needs a whole stepNo of 1 or more.');
    }
    if (new Set(steps.map((s) => s.stepNo)).size !== steps.length) {
      reasons.push('Two steps share a stepNo — the working would render in an arbitrary order.');
    }
    if (steps.some((s) => s.text === '')) {
      reasons.push('A step with no text is not a step.');
    }
    if (reasons.length === 0) {
      patch.steps = [...steps].sort((a, b) => a.stepNo - b.stepNo);
    }
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, patch };
}
