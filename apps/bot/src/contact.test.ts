/**
 * The rule that makes a "verified" phone worth the word (T-078a).
 *
 * Telegram sends the same message type whether somebody taps the button or
 * picks a name out of their address book. The only thing that tells them apart
 * is whether `contact.user_id` is the sender — so these cases are the feature.
 */
import { describe, expect, it } from 'vitest';

import { verifiedContact } from './contact.js';

describe('verifiedContact', () => {
  it('accepts the contact somebody shared about themselves', () => {
    const outcome = verifiedContact({
      from: { id: 5550001 },
      contact: { phone_number: '+251911223344', user_id: 5550001 },
    });
    expect(outcome).toEqual({ ok: true, phone: '+251911223344' });
  });

  /**
   * **The case the whole file exists for.**
   *
   * Without this, "verified phone" means "a number this student had in their
   * phone book" — which is worse than an unverified one, because it carries a
   * claim nobody checked.
   */
  it('rejects a contact shared about somebody else', () => {
    const outcome = verifiedContact({
      from: { id: 5550001 },
      contact: { phone_number: '+251911999999', user_id: 5550002 },
    });
    expect(outcome).toEqual({ ok: false, reason: 'not-own-contact' });
  });

  /**
   * An address-book entry for somebody with no Telegram account has no
   * `user_id` at all. It fails on its own line rather than by falling through a
   * comparison against `undefined`.
   */
  it('rejects a contact with no account behind it', () => {
    const outcome = verifiedContact({
      from: { id: 5550001 },
      contact: { phone_number: '+251911223344' },
    });
    expect(outcome).toEqual({ ok: false, reason: 'not-own-contact' });
  });

  /**
   * Telegram ids are past 2^32 and arrive as JSON numbers; the same id can
   * reach this as a string from one path and a number from another. A strict
   * `===` between the two forms is false — and the failure is a refusal, which
   * is the direction that survives review unnoticed.
   */
  it('compares ids by value, not by type', () => {
    expect(
      verifiedContact({
        from: { id: '7654321098' },
        contact: { phone_number: '0911223344', user_id: 7654321098 },
      }),
    ).toEqual({ ok: true, phone: '0911223344' });
  });

  it('rejects a contact carrying no number', () => {
    expect(
      verifiedContact({
        from: { id: 5550001 },
        contact: { phone_number: '   ', user_id: 5550001 },
      }),
    ).toEqual({ ok: false, reason: 'no-number' });
  });

  it('rejects a message with no contact on it at all', () => {
    expect(verifiedContact({ from: { id: 5550001 } })).toEqual({
      ok: false,
      reason: 'no-contact',
    });
  });

  it('rejects a contact with no sender', () => {
    // Channel posts have no `from`. Nothing should be stored against nobody.
    expect(verifiedContact({ contact: { phone_number: '0911223344', user_id: 5550001 } })).toEqual({
      ok: false,
      reason: 'not-own-contact',
    });
  });
});
