import { Injectable, Logger } from '@nestjs/common';

/**
 * Sending an SMS (T-264).
 *
 * **A stub, and deliberately the only stub in this feature.** The owner wires
 * the provider — Ethio Telecom or an aggregator — and everything around it is
 * finished: the code, the hashing, the expiry, the attempt cap, the resend
 * cooldown and both rate limits. Swapping this class for a real client is the
 * whole remaining job.
 *
 * It logs rather than throws, because a half-built sender that crashes
 * registration is worse than one that visibly does nothing: the flow can be
 * walked end to end today, and the log line is where the code comes from.
 *
 * **The code is logged only when `SMS_ECHO_CODES` is set.** On any server where
 * it is not — which must include production — the code never reaches the log,
 * because a log line is a copy of a live credential and logs get shipped,
 * grepped and pasted into chat.
 */
@Injectable()
export class SmsService {
  private readonly log = new Logger('sms');

  async send(phone: string, message: string): Promise<void> {
    if (process.env.SMS_ECHO_CODES === 'true') {
      // Local development only. The variable has no default and no "dev mode"
      // inference — the same discipline as `DEV_LOGIN_SECRET`.
      this.log.warn(`SMS to ${phone}: ${message}`);
      return;
    }
    // Redacted by default. `redact.ts` would scrub the number anyway; this makes
    // the absence of the code deliberate rather than incidental.
    this.log.log(`SMS queued for a phone number (${message.length} characters)`);
  }
}
