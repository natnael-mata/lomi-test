/**
 * The code screen refuses a wrong code, and says so there (T-268).
 *
 * **This was reported as "the client never checks the code at all".** It was not
 * quite that — the code was verified at the end, together with the password —
 * but from the outside the difference did not matter. Typing six wrong digits
 * and pressing Continue fired no request, showed no error, and moved straight on
 * to "Choose a password". The tries-remaining counter and the lockout clock were
 * written, translated, tested on the API, and unreachable from the interface.
 *
 * A tester who typed a wrong code three times and got a password screen every
 * time concluded the confirmation step was decorative. That is the correct
 * reading of what the screen did.
 *
 * Read as source text rather than mounted, the same as the other screen guards
 * here: what these protect is that a particular call exists on a particular
 * button, which is exactly what regressed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';
import { en, plainDuration } from '../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const flow = stripComments(readFileSync(resolve(here, 'CodeFlow.tsx'), 'utf8'));

describe('the code screen (T-268)', () => {
  it('asks the server before leaving the code step', () => {
    expect(flow).toContain('api.checkCode(');
    expect(flow).toContain('checkThenContinue');
  });

  /*
   * THE regression. The button used to be `onClick={() => setStep({ kind:
   * 'password', ... })}` — a pure state transition with no request in it, which
   * is why nothing could ever be refused.
   */
  it('does not walk to the password step without asking', () => {
    const continueButton = flow.slice(flow.indexOf('c.codeFlow.continue') - 400, flow.indexOf('c.codeFlow.continue') + 100);
    expect(continueButton).toContain('checkThenContinue');
    expect(continueButton).not.toMatch(/onClick=\{\(\) => setStep\(\{ kind: 'password'/);
  });

  it('renders the tries remaining, and the server refusal verbatim', () => {
    expect(flow).toContain('c.codeFlow.triesLeft');
    expect(flow).toContain('refusal.message');
  });

  /**
   * One sentence about the time, not two.
   *
   * The screen printed the server's "This number is locked until 19:40."
   * directly above its own "You can try again at 07:40 PM." — one instant,
   * twice, in two locale formats, which reads as two deadlines. The server owns
   * the sentence now, because the bot needs the time in the prose too, so this
   * side must not format `retryAt` a second time.
   */
  it('does not restate the reopening time in its own words', () => {
    expect(flow).not.toContain('tryAgainAt');
    expect(flow).not.toContain('toLocaleTimeString');
    expect(en.codeFlow).not.toHaveProperty('tryAgainAt');
  });

  /**
   * The screen must not claim an SMS went out when the server refused to send.
   *
   * `/reset` rendered "We sent a six-digit code to 0963424628" on a 429, with
   * the only hint being a resend countdown in the thousands of seconds. A
   * student then waits for a message nobody sent.
   */
  it('does not claim a code was sent when none was', () => {
    expect(flow).toContain('c.codeFlow.notSentYet');
    expect(flow).toContain('sent: false');
    expect(en.codeFlow.notSentYet('0913000000').toLowerCase()).toContain('not sent');
  });

  /*
   * The refusal has to reach the student on a RESEND too, which is the case
   * that was silent: the 429 branch only rewrote the step when arriving from
   * the phone screen, so pressing "Send another code" and being refused
   * restarted the countdown under a line still reading "We sent a six-digit
   * code to 0913…".
   */
  it('drops the sent claim when a resend is refused, not only a first send', () => {
    expect(flow).toContain("s.kind === 'code'");
    expect(flow).toContain('{ ...s, sent: false }');
  });
});

describe('sign-in refusals name the right culprit (T-268)', () => {
  const signIn = stripComments(readFileSync(resolve(here, 'PasswordSignIn.tsx'), 'utf8'));

  /**
   * A 500 is not a wrong password.
   *
   * Every non-429 failure rendered "That phone number and password do not match
   * an account", so a service returning 500 to every sign-in told each student
   * their password was wrong. Seven accounts, one broken environment variable,
   * and an evening of retyping a password that was never the problem.
   */
  it('only blames the password on a 401', () => {
    expect(signIn).toContain('status === 401');
    expect(signIn).toContain('c.signIn.signInFailed');
    expect(signIn).toContain('c.signIn.signInBroken');
    // Clears the reader explicitly. The whole cost of this bug was students
    // retyping a password that was never wrong.
    expect(en.signIn.signInBroken.toLowerCase()).toContain('password is fine');
    expect(en.signIn.signInBroken.toLowerCase()).not.toContain('do not match');
  });

  it('says the rate-limit wait in words, not raw seconds', () => {
    expect(en.signIn.tooMany(525)).toContain('9 minutes');
    expect(en.signIn.tooMany(525)).not.toContain('525');
    expect(en.signIn.tooMany(86234)).not.toMatch(/\d{3,}/);
  });
});

describe('waits said in words (T-268)', () => {
  /*
   * An escalated rate limiter hands back numbers like 84238. "Try again in
   * 84238 seconds" is a sum, and the answer to it is "tomorrow".
   */
  it('keeps seconds only while seconds are readable', () => {
    expect(plainDuration(28)).toBe('28s');
    expect(plainDuration(60)).toBe('60s');
  });

  it('turns long waits into minutes and hours', () => {
    expect(plainDuration(1103)).toBe('18 minutes');
    expect(plainDuration(3600)).toBe('an hour');
    expect(plainDuration(84238)).toBe('23 hours');
  });

  it('never renders a bare four-figure second count', () => {
    for (const seconds of [90, 600, 1103, 5000, 84238]) {
      expect(plainDuration(seconds)).not.toMatch(/^\d{3,}s$/);
    }
  });
});
