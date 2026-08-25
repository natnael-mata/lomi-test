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
  /*
   * The school year the question came from (T-253).
   *
   * Appended, never inserted. Every spreadsheet already uploaded has sixteen
   * columns in this order, and a column added in the middle silently shifts
   * every field to its right — the importer would accept the file and file the
   * explanation under `difficulty`. Last is the only safe place.
   *
   * Blank is legitimate and means "not from a school year": the university exit
   * exam has no `sourceGrade`, and a school question whose year is not yet known
   * is better null than guessed.
   */
  'source_grade',
  /*
   * The concept line and the why-wrongs (T-212).
   *
   * **Without these the importer cannot produce a publishable question.** The
   * publish gate requires a concept line and a reason for every incorrect
   * option; the template carried neither, so every uploaded row landed as a
   * draft with four or five blockers and somebody had to type them back in by
   * hand, one question at a time, in `/admin/review`. Forty-six published
   * questions existed and not one of them had come through the importer.
   *
   * Appended, never inserted, for the reason `source_grade` gives above: a
   * column added in the middle silently shifts every field to its right, and
   * the importer would accept the file and file the explanation under
   * `difficulty`.
   *
   * `why_wrong_*` for the option matching `correct_option` is ignored — a right
   * answer has no reason for being wrong — so a spreadsheet may leave it blank
   * or fill it in without changing anything.
   */
  'concept_line',
  'why_wrong_a',
  'why_wrong_b',
  'why_wrong_c',
  'why_wrong_d',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/**
 * Columns a file may end without, and still be read.
 *
 * **Every spreadsheet uploaded before `source_grade` existed has sixteen
 * columns.** Requiring seventeen would reject all of them at the header, on the
 * exact week the owner is loading the bank — a schema change that invalidates
 * the work already done is not a schema change anybody can afford.
 *
 * So the header may stop at `status` or carry on to `source_grade`, and a row
 * is measured against whichever header it arrived under. Trailing and optional
 * are both load-bearing: a gap in the *middle* would shift every cell to its
 * right and silently file the explanation under `difficulty`, which is why new
 * columns are only ever appended.
 */
export const OPTIONAL_TRAILING_COLUMNS: readonly ImportColumn[] = [
  'source_grade',
  // T-212's five. Same argument as `source_grade`: every spreadsheet already
  // uploaded stops at `status` or `source_grade`, and requiring twenty-two
  // columns would reject all of them at the header.
  'concept_line',
  'why_wrong_a',
  'why_wrong_b',
  'why_wrong_c',
  'why_wrong_d',
];

/** The shortest header this importer will accept — the schema minus its optional tail. */
export const REQUIRED_COLUMNS: readonly ImportColumn[] = IMPORT_COLUMNS.filter(
  (c) => !OPTIONAL_TRAILING_COLUMNS.includes(c),
);

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
  source_grade: string;
  /** The one thing to remember. Required by the publish gate (T-212). */
  concept_line: string;
  /**
   * Why each option is wrong. The one matching `correct_option` is ignored.
   *
   * Required by the publish gate for every incorrect option — a question that
   * reaches a student with three unexplained wrong answers teaches them the
   * letter and nothing else.
   */
  why_wrong_a: string;
  why_wrong_b: string;
  why_wrong_c: string;
  why_wrong_d: string;
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
