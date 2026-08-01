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
