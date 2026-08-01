/**
 * Cleaning passes for text extracted from the MoE source files.
 *
 * CONTENT-PIPELINE.md §1 lists what is actually wrong with them: form feeds,
 * page headers repeated on every page, `"Question N"` welded onto the front of
 * the following text, double lettering, and general OCR spacing damage.
 *
 * Two rules govern everything here, because a cleaner that is too clever is
 * worse than no cleaner at all:
 *
 * 1. **Only remove what is certainly noise.** A pass that might be stripping
 *    real content does not belong — a question silently missing its first three
 *    words is harder to notice than an obviously dirty one.
 * 2. **Every change is reported** (T-060). Nothing is fixed quietly.
 */

/** One thing a cleaning pass did, so the run report can list it. */
export interface CleanChange {
  rule: string;
  before: string;
  after: string;
}

export interface CleanResult {
  text: string;
  changes: CleanChange[];
}

/**
 * `Question 12Answer: foo` — the number welded onto whatever followed it.
 *
 * Requires **no space** after the digits, which is what "concatenated" means in
 * CONTENT-PIPELINE.md. Allowing a space would also eat the opening of
 * "Question 3 asked households whether…", and silently losing the first words of
 * a question is worse than leaving one dirty.
 */
const QUESTION_PREFIX = /^\s*Question\s*\d+(?=\S)/i;

/** A leftover `Answer:` / `Ans.` label at the start of an option or stem. */
const ANSWER_LABEL = /^\s*(?:Answer|Ans)\s*[.:]\s*/i;

/**
 * Form feeds and the rest of the control characters a PDF extractor leaves
 * behind. Written as escapes rather than literals: a control character pasted
 * into source is invisible to every reviewer who reads this line.
 *
 * Tab and newline are excluded from the range — both carry meaning here.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/** Zero-width and non-breaking spaces: they look like nothing and compare unequal. */
const INVISIBLE = /[\u00A0\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Cleans one field of extracted text.
 *
 * `runningHeaders` are the page headers seen repeating in this particular file —
 * they are per-file strings, not a fixed list, so the caller supplies them. A
 * header is only stripped when it sits at the very start or end of the text;
 * removing it from the middle would cut through a sentence that legitimately
 * quotes it.
 */
export function cleanText(input: string, runningHeaders: readonly string[] = []): CleanResult {
  const changes: CleanChange[] = [];
  let text = input;

  const apply = (rule: string, next: string): void => {
    if (next === text) return;
    changes.push({ rule, before: text, after: next });
    text = next;
  };

  apply('control characters', text.replace(CONTROL_CHARS, ' '));
  apply('invisible characters', text.replace(INVISIBLE, ' '));

  // Whitespace is normalised BEFORE the header and prefix passes, not after.
  // Those passes compare literal strings, and an extractor that split a header
  // across two lines would otherwise fail to match one written on a single line.
  apply('whitespace', collapseWhitespace(text));

  for (const header of runningHeaders) {
    if (header.trim() === '') continue;
    apply('running header', stripHeader(text, header));
  }

  apply('question number prefix', text.replace(QUESTION_PREFIX, ''));
  apply('answer label', text.replace(ANSWER_LABEL, ''));

  apply('whitespace', text.trim());

  return { text, changes };
}

/**
 * Removes a repeated page header from the ends of the text.
 *
 * Anchored to the ends deliberately. A header string can legitimately appear
 * inside a question — "the Ministry of Revenue defines…" is content, not a page
 * header — and a global replace would cut it out of the middle of a sentence.
 */
function stripHeader(text: string, header: string): string {
  const needle = collapseWhitespace(header);
  if (needle === '') return text;

  let out = text.trim();
  let changed = true;

  // Loop: an extractor that repeats the header per page can stack several of
  // them at one end.
  while (changed) {
    changed = false;
    if (equalsFolded(out.slice(0, needle.length), needle)) {
      out = out.slice(needle.length).trim();
      changed = true;
    }
    if (out.length >= needle.length && equalsFolded(out.slice(-needle.length), needle)) {
      out = out.slice(0, out.length - needle.length).trim();
      changed = true;
    }
    // A header stripped down to nothing means the whole field was header. Keep
    // the empty string: the row then fails the "no question" check loudly,
    // rather than being half-cleaned into something plausible.
    if (out === '') break;
  }
  return out;
}

/**
 * Case-insensitive equality that also ignores WHICH whitespace character is
 * used. Runs of whitespace are already collapsed to one character by then, so
 * this stays length-preserving — which matters, because the caller sliced the
 * text to the needle's length and a fold that changed lengths would misalign it.
 *
 * Needed because an extractor that broke a page header across two lines writes
 * a newline where the header itself has a space.
 */
const foldSpace = (s: string): string => s.toLowerCase().replace(/\s/g, ' ');
const equalsFolded = (a: string, b: string): boolean => foldSpace(a) === foldSpace(b);

/**
 * Collapses runs of spaces and blank lines.
 *
 * Newlines survive: a code block's line structure is the whole point of it, and
 * the multi-line numeric scenarios in the Accounting files read as nonsense on
 * one line. Only runs of *three or more* newlines are reduced, and to two.
 */
function collapseWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Double lettering: `"A. a. Simple random sampling"` → `"Simple random sampling"`.
 *
 * The extractors emit an option's letter twice — once from the printed page and
 * once from the list structure — in every combination of `A.` / `A)` / `(A)` and
 * either case. CONTENT-PIPELINE.md §1 lists it as cross-cutting noise.
 *
 * Only stripped when the letter is **doubled**, and only when the two letters
 * agree. A single leading `a)` is left alone: it is impossible to tell from the
 * text whether it is the option's own label or part of the answer ("a) and c)
 * are both correct" is a real option in these papers), and one wrong strip that
 * changes an answer's meaning costs more than a hundred tidy ones gain.
 */
const DOUBLE_LETTER = /^\s*\(?([a-d])[.)]\s*\(?([a-d])[.)]\s*/i;

export function stripDoubleLetter(input: string): CleanResult {
  const match = DOUBLE_LETTER.exec(input);
  if (!match || match[1]!.toLowerCase() !== match[2]!.toLowerCase()) {
    return { text: input, changes: [] };
  }
  const text = input.slice(match[0].length);
  return { text, changes: [{ rule: 'double lettering', before: input, after: text }] };
}

/** Both option passes, in the order they have to run. */
export function cleanOptionText(
  input: string,
  runningHeaders: readonly string[] = [],
): CleanResult {
  // Cleaning first: the doubled letters are only adjacent once the form feeds
  // and stray spacing between them are gone.
  const cleaned = cleanText(input, runningHeaders);
  const lettered = stripDoubleLetter(cleaned.text);
  return { text: lettered.text, changes: [...cleaned.changes, ...lettered.changes] };
}
