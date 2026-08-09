/**
 * Chapa's wire protocol (T-142, T-143, T-144), with no network and no secrets.
 *
 * Four ways to pay, three of them through Chapa:
 *
 * | Channel          | Chapa API              | What the student does        |
 * | ---------------- | ---------------------- | ---------------------------- |
 * | `TELEBIRR`       | direct charge          | Approves a USSD push         |
 * | `CBEBIRR`        | direct charge          | Approves a USSD push         |
 * | `CHAPA`          | hosted checkout        | Pays on Chapa's page         |
 * | `BANK`           | none                   | Transfers, pastes a reference|
 *
 * The bank route is deliberately outside Chapa: it is a claim an operator
 * settles (T-145), and verify.et automation is held pending decision D6.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** What Chapa calls each direct-charge method. */
export const CHAPA_DIRECT_TYPE = {
  TELEBIRR: 'telebirr',
  CBEBIRR: 'cbebirr',
} as const;

export type DirectChannel = keyof typeof CHAPA_DIRECT_TYPE;

/**
 * Builds the reference Chapa keys a transaction on.
 *
 * **Ours, not Chapa's.** `tx_ref` is the only identifier we control on both
 * sides of the boundary: it goes out with the charge and comes back on the
 * webhook, and it is what makes a replay recognisable. A Chapa-generated id
 * would only exist after the call succeeded, which is exactly the case where we
 * need to know what we sent.
 *
 * Prefixed so a reference is identifiable in a support conversation without
 * anybody having to look it up, and suffixed with randomness so two purchases in
 * the same millisecond cannot collide.
 */
export function buildTxRef(subscriptionId: string, nonce: string): string {
  return `lomi-${subscriptionId}-${nonce}`;
}

/** The subscription a reference belongs to, or `null` if it is not one of ours. */
export function subscriptionFromTxRef(txRef: string): string | null {
  const match = /^lomi-([a-z0-9]+)-[A-Za-z0-9]+$/.exec(txRef);
  return match?.[1] ?? null;
}

/**
 * An Ethiopian mobile number in the form Chapa's direct charge expects.
 *
 * People write their number every way there is: `0911223344`, `+251911223344`,
 * `251 91 122 33 44`, with hyphens, with a leading `00`. All of those are the
 * same handset, and refusing four of the five would be a checkout that fails for
 * reasons nobody can see. Normalised to the local ten-digit form (`09…`/`07…`)
 * because that is what Chapa's examples use.
 *
 * Returns `null` rather than a best guess when it is not a mobile number at all
 * — a landline or a mistyped digit should stop the purchase here, not produce a
 * USSD push to a stranger.
 */
export function normaliseEthiopianMobile(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '').replace(/^00/, '');
  const local = digits.startsWith('251')
    ? `0${digits.slice(3)}`
    : digits.startsWith('9') || digits.startsWith('7')
      ? `0${digits}`
      : digits;

  return /^0[97]\d{8}$/.test(local) ? local : null;
}

export interface ChapaWebhookEvent {
  event: string;
  tx_ref: string;
  status: string;
  amount: number | string;
  currency?: string;
  reference?: string;
  payment_method?: string;
}

/**
 * Whether a webhook really came from Chapa.
 *
 * **`x-chapa-signature` only.** Chapa sends two signature headers and they are
 * not equally good:
 *
 * - `x-chapa-signature` is an HMAC of **the event payload**, so it proves both
 *   that the sender holds the key *and* that this particular body was not
 *   altered.
 * - `chapa-signature` is an HMAC of **the secret key with itself**. It is the
 *   same value on every request forever, which means it proves the sender knew
 *   the key at some point and nothing whatever about the payload. Anyone who
 *   ever saw one webhook — a proxy log, a screenshot, a misconfigured tunnel —
 *   can replay that header on a body they wrote themselves.
 *
 * Chapa's docs say either is sufficient. That is true of authenticity and false
 * of integrity, and a weaker alternative that is always accepted is not a
 * fallback — it is the option an attacker picks. So the constant header is not
 * read at all. Chapa sends both on every delivery, so nothing is lost by
 * ignoring one; and if a delivery ever arrived without the payload signature it
 * would be refused, which the polling path (`statusOf` → verify) already covers.
 *
 * Compared in constant time, over the **raw body**: re-serialising parsed JSON
 * reorders keys and changes whitespace, and the hash of a re-serialised body is
 * a hash of a different document.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: { payloadSignature?: string | undefined },
  secret: string,
): { ok: boolean } {
  if (secret.length === 0) return { ok: false };
  if (!headers.payloadSignature) return { ok: false };

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return { ok: safeEqual(headers.payloadSignature, expected) };
}

/** Constant-time compare of two hex digests. */
function safeEqual(presented: string, expected: string): boolean {
  const a = Buffer.from(presented.trim(), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** The events that mean money arrived. Anything else is not a settlement. */
const SUCCESS_EVENTS = new Set(['charge.success']);
const SUCCESS_STATUSES = new Set(['success', 'successful']);

/**
 * Whether an event says the charge succeeded.
 *
 * Both the event name and the status must agree. Chapa sends `charge.failed`
 * and `charge.reversed` through the same endpoint, and a handler that keys off
 * the presence of a payload rather than its contents activates on a refund.
 */
export function isSuccessfulCharge(event: ChapaWebhookEvent): boolean {
  return SUCCESS_EVENTS.has(event.event?.toLowerCase() ?? '') && isSuccessfulStatus(event.status);
}

/**
 * Whether a status means the money arrived.
 *
 * Separate from `isSuccessfulCharge` because the **verify** endpoint returns a
 * status with no event name attached, and the alternative — inventing a
 * `charge.success` event to feed the other function — would be a lie in the
 * argument list that reads as fact at the call site.
 */
export function isSuccessfulStatus(status: string | undefined): boolean {
  return SUCCESS_STATUSES.has(String(status ?? '').toLowerCase());
}

/**
 * Whether the amount that arrived covers what was quoted.
 *
 * Compared in whole birr with a floor rather than an equality: Chapa returns
 * amounts as strings and sometimes with decimals, and `"500.00" !== 500`. An
 * **over**payment is accepted — somebody sending too much should get their
 * access and a conversation, not a refusal — while an underpayment is not, and
 * becomes a `query` for an operator (T-151) rather than a silent grant.
 */
export function coversQuotedAmount(paid: number | string, quotedEtb: number): boolean {
  const amount = typeof paid === 'number' ? paid : Number.parseFloat(paid);
  if (!Number.isFinite(amount)) return false;
  return Math.floor(amount) >= quotedEtb;
}
