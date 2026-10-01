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
  /**
   * THE regression, and its second draft.
   *
   * `Todo` first rendered unconditionally, so the public page carried six
   * dashed-red editorial notes. Gating on `NODE_ENV` was the obvious fix and
   * still wrong: QA tests the dev server, so "hidden in production" meant
   * visible in every environment anybody actually looks at — and the same six
   * came back as reported findings a round later.
   *
   * The default is the finished page everywhere. The outstanding list is opt-in.
   */
  it('hides editorial notes unless they are explicitly asked for', () => {
    expect(landing).toContain("process.env.NEXT_PUBLIC_SHOW_TODOS !== '1'");
    expect(landing).not.toContain('NODE_ENV');
    const todo = landing.slice(landing.indexOf('function Todo'), landing.indexOf('function Head'));
    expect(todo).toContain('return null');
  });

  /**
   * Every FAQ row is the same kind of thing.
   *
   * The household question sat outside the list as a bare `<div>` styled like
   * the six above it — same border, same padding, same type — with its answer
   * printed inline and no disclosure marker. It read as a row that invites a
   * tap and does nothing, which is what it was: special-cased because it
   * carried a placeholder, then never converted when the rest became
   * collapsible.
   */
  it('keeps every FAQ row in one list, with one behaviour', () => {
    expect(landing).toContain('Can I share one account with a friend?');
    // Not rendered outside `FAQ.map`, which is what made it inert.
    const faqSection = landing.slice(landing.indexOf('id="faq"'), landing.indexOf('id="contact"'));
    expect(faqSection).not.toContain('Two devices can be signed in at once.');
  });

  /**
   * The primary button goes where the copy points.
   *
   * It linked to `/signin` — a phone-and-password form — under recruitment copy
   * promising free questions and no card, so a first-time visitor's one press
   * landed on a password they had never set.
   */
  it('sends the hero CTA to sign-up, not sign-in', () => {
    const hero = landing.slice(0, landing.indexOf('id="how"'));
    expect(hero).toContain('href="/signup"');
  });

  /**
   * Nothing looks chosen unless it can be.
   *
   * One track card and one price card were filled brand yellow among pale
   * siblings, on a section headed "Choose the exam you are sitting" — and all
   * seven were inert `<div>`s. A card that reads as selected and cannot be
   * selected is a trap on the page whose whole job is picking one.
   */
  it('makes the emphasised cards pressable, and says why they are emphasised', () => {
    const tracks = landing.slice(landing.indexOf('id="tracks"'), landing.indexOf('id="faq"'));
    expect(tracks).not.toContain('<div\n              key={name}');
    expect(tracks).toContain('most students');
    expect(tracks).toContain('best value');
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
  /*
   * The anchor moved with the redesign, the rule did not.
   *
   * It used to match "`X` is a count of questions you have beaten" and assert
   * that X was `coverage` — a sentence in an "about the numbers" section the
   * redesign has no slot for. The FAQ row below was already carrying the same
   * distinction in more words, so the prose was not re-added; the test now holds
   * the row that survived, which is where a reader looks for it anyway.
   *
   * What must stay true: both figures are defined, and readiness is defined by
   * *what you have tried* rather than by a count of the whole track.
   */
  it('does not define readiness as a count of questions beaten', () => {
    const row = /That is your coverage\.[^']*/.exec(landing)?.[0];
    expect(row, 'the honest-numbers FAQ row has moved').toBeTruthy();
    // Coverage: correct AND explainable, out of a stated total.
    expect(row).toContain('answered correctly');
    expect(row).toContain('not lucky guesses');
    // Readiness: the other figure, and over the tried set only.
    expect(row).toContain('Readiness is the other figure');
    expect(row).toContain('questions you have tried');
    // Never the inverse — a readiness defined over the whole track IS coverage.
    expect(landing).not.toMatch(/[Rr]eadiness[^.]*count of questions you have beaten/);
  });

  /** No invented facts, which is this product's whole position. */
  it('states no contact detail that has not been supplied', () => {
    expect(landing).not.toMatch(/\+251\s*9\d/);
    expect(landing).not.toMatch(/@[a-z0-9_]+\.(com|et)/i);
  });
});
