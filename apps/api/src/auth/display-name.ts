/**
 * Generating a student's public handle.
 *
 * PRODUCT.md is explicit: a verified real name is **never** shown on any public
 * surface, and leaderboards use a student-chosen display name. So the default
 * cannot be derived from the legal name, or from the Telegram name either — a
 * Telegram profile usually *is* the person's real name, and copying it into the
 * public handle leaks exactly what the rule protects (T-086).
 *
 * The generated handle is therefore unrelated to anything the person supplied.
 */
import { randomInt } from 'node:crypto';

/**
 * Words chosen to be neutral in both English and Amharic-speaking use: no
 * animals with local pejorative senses, nothing religious, nothing gendered.
 */
const ADJECTIVES = [
  'Bright',
  'Calm',
  'Clever',
  'Eager',
  'Keen',
  'Kind',
  'Quiet',
  'Ready',
  'Steady',
  'Swift',
] as const;

const NOUNS = [
  'Acacia',
  'Basalt',
  'Comet',
  'Delta',
  'Ember',
  'Harbour',
  'Lantern',
  'Meadow',
  'Summit',
  'Willow',
] as const;

/**
 * A handle like `SwiftSummit4821`.
 *
 * The number is there so two students who draw the same pair are still
 * distinguishable in a leaderboard; `displayName` is not unique in the schema
 * because forcing uniqueness would mean rejecting a name a student chose
 * themselves because a stranger got there first.
 */
export function generateDisplayName(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)]!;
  const noun = NOUNS[randomInt(NOUNS.length)]!;
  // 4 digits: enough that a collision inside one pair is unlikely, short enough
  // to read out loud.
  const suffix = String(randomInt(1000, 10000));
  return `${adjective}${noun}${suffix}`;
}

/**
 * The rules for a name a student chooses (hand off of 2026-10-05).
 *
 * The board shows this to every student on it, so it must not become a way to
 * publish a phone number, pose as the operators, or put the student's own
 * legal name back on a public surface (T-086). It is NOT unique, for the reason
 * given above: refusing a student's choice because a stranger took it first.
 *
 * Returns the cleaned name, or every reason it was refused at once, in words a
 * student can act on.
 */
export const DISPLAY_NAME_MIN = 3;
export const DISPLAY_NAME_MAX = 24;

/**
 * Words that would read as the product or its staff. Matched on letters only,
 * so "L0mi Admin" and "lomi.admin" are caught with "Lomi Admin".
 */
const RESERVED = [
  'admin',
  'staff',
  'lomi',
  'support',
  'official',
  'moderator',
  'reviewer',
  'provider',
];

export type DisplayNameCheck = { ok: true; name: string } | { ok: false; reasons: string[] };

export function checkDisplayName(raw: unknown, legalName?: string | null): DisplayNameCheck {
  if (typeof raw !== 'string') return { ok: false, reasons: ['Type a name.'] };
  // One space between words, none at the ends: "  Swift   Summit " is "Swift Summit".
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  const reasons: string[] = [];
  // Characters as a person counts them, so an Ethiopic name is not measured in
  // code units.
  const length = [...name].length;

  if (length < DISPLAY_NAME_MIN) reasons.push(`Use at least ${DISPLAY_NAME_MIN} characters.`);
  if (length > DISPLAY_NAME_MAX) reasons.push(`Use at most ${DISPLAY_NAME_MAX} characters.`);
  // Letters in any script, the marks Ethiopic and others combine with, digits,
  // spaces, full stops and underscores. Nothing that could pass for a link or
  // markup on the board.
  if (!/^[\p{L}\p{M}\p{Nd} ._]*$/u.test(name)) {
    reasons.push('Use letters, numbers, spaces, full stops or underscores only.');
  }
  if ((name.match(/\p{L}/gu) ?? []).length < 2) reasons.push('Include at least two letters.');
  // Six digits in a row, however they are spaced, is most of a phone number.
  if (/\d{6,}/.test(name.replace(/[ ._]/g, ''))) {
    reasons.push('Leave phone numbers and other long numbers out of it.');
  }

  const letters = name
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/[^\p{L}]/gu, '');
  if (RESERVED.some((word) => letters.includes(word))) {
    reasons.push('Choose a name that does not look like the product or its staff.');
  }

  // The legal name, whole. Every word of it present in any order is the name
  // the board exists to keep private.
  const words = (legalName ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => [...w].length >= 2);
  const lowered = name.toLowerCase();
  if (words.length >= 2 && words.every((w) => lowered.includes(w))) {
    reasons.push('Choose a name that is not your real name. Other students see this one.');
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, name };
}
