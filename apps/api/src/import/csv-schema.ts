/**
 * The canonical import schema — the 16 columns of
 * `docs/question_import_template.csv`, in file order.
 *
 * Declared as a `const` tuple rather than an interface so the column list exists
 * at runtime too: the parser validates a real file's header against it, which is
 * what stops a renamed or reordered column being read as something else.
 */
export const IMPORT_COLUMNS = [
  'question_id',
  'field',
  'course',
  'topic',
  'question_text',
  'code_block',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option',
  'explanation',
  'difficulty',
  'source',
  'year',
  'status',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/**
 * One CSV row, every cell a string — parsing and coercion happen later.
 *
 * Written out longhand rather than as `Record<ImportColumn, string>`. Deriving
 * it from the tuple looks tidier but makes the exhaustiveness guards below
 * TAUTOLOGICAL: the two can never disagree, so removing a column shrinks both
 * and compiles clean. Two independent declarations are the point — the guards
 * only mean something if there is something for them to compare.
 */
export interface ImportRow {
  question_id: string;
  field: string;
  course: string;
  topic: string;
  question_text: string;
  code_block: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  difficulty: string;
  source: string;
  year: string;
  status: string;
}

/**
 * Values the `status` column may carry, per CONTENT-PIPELINE.md. Rows combine
 * them with `;` — e.g. `needs_answer;needs_explanation;needs_topic_review`.
 *
 * Note `ready` is a claim by the source file, NOT a grant: the importer never
 * publishes (T-054), and the publish gate decides what is actually servable.
 */
export const IMPORT_STATUSES = [
  'raw',
  'needs_answer',
  'needs_explanation',
  'needs_topic_review',
  'ready',
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/**
 * Compile-time exhaustiveness: if a column is added to `ImportRow` without being
 * added to `IMPORT_COLUMNS` (or vice versa), one of these resolves to `false`
 * and `npm run typecheck` fails. A runtime test additionally compares both
 * against the real CSV's header.
 */
type MissingFromTuple = Exclude<keyof ImportRow, ImportColumn>;
type MissingFromType = Exclude<ImportColumn, keyof ImportRow>;

export const _columnsCoverType: MissingFromTuple extends never ? true : false = true;
export const _typeCoversColumns: MissingFromType extends never ? true : false = true;
