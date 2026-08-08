/**
 * The voice rules, over the copy a student reads (T-209).
 *
 * CLAUDE.md: "Plain, direct, second person, active. Errors state cause *and*
 * fix. **Never shame** a wrong answer or a missed day — the explanation is the
 * reward for getting it wrong, and a missed day *adjusts the plan*, it does not
 * break a streak."
 *
 * **Scoped to rendered text, not to all source.** A lint over every string
 * literal flags `className` and a variable called `failed`, and a lint that
 * cries wolf gets narrowed until it catches nothing. What is extracted here is
 * JSX text and the props that become visible words — which is a heuristic, and
 * one that misses copy assembled at runtime. The extractor's own guard checks it
 * is still finding a realistic amount.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = [join(WEB, 'components'), join(WEB, 'app')];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx$/.test(name) && !name.includes('.test') ? [full] : [];
  });
}

interface Copy {
  file: string;
  text: string;
}

/**
 * Words that reach a screen: JSX text nodes, and the props that render as text.
 *
 * `>text<` is crude but right for this codebase — the components here are plain
 * JSX with no templating layer between the source and the page.
 */
const COPY: Copy[] = ROOTS.flatMap(sources).flatMap((file) => {
  const source = stripComments(readFileSync(file, 'utf8'));
  const rel = relative(WEB, file);
  const found: Copy[] = [];

  for (const [, text] of source.matchAll(/>([^<>{}\n][^<>{}]*)</g)) {
    const trimmed = (text ?? '').trim();
    // Two or more words, so `%`, `·` and single tokens do not flood the list.
    if (/\s/.test(trimmed) && /[a-z]/i.test(trimmed)) found.push({ file: rel, text: trimmed });
  }

  for (const [, text] of source.matchAll(
    /(?:placeholder|aria-label|label|blockingReason|derivation)=(?:"([^"]+)"|'([^']+)')/g,
  )) {
    if (text) found.push({ file: rel, text });
  }

  return found;
});

/**
 * The wordings the rules exist to reject.
 *
 * "Failed" is the one the task names first, and the most instructive: it
 * describes the *system's* state as though it were the student's. "That did not
 * load" says the same thing without handing them the blame.
 */
const BANNED: [RegExp, string][] = [
  [/\bfailed\b/i, 'say what did not happen, not that somebody failed'],
  [/you lost/i, 'nothing is taken away in this product'],
  [/don'?t break/i, 'a missed day adjusts the plan; it breaks nothing'],
  [/\bstreak\b.*\b(?:lost|broken|gone)\b/i, 'a streak is consequence-free'],
  [/\byou (?:did not|didn'?t) /i, 'describe the state, not the person'],
  [/\bunfortunately\b/i, 'say what happened and what to do'],
  [/\boops\b/i, 'this is somebody’s exam preparation'],
  [/\bwhoops\b/i, 'this is somebody’s exam preparation'],
  [/something went wrong/i, 'leaves the reader with no move'],
];

describe('the voice a student reads (T-209)', () => {
  it('found copy to check', () => {
    // Guards the extractor: a lint over zero strings passes forever, and this
    // one is a heuristic that could silently stop matching.
    expect(COPY.length).toBeGreaterThan(40);
  });

  it('never shames or blames', () => {
    const offenders = COPY.flatMap(({ file, text }) =>
      BANNED.filter(([pattern]) => pattern.test(text)).map(
        ([, why]) => `${file}: "${text}" — ${why}`,
      ),
    );
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /**
   * The guard on the guard. Every rule above passes today, which is either
   * because the copy is careful or because the patterns match nothing.
   */
  it('would reject the wordings it forbids', () => {
    for (const text of [
      'Submission failed',
      'You lost your streak',
      "Don't break your streak",
      'Oops! Something went wrong',
      'Unfortunately we could not do that',
      'You did not answer',
    ]) {
      expect(
        BANNED.some(([pattern]) => pattern.test(text)),
        `"${text}" should have been rejected`,
      ).toBe(true);
    }
  });

  it('leaves the real copy alone', () => {
    for (const text of [
      'That did not load',
      'Nothing you have answered is lost — your work is saved as you go.',
      'Your answers are recorded.',
      'Open Lomi-Test to answer it and see why.',
    ]) {
      expect(
        BANNED.filter(([pattern]) => pattern.test(text)).map(([p]) => String(p)),
        `"${text}" should have passed`,
      ).toEqual([]);
    }
  });

  /**
   * A missed day adjusts the plan; it does not break a streak. The word may
   * appear — the rule is about the verbs attached to it, which is where the
   * threat lives.
   */
  it('never attaches loss to a streak', () => {
    const offenders = COPY.filter(
      ({ text }) =>
        /\bstreak\b/i.test(text) && /\b(lost|lose|broke|broken|break|ended)\b/i.test(text),
    ).map(({ file, text }) => `${file}: "${text}"`);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
