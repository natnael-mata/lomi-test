/**
 * Talking to smsethiopia.com (T-264).
 *
 * Pure. Building the request and reading the reply are separated from sending
 * it, so every branch that matters — a refused key, a malformed number, a
 * provider that answers 200 with a failure in the body — is testable without a
 * network and without spending a single message.
 *
 * The provider's contract is one endpoint:
 *
 *     POST https://smsethiopia.com/api/sms/send
 *     KEY: <api key>
 *     {"msisdn": "251943016897", "text": "..."}
 *
 * **The key goes in a header, so it must never go in a URL or a log.** Nothing
 * here formats it into a message, and `describeFailure` is written to be safe to
 * log verbatim: it reports the status and the provider's own words, never the
 * credential and never the message body, which for this product is always a
 * live one-time code.
 */

/** Where the messages go. Overridable for tests, never for a caller. */
export const SMS_ENDPOINT = 'https://smsethiopia.com/api/sms/send';

/**
 * The number in the form the provider wants.
 *
 * Numbers are stored as `09XXXXXXXX` (see `normaliseEthiopianMobile`) and the
 * API takes an msisdn: country code, no plus, no leading zero. Doing this
 * conversion in one named place is the difference between a send that silently
 * goes nowhere and one that fails loudly — `0943016897` is a syntactically fine
 * string that is not a phone number anywhere on earth.
 */
export function toMsisdn(localPhone: string): string | null {
  return /^0[97]\d{8}$/.test(localPhone) ? `251${localPhone.slice(1)}` : null;
}

/** The body the provider expects, ready to be serialised. */
export interface SendRequest {
  msisdn: string;
  text: string;
}

export function buildRequest(localPhone: string, text: string): SendRequest | null {
  const msisdn = toMsisdn(localPhone);
  // An empty message is a send that costs money and delivers nothing.
  if (msisdn === null || text.length === 0) return null;
  return { msisdn, text };
}

/** The headers, including the credential. Never logged, never in a URL. */
export function buildHeaders(apiKey: string): Record<string, string> {
  return { KEY: apiKey, 'Content-Type': 'application/json' };
}

export type SendOutcome =
  | { ok: true }
  | { ok: false; retryable: boolean; because: string };

/**
 * What the provider's reply means.
 *
 * **A 200 is not a success.** Gateways of this shape routinely answer 200 with
 * `{"status":"failed"}` in the body, and treating the status line as the answer
 * is how a product reports "code sent" to a student who will never receive one.
 * So the body is inspected whenever it can be read, and anything that looks like
 * a stated failure wins over the status code.
 *
 * `retryable` separates "this will never work" — a rejected key, a bad number —
 * from "try again shortly", because the first should page somebody and the
 * second should not.
 */
export function readResponse(status: number, body: unknown): SendOutcome {
  if (status === 401 || status === 403) {
    return { ok: false, retryable: false, because: `provider refused the key (${status})` };
  }
  if (status === 429) {
    return { ok: false, retryable: true, because: 'provider rate limited the send (429)' };
  }
  if (status >= 500) {
    return { ok: false, retryable: true, because: `provider error (${status})` };
  }
  if (status >= 400) {
    return { ok: false, retryable: false, because: `provider rejected the request (${status})` };
  }

  /*
   * A 2xx whose body says otherwise.
   *
   * Deliberately conservative: only an explicit, recognisable failure marker
   * turns a 2xx into an error. An unfamiliar success shape must not be read as
   * a failure, or a provider adding a field breaks registration for everybody.
   */
  const stated = statedFailure(body);
  if (stated !== null) return { ok: false, retryable: true, because: stated };
  return { ok: true };
}

/** A failure the provider states in a 2xx body, or null if it did not. */
function statedFailure(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;

  const status = typeof record.status === 'string' ? record.status.toLowerCase() : null;
  if (status !== null && ['failed', 'failure', 'error', 'rejected'].includes(status)) {
    return `provider replied ${status}${messageIn(record)}`;
  }
  // Some gateways answer `{"success": false}` and nothing else.
  if (record.success === false) return `provider replied not successful${messageIn(record)}`;
  if (record.error !== undefined && record.error !== null && record.error !== '') {
    return `provider reported an error${messageIn(record)}`;
  }
  return null;
}

/**
 * The provider's own explanation, trimmed and bounded.
 *
 * Bounded because this is logged, and an unbounded string from another service
 * in a log line is somebody else's decision about the size of our logs. Only
 * fields the provider uses for prose are read — never the request echo, which
 * would put the message text, and therefore a live code, into the log.
 */
function messageIn(record: Record<string, unknown>): string {
  const raw = record.message ?? record.error ?? record.description;
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  return `: ${raw.trim().slice(0, 200)}`;
}
