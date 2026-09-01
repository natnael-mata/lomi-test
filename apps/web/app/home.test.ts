/**
 * The front door (T-198).
 *
 * This screen replaced the Phase 0 scaffold, which was still shipping "Screens
 * land from Phase 4 onward" and a row of design-system probes to anybody who
 * opened the deployed site. Most of what is checked here is that it cannot
 * regress to that: the scaffold is gone, every real surface is reachable, and
 * the links survive without JavaScript.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';
import { en } from '../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const screen = stripComments(readFileSync(resolve(here, 'HomeScreen.tsx'), 'utf8'));
const page = readFileSync(resolve(here, 'page.tsx'), 'utf8');

describe('the home screen (T-198)', () => {
  it('still has code left after the comments are stripped', () => {
    expect(screen).toContain('c.home.goCheckout');
    expect(screen.length).toBeGreaterThan(1200);
  });

  /** The thing this screen exists to stop coming back. */
  it('is not the scaffold any more', () => {
    for (const artefact of ['probe-brand', 'probe-btn', 'probe-num', 'Scaffold placeholder']) {
      expect(page, artefact).not.toContain(artefact);
      expect(screen, artefact).not.toContain(artefact);
    }
  });

  /**
   * Every student-facing surface, reachable in one tap. Before this screen,
   * only `/practice` was reachable without typing a URL — which made the rest
   * of the product invisible from its own front page.
   */
  it('reaches every student surface', () => {
    for (const href of ['/practice', '/exam', '/progress', '/standing', '/checkout']) {
      expect(screen, href).toContain(`'${href}'`);
    }
  });

  /**
   * Plain anchors, not a router push. These are page transitions; they work
   * before the JavaScript arrives, and on a slow connection that difference is
   * the product working or not.
   */
  it('links with anchors that work without JavaScript', () => {
    expect(screen).toContain('<a');
    expect(screen).not.toContain('router.push');
    expect(screen).not.toContain('useRouter');
  });

  it('says what each destination is, not just its name', () => {
    // Five bare nouns make somebody guess, and a stressed student guesses wrong.
    for (const key of [
      'goPracticeWhy',
      'goExamWhy',
      'goProgressWhy',
      'goStandingWhy',
      'goCheckoutWhy',
    ] as const) {
      expect(screen, key).toContain(`c.home.${key}`);
      expect(en.home[key].split(/\s+/).length, key).toBeGreaterThan(4);
    }
  });

  /**
   * The signed-out card answers "and if I have no account?" (T-268).
   *
   * It used to assert the word "password", which was checking that the card
   * explained *why sign-in went through Telegram* — a door removed with T-263.
   * The card then said "Open Lomi-Exams from the Telegram bot" while `/signin`
   * asked for a phone and a password and `/signup` sent an SMS code: three
   * stories about how to get in, and a tester followed the wrong one.
   *
   * What has to hold now is that somebody with no account is told what to do,
   * and that both routes are reachable from here.
   */
  it('tells a visitor with no account what to do', () => {
    expect(screen).toContain('c.home.signedOutWhy');
    expect(en.home.signedOutWhy.toLowerCase()).toContain('new here');
    expect(screen).toContain('/signup');
    expect(screen).toContain('/signin');
  });

  /** No door that no longer exists. Telegram sign-in went with T-263. */
  it('does not send a signed-out visitor to a bot', () => {
    for (const line of [en.home.signedOut, en.home.signedOutWhy]) {
      expect(line.toLowerCase()).not.toContain('telegram');
      expect(line.toLowerCase()).not.toContain('bot');
    }
  });

  /**
   * Nothing on this screen is a gate. It only decides which sentence to show —
   * the API refuses on its own, and a home page that tried to enforce access
   * would be a second opinion about it.
   */
  it('gates nothing on the session check', () => {
    expect(screen).toContain("{ kind: 'signedOut' }");
    expect(screen).not.toContain('redirect');

    /*
     * The screen may navigate, but only because somebody pressed something.
     *
     * It used to be enough to say "no `window.location` anywhere", and then
     * sign-out arrived — a deliberate action whose whole job is to leave. The
     * rule was never "never navigate"; it is that *the session check* must not,
     * because a home page enforcing access is a second opinion about it. So the
     * check is now on where the navigation sits rather than on whether it
     * exists: inside an `onClick`, never in the effect that reads the session.
     */
    const effect = screen.slice(screen.indexOf('useEffect('), screen.indexOf('const destinations'));
    expect(effect).not.toContain('window.location');
    for (const call of screen.match(/window\.location\.assign\([^)]*\)/g) ?? []) {
      const at = screen.indexOf(call);
      const handler = screen.lastIndexOf('onClick', at);
      expect(handler, call).toBeGreaterThan(-1);
      // And in the handler that immediately precedes it, not one far above.
      expect(at - handler).toBeLessThan(400);
    }
  });

  it('takes its words from the dictionary rather than the file', () => {
    const sentences = screen.match(/>[A-Z][a-z]+ [a-z]{2,}[^<>{}]*</g) ?? [];
    // "Lomi-Exams" is the product's name, not copy to translate.
    expect(sentences.filter((s) => !s.includes('Lomi-Exams'))).toEqual([]);
  });
});
