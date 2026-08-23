/**
 * The SMS provider's contract, held without sending anything (T-264).
 *
 * Every message costs money, so the parts worth testing are deliberately pure:
 * what we send, and what we conclude from what comes back. The one thing this
 * cannot cover is whether smsethiopia.com honours its own documented shape —
 * that needs one real send, and it is the only part that does.
 */
import { describe, expect, it } from 'vitest';

import { buildHeaders, buildRequest, readResponse, toMsisdn } from './sms-ethiopia';

describe('the number the provider is given', () => {
  it('turns a stored number into an msisdn', () => {
    // The exact shape from the provider's own documentation.
    expect(toMsisdn('0943016897')).toBe('251943016897');
    expect(toMsisdn('0712345678')).toBe('251712345678');
  });

  /*
   * THE test. `0943016897` is a perfectly ordinary string and a phone number
   * nowhere on earth — a provider handed one either rejects it or, worse,
   * accepts it and delivers to nobody while charging for the attempt.
   */
  it('refuses anything that is not an Ethiopian mobile', () => {
    for (const bad of ['943016897', '251943016897', '+251943016897', '0843016897', '09430168', '']) {
      expect(toMsisdn(bad)).toBeNull();
    }
  });

  it('will not build a request for an empty message', () => {
    // A send that costs money and delivers nothing.
    expect(buildRequest('0943016897', '')).toBeNull();
  });

  it('builds the documented body', () => {
    expect(buildRequest('0943016897', 'Hello World')).toEqual({
      msisdn: '251943016897',
      text: 'Hello World',
    });
  });

  it('puts the key in a header and nowhere else', () => {
    const headers = buildHeaders('SECRET-KEY:210');
    expect(headers.KEY).toBe('SECRET-KEY:210');
    expect(headers['Content-Type']).toBe('application/json');
    // A credential in a body or a query string ends up in logs and proxies.
    expect(JSON.stringify(buildRequest('0943016897', 'hi'))).not.toContain('SECRET-KEY');
  });
});

describe('what the provider’s reply means', () => {
  it('accepts a plain success', () => {
    expect(readResponse(200, { status: 'sent' })).toEqual({ ok: true });
    expect(readResponse(201, null)).toEqual({ ok: true });
  });

  /*
   * THE other one. Gateways of this shape answer 200 with a failure in the
   * body, and reading the status line alone reports "code sent" to a student
   * who will never receive one.
   */
  it('does not call a 200 a success when the body says otherwise', () => {
    for (const body of [
      { status: 'failed' },
      { status: 'ERROR' },
      { success: false },
      { error: 'insufficient balance' },
    ]) {
      const outcome = readResponse(200, body);
      expect(outcome.ok).toBe(false);
    }
  });

  it('repeats the provider’s own explanation', () => {
    const outcome = readResponse(200, { status: 'failed', message: 'insufficient balance' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.because).toContain('insufficient balance');
  });

  it('does not read an unfamiliar success shape as a failure', () => {
    // A provider adding a field must not break registration for everybody.
    expect(readResponse(200, { messageId: 'abc', segments: 1 })).toEqual({ ok: true });
    expect(readResponse(200, { status: 'queued' })).toEqual({ ok: true });
  });

  it('separates what will never work from what to try again', () => {
    // A rejected key should page somebody; a 500 should not.
    for (const status of [401, 403, 400, 422]) {
      const outcome = readResponse(status, null);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.retryable).toBe(false);
    }
    for (const status of [429, 500, 502, 503]) {
      const outcome = readResponse(status, null);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.retryable).toBe(true);
    }
  });

  /*
   * The provider's real replies, captured from the live endpoint on
   * 2026-08-23 rather than guessed.
   *
   * The first pass guessed `message`/`error`/`description` and this provider
   * uses none of them — a rejected send would have been logged as "SMS not
   * delivered" with the reason dropped, which is the difference between a
   * one-line fix and an afternoon.
   */
  describe('smsethiopia.com, as it actually answers', () => {
    it('repeats the reason from a real rejection', () => {
      const outcome = readResponse(400, {
        error_message:
          'Invalid MSISDN (phone number). It should start with 2519 and be 12 digits long. Error code :: 10000',
      });
      expect(outcome.ok).toBe(false);
      // Never worth retrying: the number will not change on its own.
      if (!outcome.ok) expect(outcome.retryable).toBe(false);
    });

    it('reads error_message as a failure even on a 2xx', () => {
      const outcome = readResponse(200, { error_message: 'Insufficient balance' });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.because).toContain('Insufficient balance');
    });

    it('treats a refused key as unrecoverable', () => {
      // The exact 401 body the endpoint returns for a missing or wrong key.
      const outcome = readResponse(401, {
        timestamp: '2026-08-23T22:33:27.346+00:00',
        path: '/api/sms/send',
        status: 401,
        error: 'Unauthorized',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.retryable).toBe(false);
    });

    /*
     * The provider states 2519 — Ethio Telecom. Safaricom Ethiopia numbers are
     * 07…, which `normaliseEthiopianMobile` accepts and this turns into 2517…,
     * a well-formed msisdn this gateway says it will not take. The conversion
     * stays correct on purpose: the send then fails loudly with the provider's
     * own words rather than being silently dropped here, which is the only way
     * anybody finds out whether the account covers Safaricom.
     */
    it('still builds a 2517 msisdn for a Safaricom number', () => {
      expect(toMsisdn('0712345678')).toBe('251712345678');
      expect(toMsisdn('0712345678')).toHaveLength(12);
    });
  });

  it('bounds what it will repeat from another service', () => {
    const outcome = readResponse(200, { status: 'failed', message: 'x'.repeat(5000) });
    expect(outcome.ok).toBe(false);
    // Someone else's service must not decide the size of our log lines.
    if (!outcome.ok) expect(outcome.because.length).toBeLessThan(300);
  });
});
