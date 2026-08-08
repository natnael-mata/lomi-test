/**
 * The voice rules, over every message the API sends a person (T-209).
 *
 * CLAUDE.md: "Plain, direct, second person, active. Errors state cause *and*
 * fix. **Never shame** a wrong answer or a missed day."
 *
 * **Scoped to `message:` fields, not to all source.** A lint over every string
 * would flag `const failed = 0` in the daily sender and the word "failed" in a
 * test name, and a lint that cries wolf gets narrowed until it catches nothing.
 * What a student actually reads is the `message` on an exception, so that is
 * what is checked.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Walked up from the working directory rather than taken from `import.meta`.
 *
 * This workspace compiles as CommonJS for Nest's decorator metadata, and
 * `import.meta` is a syntax error under that module setting even though Vitest
 * runs it happily — a gap only `npm run typecheck` catches. It has caught this
 * exact mistake before; see `sitting-clock.test.ts`.
 */
function findSrc(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const candidate of [resolve(dir, 'apps/api/src'), resolve(dir, 'src')]) {
      if (existsSync(join(candidate, 'common/redact.ts'))) return candidate;
    }
    dir = dirname(dir);
  }
  throw new Error('could not locate apps/api/src');
}

const SRC = findSrc();

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith('.ts') && !name.includes('.test') ? [full] : [];
  });
}

interface Message {
  file: string;
  text: string;
}

/** Every string assigned to a `message:` field — what a person actually reads. */
const MESSAGES: Message[] = sources(SRC).flatMap((file) => {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/message:\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/g)].map((m) => ({
    file: relative(SRC, file),
    text: m[1] ?? m[2] ?? m[3] ?? '',
  }));
});

describe('the API’s voice (T-209)', () => {
  it('found messages to check', () => {
    // Guards the extractor: a lint over zero strings passes forever.
    expect(MESSAGES.length).toBeGreaterThan(10);
  });

  /**
   * The words the task names, plus the rest of the shaming set.
   *
   * "Failed" is the interesting one: it describes the *system's* state as though
   * it were the student's. "Could not reach the server" says the same thing
   * without assigning the failure to the person reading it.
   */
  const BANNED: [RegExp, string][] = [
    [/\bfailed\b/i, 'say what could not happen, not that somebody failed'],
    [/you lost/i, 'nothing is taken away in this product'],
    [/don'?t break/i, 'a missed day adjusts the plan; it breaks nothing'],
    [/\byou (?:did not|didn'?t) /i, 'describe the state, not the person'],
    [/\binvalid\b/i, 'name what is wrong with it'],
    [/\berror occurred\b/i, 'say what happened'],
    [/\btry again later\b/i, 'say when, or say what to do instead'],
  ];

  it('never blames the person reading it', () => {
    const offenders = MESSAGES.flatMap(({ file, text }) =>
      BANNED.filter(([pattern]) => pattern.test(text)).map(
        ([, why]) => `${file}: "${text}" — ${why}`,
      ),
    );
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /**
   * The guard on the guard.
   *
   * Every assertion above currently passes, which is either because the copy is
   * careful or because the patterns match nothing. These are the lines the rules
   * exist to reject, and they must still be rejected.
   */
  it('would reject the wordings it forbids', () => {
    const shouldFail = [
      'Login failed. Please try again later.',
      'You lost your streak.',
      "Don't break your streak — answer today!",
      'You did not answer in time.',
      'Invalid input.',
      'An error occurred.',
    ];
    for (const text of shouldFail) {
      expect(
        BANNED.some(([pattern]) => pattern.test(text)),
        `"${text}" should have been rejected`,
      ).toBe(true);
    }
  });

  it('leaves good wordings alone', () => {
    const shouldPass = [
      'The time ran out. Your earlier answers are safe.',
      'A weight is a whole number from 0 to 100.',
      'Say why this weight is being overridden.',
      'That sign-in link has already been used or has run out.',
    ];
    for (const text of shouldPass) {
      expect(
        BANNED.filter(([pattern]) => pattern.test(text)).map(([p]) => String(p)),
        `"${text}" should have passed`,
      ).toEqual([]);
    }
  });

  /**
   * Errors state cause **and** fix.
   *
   * Checked as "long enough to contain both" rather than by parsing English: a
   * five-word refusal is one that names the cause and stops. It is a crude
   * proxy, and a deliberately loose one — the alternative is a lint nobody can
   * satisfy, which gets deleted.
   */
  it('says more than what went wrong', () => {
    const tooTerse = MESSAGES.filter(({ text }) => text.trim().split(/\s+/).length < 4).map(
      ({ file, text }) => `${file}: "${text}"`,
    );
    expect(tooTerse, tooTerse.join('\n')).toEqual([]);
  });

  // Sentences, not fragments. A message that does not end is one pasted into a
  // UI that then adds its own punctuation, or does not.
  it('writes whole sentences', () => {
    const unfinished = MESSAGES.filter(({ text }) => !/[.!?]$/.test(text.trim())).map(
      ({ file, text }) => `${file}: "${text}"`,
    );
    expect(unfinished, unfinished.join('\n')).toEqual([]);
  });
});
