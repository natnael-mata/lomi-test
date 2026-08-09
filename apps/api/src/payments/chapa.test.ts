import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CHAPA_DIRECT_TYPE,
  buildTxRef,
  coversQuotedAmount,
  isSuccessfulCharge,
  normaliseEthiopianMobile,
  subscriptionFromTxRef,
  verifyWebhookSignature,
  type ChapaWebhookEvent,
} from './chapa';

const SECRET = 'CHASECK_TEST-not-a-real-key';
const BODY = JSON.stringify({
  event: 'charge.success',
  tx_ref: 'lomi-abc123-Xy9',
  status: 'success',
});

const payloadSig = (body: string, secret = SECRET): string =>
  createHmac('sha256', secret).update(body).digest('hex');
const keySig = (secret = SECRET): string =>
  createHmac('sha256', secret).update(secret).digest('hex');

const event = (over: Partial<ChapaWebhookEvent> = {}): ChapaWebhookEvent => ({
  event: 'charge.success',
  tx_ref: 'lomi-abc123-Xy9',
  status: 'success',
  amount: 500,
  ...over,
});

describe('the transaction reference (T-142)', () => {
  it('carries the subscription it belongs to', () => {
    const ref = buildTxRef('abc123', 'Xy9');
    expect(subscriptionFromTxRef(ref)).toBe('abc123');
  });

  it('is identifiable as ours at a glance', () => {
    // A support conversation should not need a database lookup to know whose
    // reference this is.
    expect(buildTxRef('abc123', 'Xy9').startsWith('lomi-')).toBe(true);
  });

  it('does not claim a reference that is not ours', () => {
    for (const foreign of ['', 'CHAPA-123', 'lomi-', 'something-else', 'lomi-abc123']) {
      expect(subscriptionFromTxRef(foreign), foreign).toBeNull();
    }
  });

  it('separates two purchases made in the same instant', () => {
    expect(buildTxRef('abc123', 'aaa')).not.toBe(buildTxRef('abc123', 'bbb'));
  });
});

describe('webhook signatures (T-143)', () => {
  /**
   * The payload signature is the one that means something, and it is checked
   * first. See `chapa.ts` for why the other header is weaker.
   */
  it('accepts a correct payload signature', () => {
    const result = verifyWebhookSignature(BODY, { payloadSignature: payloadSig(BODY) }, SECRET);
    expect(result).toEqual({ ok: true, via: 'payload' });
  });

  it('refuses a payload signature computed with another key', () => {
    const forged = payloadSig(BODY, 'CHASECK_TEST-someone-elses-key');
    expect(verifyWebhookSignature(BODY, { payloadSignature: forged }, SECRET).ok).toBe(false);
  });

  /**
   * The property the payload signature has and the constant one does not: a
   * body altered in transit no longer matches.
   */
  it('refuses a body that was altered after signing', () => {
    const signature = payloadSig(BODY);
    const tampered = BODY.replace('"success"', '"failed"');
    expect(verifyWebhookSignature(tampered, { payloadSignature: signature }, SECRET).ok).toBe(
      false,
    );
  });

  it('accepts the constant key signature only when the payload one is absent', () => {
    expect(verifyWebhookSignature(BODY, { keySignature: keySig() }, SECRET)).toEqual({
      ok: true,
      via: 'key',
    });

    // Present but wrong payload signature is a refusal, not a fallback — the
    // weaker header must never rescue a failed strong one.
    expect(
      verifyWebhookSignature(
        BODY,
        { payloadSignature: 'deadbeef'.repeat(8), keySignature: keySig() },
        SECRET,
      ).ok,
    ).toBe(false);
  });

  it('refuses a request carrying no signature at all', () => {
    expect(verifyWebhookSignature(BODY, {}, SECRET)).toEqual({ ok: false, via: null });
  });

  /**
   * A verifier that opens when its key is missing is worse than none: it looks
   * like protection in review and is a bypass in whichever environment forgot
   * the variable.
   */
  it('refuses everything when no secret is configured', () => {
    expect(verifyWebhookSignature(BODY, { payloadSignature: payloadSig(BODY) }, '').ok).toBe(false);
  });

  it('survives a malformed signature header rather than throwing', () => {
    for (const bad of ['', 'not-hex', 'zz', '1234']) {
      expect(() => verifyWebhookSignature(BODY, { payloadSignature: bad }, SECRET)).not.toThrow();
      expect(verifyWebhookSignature(BODY, { payloadSignature: bad }, SECRET).ok).toBe(false);
    }
  });

  /**
   * Signed over the raw body. Re-serialising parsed JSON reorders keys and
   * changes whitespace, and the hash of a re-serialised body is the hash of a
   * different document — which presents as "every webhook is forged".
   */
  it('is sensitive to whitespace, which is why the raw body is used', () => {
    const reserialised = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(
      verifyWebhookSignature(reserialised, { payloadSignature: payloadSig(BODY) }, SECRET).ok,
    ).toBe(false);
  });
});

describe('reading the event (T-143, T-144)', () => {
  it('recognises a successful charge', () => {
    expect(isSuccessfulCharge(event())).toBe(true);
    expect(isSuccessfulCharge(event({ status: 'successful' }))).toBe(true);
  });

  /**
   * Chapa sends failures, refunds and reversals through the same endpoint. A
   * handler that keys off the presence of a payload rather than its contents
   * grants access on a refund.
   */
  it('is not fooled by a failure, a refund or a reversal', () => {
    for (const name of [
      'charge.failed',
      'charge.cancelled',
      'charge.refunded',
      'charge.reversed',
    ]) {
      expect(isSuccessfulCharge(event({ event: name })), name).toBe(false);
    }
  });

  // Both must agree: a success event carrying a failed status is not a payment.
  it('requires the event name and the status to agree', () => {
    expect(isSuccessfulCharge(event({ status: 'failed' }))).toBe(false);
    expect(isSuccessfulCharge(event({ event: 'charge.failed', status: 'success' }))).toBe(false);
  });

  it('survives a payload missing the fields it reads', () => {
    expect(() => isSuccessfulCharge({} as ChapaWebhookEvent)).not.toThrow();
    expect(isSuccessfulCharge({} as ChapaWebhookEvent)).toBe(false);
  });
});

describe('checking the amount (T-151, partially)', () => {
  /** Chapa returns amounts as strings, sometimes with decimals. */
  it('reads the amount however it is formatted', () => {
    expect(coversQuotedAmount(500, 500)).toBe(true);
    expect(coversQuotedAmount('500', 500)).toBe(true);
    expect(coversQuotedAmount('500.00', 500)).toBe(true);
  });

  /**
   * Overpayment is accepted. Somebody who sent too much should get their access
   * and a conversation, not a refusal — refusing would leave them out of pocket
   * *and* locked out.
   */
  it('accepts an overpayment', () => {
    expect(coversQuotedAmount(600, 500)).toBe(true);
  });

  /** Underpayment is not access. It becomes an operator's query (T-151). */
  it('refuses an underpayment, however small', () => {
    expect(coversQuotedAmount(499, 500)).toBe(false);
    expect(coversQuotedAmount('499.99', 500)).toBe(false);
  });

  it('refuses an amount it cannot read', () => {
    for (const bad of ['', 'lots', Number.NaN]) {
      expect(coversQuotedAmount(bad as number, 500), String(bad)).toBe(false);
    }
  });
});

describe('the number the push goes to', () => {
  /**
   * People write their number every way there is, and all of these are the same
   * handset. Refusing four of the five would be a checkout that fails for
   * reasons nobody can see.
   */
  it('accepts every way somebody writes the same number', () => {
    for (const written of [
      '0911223344',
      '+251911223344',
      '251911223344',
      '00251911223344',
      '+251 91 122 33 44',
      '091-122-3344',
      '911223344',
    ]) {
      expect(normaliseEthiopianMobile(written), written).toBe('0911223344');
    }
  });

  it('handles the 07 range as well as 09', () => {
    expect(normaliseEthiopianMobile('+251711223344')).toBe('0711223344');
  });

  /**
   * A wrong number is a USSD push to a stranger, so anything that is not
   * recognisably an Ethiopian mobile stops the purchase here.
   */
  it('refuses what is not an Ethiopian mobile number', () => {
    for (const bad of [
      '', // nothing typed
      '0911', // too short
      '09112233445', // too long
      '0111223344', // Addis landline
      '+447700900123', // another country
      'not a number',
    ]) {
      expect(normaliseEthiopianMobile(bad), bad).toBeNull();
    }
  });
});

describe('the direct-charge channels', () => {
  it('names telebirr and CBE Birr as Chapa spells them', () => {
    expect(CHAPA_DIRECT_TYPE.TELEBIRR).toBe('telebirr');
    expect(CHAPA_DIRECT_TYPE.CBEBIRR).toBe('cbebirr');
  });
});
