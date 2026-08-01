/**
 * One CSV row → the shape the database wants, with no database involved.
 *
 * Pure on purpose, like `publish-gate.ts`: the interesting decisions here are
 * "is this row usable" and "what is still missing from it", and those deserve
 * tests that run in milliseconds without a Postgres.
 *
 * The governing rule is CONTENT-PIPELINE.md §2: the importer stages, it does not
 * judge. A row missing its answer is a row to be finished in the review queue,
 * not a row to throw away — the whole point is to **import everything now** and
 * close the gaps over time. So rejection is reserved for rows that could not
 * become a question no matter how much work someone put in.
 */
import type { ImportFlag, QType } from '@prisma/client';

import type { ImportRow, ImportStatus } from './csv-schema';
import { parseStatuses } from './status';

/** D4 pacing budgets: 1 minute for a concept question, 3 for a calculation. */
export const TIME_LIMIT_SEC: Record<QType, number> = {
  CONCEPT: 60,
  CALCULATION: 180,
};

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
export type OptionLabelLetter = (typeof OPTION_LABELS)[number];

export interface MappedOption {
  label: OptionLabelLetter;
  text: string;
  isCorrect: boolean;
}

export interface MappedRow {
  stableId: string;
  /** Names as written in the file; the service resolves them to rows. */
  field: string;
  course: string;
  topic: string;
  qType: QType;
  stem: string;
  codeBlock: string | null;
  explanation: string | null;
  timeLimitSec: number;
  sourceRef: string | null;
  year: number | null;
  options: MappedOption[];
  /** What is still outstanding — the file's claim, corrected by what is actually here. */
  flags: ImportFlag[];
  /** Anything a human should know about how this row was read. Never fatal. */
  notes: string[];
}

export type MapResult =
  { ok: true; row: MappedRow } | { ok: false; stableId: string; reasons: string[] };

export const UNSORTED = 'Unsorted';

/** A stem that asks for a quantity rather than for an idea. */
const QUANTITY_STEM =
  /\b(how much|how many|calculate|compute|liability\/refund|what is the (total|amount|cost|value|balance|vat|price|rate))\b/i;

/** An option that is a bare number — "172,500", "Br 45,000", "12.5%". */
const NUMERIC_OPTION = /^(br\.?\s*)?[\d][\d,. ]*%?$/i;

const slugifyable = (s: string): boolean => /[a-z0-9]/i.test(s);

/**
 * Infers CONCEPT vs CALCULATION. The import schema has no type column, and the
 * two differ in how the answer is explained: prose, or numbered working.
 *
 * Getting this wrong is survivable in one direction only, which is why it is
 * safe to guess at all. A calculation misread as a concept is merely mispaced;
 * a concept misread as a calculation is **blocked** by the publish gate, which
 * demands worked steps. Both end at a human, neither ends at a student.
 */
export function inferQType(stem: string, options: readonly string[]): QType {
  if (QUANTITY_STEM.test(stem)) return 'CALCULATION';
  const filled = options.filter((o) => o.trim() !== '');
  const numeric = filled.filter((o) => NUMERIC_OPTION.test(o.trim()));
  if (filled.length >= 3 && numeric.length >= 3) return 'CALCULATION';
  return 'CONCEPT';
}

export function mapRow(row: ImportRow): MapResult {
  const stableId = row.question_id.trim();
  const reasons: string[] = [];
  const notes: string[] = [];

  // Fatal: nothing here can be supplied later by a reviewer looking at the row,
  // because without these there is no row to look at.
  if (stableId === '') reasons.push('question_id is blank — nothing to identify or re-import on');
  if (row.question_text.trim() === '')
    reasons.push('question_text is blank — there is no question');
  if (row.field.trim() === '') {
    reasons.push('field is blank — a question in no programme can never be served');
  } else if (!slugifyable(row.field)) {
    reasons.push(`field "${row.field}" has no letters or digits to identify it by`);
  }

  const optionTexts = OPTION_LABELS.map((l) => row[`option_${l.toLowerCase()}` as keyof ImportRow]);
  const filled = optionTexts.filter((t) => t.trim() !== '');
  if (filled.length < 2) {
    reasons.push(`only ${filled.length} option(s) supplied — a multiple choice needs at least 2`);
  }

  const answer = row.correct_option.trim().toUpperCase();
  const hasAnswer = answer !== '';
  if (hasAnswer && !OPTION_LABELS.includes(answer as OptionLabelLetter)) {
    reasons.push(`correct_option "${row.correct_option}" is not one of a, b, c, d`);
  } else if (hasAnswer) {
    const idx = OPTION_LABELS.indexOf(answer as OptionLabelLetter);
    if (optionTexts[idx]!.trim() === '') {
      reasons.push(`correct_option "${answer}" names an option that has no text`);
    }
  }

  if (reasons.length > 0) return { ok: false, stableId: stableId || '(no id)', reasons };

  // ---- staging decisions: everything below is recoverable by a human ----

  const claimed = parseStatuses(row.status);
  for (const u of claimed.unknown) notes.push(`unrecognised status "${u}" ignored`);
  notes.push(...claimed.contradictions);

  // The file's claim, then reality overriding it. A row that says `ready` while
  // arriving with no answer is not ready, and the flag has to say so — otherwise
  // it sits in nobody's queue and quietly never gets finished.
  const flags = new Set<ImportFlag>(claimed.statuses.map(toFlag));
  if (!hasAnswer) flags.add('NEEDS_ANSWER');
  if (row.explanation.trim() === '') flags.add('NEEDS_EXPLANATION');

  const course = row.course.trim();
  const topic = row.topic.trim();
  if (course === '' || topic === '') {
    // Topic is a required relation, so a blank one still has to land somewhere.
    // `Unsorted` is that somewhere: visible, queryable, and obviously provisional
    // — as opposed to guessing a topic, which produces a plausible wrong answer
    // to "what share of the paper is this" later on.
    flags.add('NEEDS_TOPIC_REVIEW');
    notes.push(
      course === '' && topic === ''
        ? 'no course or topic — staged under Unsorted'
        : `no ${course === '' ? 'course' : 'topic'} — staged under Unsorted`,
    );
  }

  let year: number | null = null;
  if (row.year.trim() !== '') {
    const n = Number(row.year.trim());
    if (Number.isInteger(n) && n > 1900 && n < 2200) year = n;
    else notes.push(`year "${row.year}" is not a usable year — dropped`);
  }

  if (row.difficulty.trim() !== '') {
    // Honest rather than silent: the column is in the CSV contract but has no
    // column here yet (T-053a).
    notes.push(`difficulty "${row.difficulty.trim()}" is not stored yet`);
  }

  const stem = row.question_text.trim();
  const qType = inferQType(stem, optionTexts);
  if (qType === 'CALCULATION') notes.push('typed as CALCULATION by inference — no type column');

  const options: MappedOption[] = [];
  OPTION_LABELS.forEach((label, i) => {
    const text = optionTexts[i]!.trim();
    if (text === '') return;
    options.push({ label, text, isCorrect: hasAnswer && answer === label });
  });

  return {
    ok: true,
    row: {
      stableId,
      field: row.field.trim(),
      course: course || UNSORTED,
      topic: topic || UNSORTED,
      qType,
      stem,
      codeBlock: row.code_block.trim() || null,
      explanation: row.explanation.trim() || null,
      timeLimitSec: TIME_LIMIT_SEC[qType],
      sourceRef: row.source.trim() || null,
      year,
      options,
      // Sorted so the stored array is comparable between runs.
      flags: [...flags].sort(),
      notes,
    },
  };
}

/**
 * CSV vocabulary → database vocabulary.
 *
 * `satisfies Record<ImportStatus, ImportFlag>` is the point of this table: add a
 * status to CONTENT-PIPELINE.md and typecheck fails here until the enum learns
 * about it, rather than the value being dropped at runtime.
 */
const FLAG_BY_STATUS = {
  raw: 'RAW',
  needs_answer: 'NEEDS_ANSWER',
  needs_explanation: 'NEEDS_EXPLANATION',
  needs_topic_review: 'NEEDS_TOPIC_REVIEW',
  ready: 'READY',
} as const satisfies Record<ImportStatus, ImportFlag>;

function toFlag(status: ImportStatus): ImportFlag {
  return FLAG_BY_STATUS[status];
}
