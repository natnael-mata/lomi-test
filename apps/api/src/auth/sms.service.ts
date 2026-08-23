import { Injectable, Logger } from '@nestjs/common';

import {
  SMS_ENDPOINT,
  buildHeaders,
  buildRequest,
  readResponse,
  type SendOutcome,
} from '../common/sms-ethiopia';

/**
 * Sending an SMS (T-264).
 *
 * **Wired to smsethiopia.com, and still safe with no key.** With `SMS_API_KEY`
 * set the message goes to the provider; without it the class logs and returns,
 * exactly as the stub did — so tests, CI and a developer's laptop never send a
 * real message or need a credential to run the registration flow end to end.
 * That fallback is the reason this file can be exercised at all: the alternative
 * is a suite that either spends money or is skipped.
 *
 * **A failed send does not throw.** Registration writes the code first and sends
 * second; a sender that crashes the request would lose a code that was already
 * stored, and the student would be told the whole thing failed while holding a
 * perfectly good account. Failures are logged loudly and the caller carries on
 * — the student's recourse is "resend", which is already built and rate limited.
 *
 * **The code is logged only when `SMS_ECHO_CODES` is set.** On any server where
 * it is not — which must include production — the code never reaches the log,
 * because a log line is a copy of a live credential and logs get shipped,
 * grepped and pasted into chat. Nothing in the failure path logs the message
 * body either, for the same reason.
 */
@Injectable()
export class SmsService {
  private readonly log = new Logger('sms');

  /** How long to wait on the provider before giving up on one message. */
  private static readonly TIMEOUT_MS = 10_000;

  async send(phone: string, message: string): Promise<void> {
    if (process.env.SMS_ECHO_CODES === 'true') {
      // Local development only. The variable has no default and no "dev mode"
      // inference — the same discipline as `DEV_LOGIN_SECRET`.
      this.log.warn(`SMS to ${phone}: ${message}`);
      return;
    }

    const apiKey = process.env.SMS_API_KEY;
    if (apiKey === undefined || apiKey === '') {
      // No key, no send. Announced rather than silent: a server that believes
      // it is sending codes and is not should say so on every attempt.
      this.log.warn(`SMS not sent — SMS_API_KEY is not set (${message.length} characters)`);
      return;
    }

    const outcome = await this.deliver(apiKey, phone, message);
    if (outcome.ok) {
      // The number is redacted downstream by `redact.ts`; the code never
      // appears here at all.
      this.log.log(`SMS sent (${message.length} characters)`);
      return;
    }
    this.log.error(
      `SMS not delivered — ${outcome.because}${outcome.retryable ? ' (retryable)' : ''}`,
    );
  }

  /** One attempt at the provider. Never throws; every failure is an outcome. */
  private async deliver(apiKey: string, phone: string, message: string): Promise<SendOutcome> {
    const body = buildRequest(phone, message);
    if (body === null) {
      // Caught here rather than at the provider, because "0943016897" is a
      // string the API would accept and quietly deliver nowhere.
      return { ok: false, retryable: false, because: 'not a sendable Ethiopian mobile number' };
    }

    try {
      const res = await fetch(process.env.SMS_ENDPOINT ?? SMS_ENDPOINT, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
        // Without this a hung provider holds a request open indefinitely, and
        // registration is a synchronous path a student is waiting on.
        signal: AbortSignal.timeout(SmsService.TIMEOUT_MS),
      });

      // Parsed if it can be. A provider that answers 200 with prose is not a
      // reason to report failure, so an unreadable body is simply absent.
      const parsed = await res
        .clone()
        .json()
        .catch(() => null);
      return readResponse(res.status, parsed);
    } catch (error) {
      const because = error instanceof Error ? error.message : String(error);
      // A timeout or a DNS failure is always worth another try.
      return { ok: false, retryable: true, because: `could not reach the provider: ${because}` };
    }
  }
}
