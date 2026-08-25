/**
 * The testing door offers every prepared account.
 *
 * **This exists because five accounts were unreachable and nothing failed.**
 * `DEV_PERSONAS` knew User K through User O, `dev-testers.ts` prepared them, the
 * API signed them in, and the leaderboard listed them — but the sign-in screen's
 * own array stopped at User J, so there was no button. A QA pass came back with
 * four of its seven runs unrunnable: the junior band, the Grade 12
 * Natural/Social split and every non-zero coverage figure all sit behind exactly
 * those five accounts.
 *
 * Nothing was broken, which is what made it expensive. A missing button raises
 * no error, logs nothing, and reads as a product that has fewer testers than it
 * has — the tester assumes the list is the truth, because normally it is.
 *
 * So the two lists are held together by name. `student` is excluded on purpose:
 * it is the generic label the API accepts for an ad-hoc account, not a prepared
 * persona with a state worth a button.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TESTERS } from './DevLoginScreen';

/*
 * Read as text, not imported — the same trick `lib/contracts.test.ts` uses.
 * `dev-login.ts` happens to be dependency-free today, but reaching across the
 * workspace with an import makes the web build's typecheck responsible for a
 * file the API owns, and the next thing added to it is not this test's problem.
 */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const source = readFileSync(join(REPO, 'apps/api/src/auth/dev-login.ts'), 'utf8');
const block = /export const DEV_PERSONAS = \[([\s\S]*?)\]/.exec(source);
const DEV_PERSONAS = [...(block?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]!);

/** Accepted by the API but not a prepared persona — no state, so no button. */
const NOT_A_PERSONA = new Set(['student']);

describe('the dev-login screen and the API agree on who exists', () => {
  const offered = TESTERS.map((t) => t.label);
  const prepared = DEV_PERSONAS.filter((p) => !NOT_A_PERSONA.has(p));

  it('found the list it is checking against', () => {
    // A regex that silently matched nothing would make every assertion below
    // pass against an empty array, which is the failure mode this whole file
    // exists to prevent.
    expect(prepared.length).toBeGreaterThan(10);
  });

  it('offers a button for every persona the API prepares', () => {
    // Sorted rather than positional: the order on screen is a reading decision
    // and should be free to change without failing here.
    expect([...offered].sort()).toEqual([...prepared].sort());
  });

  it('offers no button the API would refuse', () => {
    // The other direction, and the worse failure of the two: a button that signs
    // in to nothing tells a tester the account is broken rather than absent.
    for (const label of offered) {
      expect(DEV_PERSONAS).toContain(label);
    }
  });

  it('gives each one a note saying what state it is in', () => {
    for (const tester of TESTERS) {
      // A tester picks by state, never by name — "User K" alone is no help at
      // all in choosing which button reaches the screen you need.
      expect(tester.note.length).toBeGreaterThan(20);
      expect(tester.who).not.toBe(tester.note);
    }
  });

  /*
   * The baked-in phone numbers, against the seed's own arithmetic.
   *
   * The screen posts these to the real `/auth/sign-in`, so a number that has
   * drifted is a button that signs in as nobody — or, worse, as a different
   * persona. They are literals because deriving them in the browser would mean
   * async SHA-256 to render a static list, and mirroring the algorithm would
   * mean two implementations that can disagree. This is the third option: one
   * implementation, and a test that checks the copies.
   *
   * The algorithm is `devTelegramId` in `dev-login.ts` and `phoneFor` in
   * `dev-testers.ts`, reproduced here from the constants those files declare
   * rather than from memory — if the floor or ceiling move, this recomputes and
   * the literals fail.
   */
  describe('the phone numbers on the buttons', () => {
    const floor = Number(/DEV_TELEGRAM_ID_FLOOR = (-?[\d_]+)/.exec(source)![1]!.replace(/_/g, ''));
    const ceiling = Number(
      /DEV_TELEGRAM_ID_CEILING = (-?[\d_]+)/.exec(source)![1]!.replace(/_/g, ''),
    );

    const phoneFor = (label: string): string => {
      const key = label.trim().toLowerCase().replace(/\s+/g, '');
      const digest = createHash('sha256').update(key).digest();
      const id = floor + (digest.readUInt32BE(0) % (ceiling - floor));
      return `09${String(Math.abs(id) % 100_000_000).padStart(8, '0')}`;
    };

    it('read the range out of the API rather than assuming it', () => {
      expect(floor).toBeLessThan(0);
      expect(ceiling).toBeLessThan(0);
      expect(ceiling).toBeGreaterThan(floor);
    });

    it('matches what dev:testers seeds, for every persona', () => {
      for (const tester of TESTERS) {
        expect(tester.phone, `${tester.label} would sign in as the wrong account`).toBe(
          phoneFor(tester.label),
        );
      }
    });

    it('gives every persona a different number', () => {
      // A collision means two buttons that reach one account, and a seed that
      // dies on a unique constraint. It has happened once already.
      const numbers = TESTERS.map((t) => t.phone);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it('uses the reserved 09 range, never a real prefix', () => {
      for (const tester of TESTERS) {
        expect(tester.phone).toMatch(/^09\d{8}$/);
      }
    });
  });

  it('names each label exactly once', () => {
    expect(new Set(offered).size).toBe(offered.length);
  });
});
