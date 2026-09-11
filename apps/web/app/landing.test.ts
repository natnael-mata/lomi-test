/**
 * The public page ships nothing unfinished (T-269).
 *
 * **It was shipping our homework.** A visitor's first sight of the product
 * included two dashed-red editorial notes — "school-track prices to confirm",
 * "household policy for Grade 6/8 to confirm" — three contact cards whose
 * address was the words "to add", and three bordered social chips reading
 * "Facebook link", "TikTok link", "Telegram link" that went nowhere. In the
 * colour the app uses for a wrong answer. A tester reported all of it as page
 * content, which is what it was.
 *
 * The markers are worth keeping — they are the list of what is still owed — so
 * they render in development and nowhere else, and anything they stand in for
 * is absent rather than half-drawn.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const landing = stripComments(readFileSync(resolve(here, 'LandingScreen.tsx'), 'utf8'));

describe('the landing page (T-269)', () => {
  /* THE regression. `Todo` rendered unconditionally. */
  it('renders editorial notes in development only', () => {
    expect(landing).toContain("process.env.NODE_ENV !== 'development'");
    const todo = landing.slice(landing.indexOf('function Todo'), landing.indexOf('function Head'));
    expect(todo).toContain('return null');
  });

  /**
   * A card that cannot be acted on should not be drawn.
   *
   * Hiding the markers alone would have left three contact cards promising a
   * reply through a channel with no address on it, and three social buttons
   * that are buttons in every respect except going anywhere.
   */
  it('draws a contact only when it has something to contact', () => {
    expect(landing).toContain('contact.value !== null');
    expect(landing).toContain('CONTACTS.filter');
  });

  it('draws a social link only when there is a link', () => {
    expect(landing).toContain('SOCIALS.length > 0');
    expect(landing).toContain('href={href}');
  });

  /**
   * The FAQ looks answerable, because it is.
   *
   * `list-none` stripped the disclosure triangle and nothing replaced it, so
   * six questions with six written answers sat as plain bold text with no
   * affordance of any kind — and were read, reasonably, as questions printed
   * without answers.
   */
  it('gives every FAQ row a visible disclosure control', () => {
    expect(landing).toContain('group-open:rotate-45');
    expect(landing).toContain("<Icon name=\"plus\"");
  });

  /**
   * The two figures keep their own meanings (T-269).
   *
   * `/progress` distinguishes them in as many words — coverage is "how much of
   * the whole exam you have beaten", readiness is "how you are doing on the
   * questions you have tried" — and this page defined *readiness* using
   * coverage's definition. A student arrived taught the wrong one and then met
   * both figures on the same screen.
   */
  it('does not define readiness as a count of questions beaten', () => {
    const claim = /(\w+) is a count of questions you have beaten/.exec(landing)?.[1];
    expect(claim, 'the honest-numbers claim has moved').toBeTruthy();
    expect(claim!.toLowerCase()).toBe('coverage');
  });

  /** No invented facts, which is this product's whole position. */
  it('states no contact detail that has not been supplied', () => {
    expect(landing).not.toMatch(/\+251\s*9\d/);
    expect(landing).not.toMatch(/@[a-z0-9_]+\.(com|et)/i);
  });
});
