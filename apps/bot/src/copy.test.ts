/**
 * What the bot is allowed to say (T-183).
 *
 * Two rules from DESIGN.md, both of which a bot breaks more easily than a screen
 * does — a chat message is written in a hurry, in a string literal, by whoever
 * is adding a feature.
 *
 * **No emoji as an icon.** "Icons are drawn on a 24px grid — never emoji, in any
 * surface, including bot messages." A bot is where emoji creep in first, because
 * they are the cheapest way to make a message look friendly, and they render
 * differently on every device, read as gibberish to a screen reader, and carry
 * none of the meaning they appear to.
 *
 * **No streak-loss language.** "Keep the streak visible but consequence-free: a
 * missed day is drawn as a lighter cell with a plain explanation." A student who
 * missed a day was revising for a different exam, or working, or ill. Telling
 * them they have *lost* something is the mechanic that makes people delete the
 * app rather than open it, and it is a lie besides — nothing was taken away.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every source file the bot ships, excluding tests. */
const FILES = readdirSync(HERE)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => ({ name: f, source: readFileSync(resolve(HERE, f), 'utf8') }));

/**
 * Only what the bot actually says.
 *
 * Comments are stripped first — this file's own rules are explained at length in
 * the files it checks, and a lint that flags the note documenting its own rule
 * gets weakened rather than obeyed. Learned three times over in `apps/web`; the
 * order of the passes is the same, and for the same reasons.
 */
function spokenCopy(source: string): string {
  const withoutLineComments = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const withoutBlocks = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks
    .split('\n')
    .filter((line) => !line.trim().startsWith('*'))
    .join('\n');
}

const COPY = FILES.map((f) => ({ ...f, copy: spokenCopy(f.source) }));

/**
 * The emoji and pictograph blocks.
 *
 * `\u{FE0F}`, the variation selector, is deliberately **not** in the class: it is
 * a combining character, which makes the class misleading enough that eslint
 * refuses it — and it costs nothing, because a variation selector only ever
 * follows a base emoji that is already in range.
 */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

describe('bot copy (T-183)', () => {
  it('has files to check', () => {
    // Guards the walker: a lint over zero files passes forever.
    expect(FILES.length).toBeGreaterThanOrEqual(3);
  });

  it('still sees the code after comments are stripped', () => {
    // Guards the stripping, including near the end of each file — a guard that
    // only checks the top passes happily while the stripper eats the rest.
    const bot = COPY.find((f) => f.name === 'bot.ts')!;
    expect(bot.copy).toContain('createBot');
    expect(bot.copy).toContain('callbackQuery');
  });

  /**
   * The emoji and pictograph blocks only.
   *
   * Two deliberate exclusions, both found by this test firing on something it
   * should not have:
   *
   * - **Amharic is not an emoji.** A rule written as "any non-ASCII character"
   *   would ban the product's own language, which is the one thing it must
   *   never do.
   * - **Arrows are typography, not icons.** `→` appears throughout this
   *   codebase in prose and in log messages, and the first run of this test
   *   flagged one inside a thrown `Error` — a string no student ever reads.
   *   The rule is about emoji standing in for icons, so the arrow blocks are
   *   out of range.
   */
  it('uses no emoji anywhere it speaks', () => {
    for (const file of COPY) {
      const found = file.copy.match(EMOJI);
      expect(found, `${file.name} says "${found?.[0]}" — icons are drawn, never typed`).toBeNull();
    }
  });

  // The guard on the guard: the pattern must still catch a real one.
  it('would catch an emoji if one were added', () => {
    for (const sample of ['Well done \u{1F525}', 'Correct \u{2705}', '\u{1F44D}']) {
      expect(sample, sample).toMatch(EMOJI);
    }
    // …and must not catch these.
    for (const safe of ['\u1230\u121B\u12ED', 'GET /x \u2192 404', 'Br 500']) {
      expect(safe, safe).not.toMatch(EMOJI);
    }
  });

  /**
   * The banned phrasings, not the word "streak".
   *
   * A streak may be mentioned; it may not be described as something a student
   * lost, broke or is about to. The list is deliberately about the verbs,
   * because those are what carry the threat.
   */
  it('never tells a student they lost or broke something', () => {
    const banned = [
      /streak\s+(lost|broken|gone|ended|reset)/i,
      /(lost|broke|broken|ended)\s+(your|their)\s+streak/i,
      /don'?t\s+lose\s+your/i,
      /you'?ll\s+lose/i,
      /keep\s+your\s+streak\s+alive/i,
      /last\s+chance/i,
      /before\s+it'?s\s+too\s+late/i,
      /you\s+missed/i,
    ];
    for (const file of COPY) {
      for (const pattern of banned) {
        expect(
          file.copy,
          `${file.name} matches ${pattern} — a missed day is consequence-free`,
        ).not.toMatch(pattern);
      }
    }
  });

  // The positive half. A nudge that only says "here is a question" is fine; one
  // that shames somebody into opening it is not, and the difference is a verb.
  it('says what a missed day is, not what it costs', () => {
    const login = readFileSync(join(HERE, 'login.ts'), 'utf8');
    expect(login).toContain('Nothing was signed in');
  });

  /**
   * Every failure a student can hit says what happened and what to do about it.
   * "Something went wrong" is the message that generates a support ticket.
   */
  it('pairs every refusal with a way forward', () => {
    const login = readFileSync(join(HERE, 'login.ts'), 'utf8');
    expect(login).toContain('Open Lomi-Test again for a fresh one');
  });
});
