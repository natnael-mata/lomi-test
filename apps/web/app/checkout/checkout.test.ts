/**
 * What the checkout may and may not do (T-142, T-154).
 *
 * The payment logic is proved on the API side, in `chapa.test.ts` and
 * `chapa.e2e.test.ts`. What is checked here is what only this screen can get
 * wrong: that all four ways to pay are offered rather than three plus a "more"
 * menu, that the client never decides a payment succeeded, and that the return
 * page treats Chapa's query string as the untrusted input it is.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { en } from '../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const raw = {
  checkout: readFileSync(resolve(here, 'CheckoutScreen.tsx'), 'utf8'),
  ret: readFileSync(resolve(here, 'return/ReturnScreen.tsx'), 'utf8'),
};

// Comments are stripped so a claim written *about* the code cannot satisfy an
// assertion *about* the code. Every check below runs on the stripped source.
const code = {
  checkout: stripComments(raw.checkout),
  ret: stripComments(raw.ret),
};

describe('the checkout screen (T-142)', () => {
  /**
   * The stripper has silently eaten whole files before, which makes every
   * "does not contain" assertion below pass for the wrong reason. Anchored on
   * something near the *end* of each file, not the start.
   */
  it('still has code left after the comments are stripped', () => {
    expect(code.checkout).toContain('c.checkout.pay');
    expect(code.checkout.length).toBeGreaterThan(2000);
    expect(code.ret).toContain('c.checkout.yourReference');
    expect(code.ret.length).toBeGreaterThan(500);
  });

  /**
   * All four, flat.
   *
   * On a phone in Ethiopia the right one depends on which wallet the student's
   * family uses. Hiding three behind a "more payment methods" tap makes that
   * choice look like an edge case, and the tap is where people give up.
   */
  it('offers all four ways to pay on one screen', () => {
    for (const method of ['telebirr', 'cbebirr', 'chapa', 'bank']) {
      expect(code.checkout, method).toContain(`'${method}'`);
    }
  });

  it('says what each one will do before it is chosen', () => {
    // A student choosing between four wallets should not have to press one to
    // find out whether it opens a page or rings their phone.
    for (const key of ['telebirrHow', 'cbebirrHow', 'chapaHow', 'bankHow'] as const) {
      expect(code.checkout, key).toContain(`c.checkout.${key}`);
      expect(en.checkout[key].length, key).toBeGreaterThan(20);
    }
  });

  /**
   * The rule the whole payment module is built on, restated where it is easiest
   * to break: nothing in the browser concludes that money arrived. The client
   * asks the server, which asks Chapa.
   */
  it('never decides for itself that a payment succeeded', () => {
    // The only thing that moves this screen to `confirmed` is the server's own
    // CONFIRMED, read back from `paymentStatus`.
    expect(code.checkout).toContain("status.status === 'CONFIRMED'");
    expect(code.checkout).toContain('api.paymentStatus');
  });

  it('keeps asking rather than giving up on one failed poll', () => {
    // A dropped request is not a dropped payment, and the money has already
    // left the student's account by the time this screen is showing.
    expect(code.checkout).toContain('setInterval');
    expect(code.checkout).toContain('clearInterval');
  });

  /** T-154: the reference is on the screen, not only in a receipt. */
  it('shows the reference on every outcome a student is left looking at', () => {
    expect(code.checkout.match(/c\.checkout\.yourReference/g)?.length ?? 0).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('takes its words from the dictionary rather than the file', () => {
    // The i18n sweep (T-210) covers this globally; asserted here too because a
    // payment screen is the one most likely to grow an English-only string in a
    // hurry.
    const sentences = code.checkout.match(/>[A-Z][a-z]+ [a-z]{2,}[^<>{}]*</g) ?? [];
    expect(sentences, sentences.join(' | ')).toEqual([]);
  });
});

describe('coming back from Chapa (T-142)', () => {
  /**
   * The attack this page has to survive is trivial: type the return URL with
   * `status=success`. So the status parameter is not read at all.
   */
  it('ignores the status Chapa puts in the URL', () => {
    expect(code.ret).not.toContain("'status'");
    expect(code.ret).not.toContain('status=success');
    // It reads only the reference, and only to ask our own server about it.
    expect(code.ret).toContain("params.get('trx_ref')");
    expect(code.ret).toContain('api.paymentStatus');
  });

  it('works for somebody who closed the tab and came back later', () => {
    // No state of its own: the reference in the URL is the whole input, so a
    // reload is as good as staying on the page.
    expect(code.ret).not.toContain('sessionStorage');
    expect(code.ret).not.toContain('localStorage');
  });

  it('is honest when the wait is going on too long', () => {
    expect(code.ret).toContain('SLOW_AFTER_MS');
    expect(code.checkout).toContain('SLOW_AFTER_MS');
    expect(en.checkout.stillWaiting.length).toBeGreaterThan(40);
  });
});

describe('the copy', () => {
  it('names the fix, not only the fault', () => {
    // "Payment failed" leaves somebody stranded over money. Each of these says
    // what to do next or what is not lost.
    for (const key of ['couldNotStart', 'unavailable', 'mobileInvalid', 'txRefTaken'] as const) {
      expect(en.checkout[key].split(/\s+/).length, key).toBeGreaterThan(6);
    }
  });

  it('does not promise a speed the manual route cannot keep', () => {
    // A person reads a bank statement. "Instant" would be a lie on this route,
    // and the one it would be told to is somebody who has already paid.
    expect(en.checkout.manualPending.toLowerCase()).not.toContain('instant');
    expect(en.checkout.manualPending.toLowerCase()).not.toContain('immediately');
  });
});
