import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type SignInResult } from './auth.service';
import {
  canClaim,
  canDecide,
  deepLink,
  expiryFrom,
  isDeliverablePayload,
  pairingCodeFrom,
  requestState,
  startPayload,
  type RequestState,
} from './login-link';

export interface LoginLinkCreated {
  /** Goes in the link. Safe to be seen — on its own it produces nothing. */
  nonce: string;
  /** Stays in the browser. Never sent to Telegram. */
  pollSecret: string;
  deepLink: string;
  pairingCode: string;
  expiresAt: string;
}

export interface LoginLinkStatus {
  state: RequestState;
  pairingCode: string;
}

/** What the bot needs in order to show a sensible prompt. */
export interface PendingPrompt {
  pairingCode: string;
  deviceLabel: string | null;
  expiresAt: string;
}

/** How many links one address may ask for before it is told to stop. */
const RATE_LIMIT = 5;
const RATE_WINDOW_SEC = 10 * 60;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Signing in on the web through the Telegram bot (T-075–T-078).
 *
 * See `login-link.ts` for why this shape and not an SMS code. The security
 * argument lives there too; what this file has to get right is that the two
 * halves of a login never meet anywhere except on one row:
 *
 * - the **browser** proves it is the browser that asked, with a secret that was
 *   never in the link,
 * - the **bot** supplies an identity Telegram signed, and never sees the secret.
 *
 * A session is issued only when both have arrived, the student has confirmed,
 * and the row has not already been used.
 */
@Injectable()
export class LoginLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private get botUsername(): string {
    return process.env.TELEGRAM_BOT_USERNAME ?? '';
  }

  /**
   * Mints a login request.
   *
   * The nonce is 128 bits of randomness rather than a counter or a cuid: it is
   * the only thing standing between a stranger and somebody's approval prompt,
   * and a guessable one turns "confirm this sign-in" into a notification a
   * student eventually taps out of habit.
   */
  async create(
    ip: string | null,
    deviceLabel?: string,
    now: Date = new Date(),
  ): Promise<LoginLinkCreated> {
    if (!this.botUsername) {
      throw new UnprocessableEntityException({
        error: 'BOT_NOT_CONFIGURED',
        message: 'Telegram sign-in is not configured on this server.',
      });
    }

    await this.enforceRateLimit(ip, now);

    const nonce = randomBytes(16).toString('hex');
    const pollSecret = randomBytes(32).toString('hex');
    const pairingCode = pairingCodeFrom(randomBytes(2));

    // Checked, not assumed: Telegram silently drops an over-long or
    // out-of-alphabet payload and delivers a bare `/start`, so the bot sees a
    // first-time visitor and the login never completes with nothing saying why.
    if (!isDeliverablePayload(startPayload(nonce))) {
      throw new UnprocessableEntityException({
        error: 'PAYLOAD_TOO_LONG',
        message: 'Could not build a usable Telegram link.',
      });
    }

    const expiresAt = expiryFrom(now);
    await this.prisma.loginRequest.create({
      data: {
        nonce,
        pollSecretHash: sha256(pollSecret),
        pairingCode,
        expiresAt,
        requestedFromIp: ip,
        deviceLabel: deviceLabel ?? null,
        createdAt: now,
      },
    });

    return {
      nonce,
      pollSecret,
      deepLink: deepLink(this.botUsername, nonce),
      pairingCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** What the bot shows the student before they confirm. */
  async prompt(nonce: string, now: Date = new Date()): Promise<PendingPrompt> {
    const row = await this.prisma.loginRequest.findUnique({ where: { nonce } });
    if (!row) throw new NotFoundException('That sign-in link is not valid.');
    if (!canDecide(row, now)) {
      throw new UnprocessableEntityException({
        error: `LOGIN_${requestState(row, now).toUpperCase()}`,
        message: 'That sign-in link has already been used or has run out.',
      });
    }
    return {
      pairingCode: row.pairingCode,
      deviceLabel: row.deviceLabel,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /**
   * The student confirmed it was them.
   *
   * The Telegram identity is taken from the caller — the bot, which received it
   * from Telegram — and never from anything the browser said. The browser has no
   * way to name whose account it is signing in to, which is the property that
   * makes the whole flow safe to expose.
   */
  async approve(
    nonce: string,
    telegram: { id: string; username?: string | null },
    now: Date = new Date(),
  ): Promise<{ pairingCode: string }> {
    const row = await this.prisma.loginRequest.findUnique({ where: { nonce } });
    if (!row) throw new NotFoundException('That sign-in link is not valid.');
    if (!canDecide(row, now)) {
      throw new UnprocessableEntityException({
        error: `LOGIN_${requestState(row, now).toUpperCase()}`,
        message: 'That sign-in link has already been used or has run out.',
      });
    }

    // Guarded on `approvedAt: null` in the WHERE, not just by the read above:
    // two taps on the same button arrive concurrently more often than they
    // ought to, and the check-then-write between them is a race.
    const updated = await this.prisma.loginRequest.updateMany({
      where: { nonce, approvedAt: null, declinedAt: null, claimedAt: null },
      data: {
        approvedAt: now,
        telegramId: telegram.id,
        telegramUsername: telegram.username ?? null,
      },
    });
    if (updated.count === 0) {
      throw new UnprocessableEntityException({
        error: 'LOGIN_ALREADY_DECIDED',
        message: 'That sign-in link has already been used.',
      });
    }

    return { pairingCode: row.pairingCode };
  }

  /** The student said it was not them. Recorded, not just dropped. */
  async decline(nonce: string, now: Date = new Date()): Promise<void> {
    const row = await this.prisma.loginRequest.findUnique({ where: { nonce } });
    if (!row) throw new NotFoundException('That sign-in link is not valid.');
    if (!canDecide(row, now)) return; // Already settled; nothing to add.

    await this.prisma.loginRequest.updateMany({
      where: { nonce, approvedAt: null, declinedAt: null, claimedAt: null },
      data: { declinedAt: now },
    });
  }

  /**
   * The browser exchanges its secret for a session.
   *
   * Returns `null` while the request is still pending — that is the ordinary
   * case, polled every second or two, and it is not an error.
   */
  async claim(
    nonce: string,
    pollSecret: string,
    deviceLabel?: string,
    now: Date = new Date(),
  ): Promise<SignInResult | null> {
    const row = await this.prisma.loginRequest.findUnique({ where: { nonce } });
    if (!row) throw new UnauthorizedException('That sign-in link is not valid.');

    // The secret is checked **before** the state, and in constant time. Checking
    // state first would answer "is this nonce approved yet?" for anyone holding
    // a nonce, which is a probe into somebody else's in-flight sign-in.
    if (!secretMatches(pollSecret, row.pollSecretHash)) {
      throw new UnauthorizedException('That sign-in link is not valid.');
    }

    const state = requestState(row, now);
    if (state === 'pending') return null;
    if (!canClaim(row, now)) {
      throw new UnauthorizedException('That sign-in link has already been used or has run out.');
    }
    if (!row.telegramId) {
      // Approved with no identity should be impossible; refuse rather than
      // guess, because guessing here means issuing a session for nobody.
      throw new UnauthorizedException('That sign-in link is not valid.');
    }

    // Claimed first, conditionally, so a doubled request cannot mint two
    // sessions. Whoever loses the race gets the "already used" answer.
    const taken = await this.prisma.loginRequest.updateMany({
      where: { nonce, claimedAt: null },
      data: { claimedAt: now },
    });
    if (taken.count === 0) {
      throw new UnauthorizedException('That sign-in link has already been used.');
    }

    const result = await this.auth.signInWithTelegramId(
      { id: row.telegramId, username: row.telegramUsername },
      deviceLabel ?? row.deviceLabel ?? undefined,
    );
    await this.prisma.loginRequest.update({
      where: { nonce },
      data: { sessionId: result.sessionId },
    });
    return result;
  }

  /** For the web page, so it can show what is happening without claiming. */
  async status(nonce: string, now: Date = new Date()): Promise<LoginLinkStatus> {
    const row = await this.prisma.loginRequest.findUnique({ where: { nonce } });
    if (!row) throw new NotFoundException('That sign-in link is not valid.');
    return { state: requestState(row, now), pairingCode: row.pairingCode };
  }

  /**
   * Refuses a caller asking for links faster than a person could use them.
   *
   * Per address, and best-effort: behind a shared NAT this is coarse, which is
   * why the limit is generous enough that a classroom on one connection is not
   * locked out. It exists to stop a script filling somebody's chat with approval
   * prompts, not to be an access control.
   */
  private async enforceRateLimit(ip: string | null, now: Date): Promise<void> {
    if (!ip) return;
    const since = new Date(now.getTime() - RATE_WINDOW_SEC * 1000);
    const recent = await this.prisma.loginRequest.count({
      where: { requestedFromIp: ip, createdAt: { gte: since } },
    });
    if (recent >= RATE_LIMIT) {
      throw new UnprocessableEntityException({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many sign-in attempts. Wait a few minutes and try again.',
      });
    }
  }
}

/** Constant-time compare of a presented secret against its stored hash. */
function secretMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(sha256(presented), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
