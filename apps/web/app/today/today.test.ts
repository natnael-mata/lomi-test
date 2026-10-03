/**
 * Today, the signed-in hub (T-198, redesigned 2026-10-01).
 *
 * This was `home.test.ts`, guarding `HomeScreen`. The hub moved to `/today` in
 * the redesign and `/home` redirects there; every rule below was written about
 * the hub rather than about an address, so they moved with it.
 *
 * The screen replaced the Phase 0 scaffold, which was still shipping "Screens
 * land from Phase 4 onward" and a row of design-system probes to anybody who
 * opened the deployed site. Most of what is checked here is that it cannot
 * regress to that, and that each figure it shows comes from the API.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { DESTINATIONS } from '../../components/Navigation';
import { en } from '../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const screen = stripComments(readFileSync(resolve(here, 'TodayScreen.tsx'), 'utf8'));
const page = readFileSync(resolve(here, 'page.tsx'), 'utf8');

describe('Today, the hub (T-198)', () => {
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
   * Every student-facing surface is reachable in one tap — from the navigation
   * (T-269).
   *
   * This used to assert it of `/home` itself, and was written when it was true
   * of nothing else: at the time only `/practice` could be reached without
   * typing a URL, so the hub listing all five was the fix. The navigation now
   * carries six destinations at every width, which makes the hub's copy of them
   * a second menu on one screen rather than the only one.
   *
   * So the rule moves to where it is actually kept. What `/home` owes is
   * checked above: the student's own state, one action, and Ask.
   */
  it('reaches every student surface from the navigation', () => {
    const hrefs = new Set(DESTINATIONS.map((d) => d.href));
    // The five the redesign puts in the bar. The three it took out — Access,
    // Standing and Ask — are checked in `layout-measure.test.ts`, which asserts
    // each is still linked from the screen that absorbed it.
    for (const href of ['/today', '/practice', '/mocks', '/progress', '/account']) {
      expect(hrefs, href).toContain(href);
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

  /**
   * The five destination tiles are gone, and must not come back (T-269).
   *
   * They were Practise, Mock exam, Progress, Where you stand and Get full
   * access — the same five the navigation bar carries directly above, in the
   * same order, minus Ask. A menu printed twice on one screen, the second copy
   * incomplete.
   *
   * **Restated for the redesign.** This used to forbid any `href="/progress"`
   * at all. The handoff's topic block ends in "All 9 topics →", which is a
   * contextual link from a summary to its detail, not a tile in a second menu —
   * and forbidding the literal would only have taught the code to hide the
   * href in a variable, which is the guard passing on silence. So the rule is
   * now the thing it meant: no list of destinations, and no destination linked
   * more than once.
   */
  it('does not reprint the navigation bar as body content', () => {
    expect(screen).not.toContain('DESTINATIONS');
    expect(screen).not.toMatch(/c\.nav\./);
    for (const href of ['/practice', '/exam', '/mocks', '/progress', '/standing', '/account']) {
      const links = screen.split(`href="${href}"`).length - 1;
      expect(links, `${href} linked ${links} times`).toBeLessThanOrEqual(1);
    }
  });

  /**
   * Every figure has a source (redesign).
   *
   * The handoff's Today is full of numbers, and the risk in rebuilding it is
   * copying one. These are the reads each block depends on; and the phrases
   * below are the handoff's sample figures that have no source here, which must
   * never appear as literals.
   */
  it('reads every figure from the API', () => {
    for (const call of [
      'api.coverage(',
      'api.readiness(',
      'api.practiceSummary(',
      'api.trend(',
      'api.standing(',
      'api.pointsLedger(',
    ]) {
      expect(screen, call).toContain(call);
    }
    for (const invented of [
      'Week 9',
      'of 15',
      '25 minutes',
      'opens Saturday',
      '43',
      '62%',
      '1,240',
    ]) {
      expect(screen, `handoff sample "${invented}" copied in`).not.toContain(invented);
    }
  });

  /**
   * One failing endpoint does not blank the page.
   *
   * Six reads feed six blocks; `Promise.all` would let a slow leaderboard take
   * down the countdown.
   */
  it('settles its reads independently', () => {
    expect(screen).toContain('Promise.allSettled');
  });

  /**
   * The streak is never "in a row".
   *
   * `streakDays` is a count of distinct days, ever, and nothing subtracts from
   * it (T-191). The handoff's "9 study days in a row" would tell somebody who
   * missed a day that their number is wrong, or about to be taken.
   */
  it('does not call the study-day count consecutive', () => {
    for (const n of [1, 9]) {
      expect(en.today.streak(n).toLowerCase()).not.toContain('in a row');
    }
    expect(en.today.streakWhy.toLowerCase()).not.toContain('ends');
  });

  /**
   * The week row is drawn only when the ledger page covers the week.
   *
   * Each answer earns ledger rows, so a full page can stop days short of a
   * week — and the days past it would be drawn as empty although they were
   * studied.
   */
  it('omits the week rather than drawing it from a short page', () => {
    expect(screen).toContain('LEDGER_PAGE');
    expect(screen).toMatch(/if \(!complete\) return null/);
  });

  /**
   * Ask is the exception, and says what it is.
   *
   * It is in the bar too, but it is the one destination a student does not
   * reach by habit — the rest are where the daily loop lives. A bare noun makes
   * somebody guess, and a stressed student guesses wrong.
   */
  it('keeps Ask, and explains it', () => {
    expect(screen).toContain('href="/community"');
    expect(screen).toContain('c.home.goAskWhy');
    expect(en.home.goAskWhy.split(/\s+/).length).toBeGreaterThan(4);
  });

  /**
   * One action, and it changes with the state.
   *
   * `/home` had no primary action at all in the state that most needed one: a
   * paywalled student was told "Your free questions are used up" in caption
   * text with nothing attached, and the way out was the fifth of five tiles
   * styled exactly like the four that would no longer do anything for them.
   * Meanwhile a student who had not chosen a programme got a proper dark
   * button — so the product was clearest with the least urgent problem.
   */
  it('offers exactly one primary action, chosen from the state', () => {
    expect(screen).toContain('data-next-step');
    expect(screen).toContain('nextStep');
    // The three it picks between, and the wall is one of them.
    expect(screen).toContain("'/choose'");
    expect(screen).toContain("'/checkout'");
    expect(screen).toContain("'/practice'");
    expect(screen).toContain('freeRemaining === 0');
    // One button, not five tiles competing at equal weight.
    expect((screen.match(/btn-primary/g) ?? []).length).toBeLessThanOrEqual(2);
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
    const start = screen.indexOf('useEffect(');
    const end = screen.indexOf('const nextStep');
    // Guards the guard. This bounded on `const destinations`, which was renamed
    // — `indexOf` returned -1, the slice became almost the whole file, and the
    // assertion went on passing while checking something else entirely.
    expect(start, 'the session effect moved').toBeGreaterThan(-1);
    expect(end, 'the slice boundary no longer exists').toBeGreaterThan(start);
    expect(screen.slice(start, end)).not.toContain('window.location');
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
