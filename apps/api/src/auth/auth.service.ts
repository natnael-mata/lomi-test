import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { OtpPurpose, StaffRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { generateDisplayName } from './display-name';
import { verifyInitData, type TelegramUser } from './telegram-init-data';
import { bandFor } from '../engagement/bands';
import { normaliseEthiopianMobile } from '../common/phone';
import { planFitsTrack } from '../payments/plan';
import { checkPassword, hashPassword, verifyPassword } from './password';
import {
  CODE_TTL_SEC,
  MAX_ATTEMPTS,
  checkCode,
  cooldownRemainingSec,
  expiryFrom,
  generateCode,
  hashCode,
  lockUntil,
  type CodeVerdict,
} from './otp';
import { TooManyRequests } from '../common/rate-limit.service';
import { SmsService } from './sms.service';
import { safeDeviceLabel } from './device-label';
import { signSessionToken } from './tokens';

/** PRODUCT.md: two concurrent sessions; a third login evicts the oldest. */
export const MAX_CONCURRENT_SESSIONS = 2;

/**
 * The same limit, relaxed for the school tracks (T-260).
 *
 * **Two devices punishes the household it should be courting.** A family with
 * two children in Grade 6 and Grade 8 sharing one phone, or one phone between a
 * parent and a child, is the best customer this product has — and under a
 * two-session cap they evict each other all day and experience the limit as a
 * fault. The abuse it was written for is a subscription passed around a class,
 * which is a different shape entirely.
 *
 * Four is a household, not a classroom. And the real anti-sharing control is
 * the velocity cap (T-259), which is better aimed at what it catches: two
 * friends sharing an account answer forty questions a day between them, a
 * scraper answers four thousand. A session count cannot tell those apart; a
 * rate can.
 */
export const MAX_CONCURRENT_SESSIONS_JUNIOR = 4;

export const EVICTED_REASON = 'Signed out because another device signed in.';

export const REVOKED_BY_USER_REASON = 'Signed out from the device list.';

export interface DeviceEntry {
  id: string;
  deviceLabel: string | null;
  lastSeenAt: Date;
  signedInAt: Date;
  isCurrent: boolean;
}

/**
 * The device list, with the cap that applies to this account (T-268).
 *
 * The number is sent rather than written into the client, because it is not one
 * number: school tracks get four (T-260) and everybody else two. The screen said
 * "Two devices at a time" unconditionally, above four live rows on a Grade 6
 * account.
 */
export interface DeviceList {
  devices: DeviceEntry[];
  maxDevices: number;
}

export interface RevokeResult {
  id: string;
  revoked: boolean;
  alreadyRevoked: boolean;
}

export interface LinkResult {
  userId: string;
  telegramId: string | null;
  alreadyLinked: boolean;
}

export interface SignInResult {
  token: string;
  userId: string;
  sessionId: string;
  displayName: string;
  fieldId: string | null;
  /** True when this sign-in created the account rather than finding it. */
  isNew: boolean;
}

/** Who a session belongs to. Named on both sides so `contracts.test.ts` holds them together. */
export interface Identity {
  userId: string;
  displayName: string;
  staffRole: StaffRole | null;
}

/**
 * A hash to verify against when there is no account.
 *
 * The point is spending the same time on a miss as on a hit — a sign-in that
 * returns instantly for an unknown number and slowly for a known one publishes
 * which numbers hold accounts through the clock, however careful the message is.
 * The password it encodes is unguessable and never used.
 */
const DECOY_HASH = 'scrypt$32768$8$1$00000000000000000000000000000000$' + '0'.repeat(128);

/** A programme a student may choose, and whether they already have. */
export interface FieldOption {
  id: string;
  name: string;
  slug: string;
  chosen: boolean;
  /**
   * How many published questions are behind it.
   *
   * **A programme can be published and still be empty**, and three of them were:
   * `isPublished` records that we mean to offer a subject, not that there is
   * anything to practise in it. A student who chose one landed on a practice
   * screen that said "Nothing left to practise in this programme today" — which
   * reads as "you have finished" and was never true; there was never anything.
   *
   * Sent rather than filtered out, because a student whose subject is listed but
   * not ready has learned something true and useful. Hiding it would tell them
   * we do not cover their exam at all.
   */
  questionCount: number;
  /**
   * The highest school year this track covers, or null for a university exit
   * exam (T-268).
   *
   * Sent because the chooser asks "have you sat the exit exam before?" and was
   * asking it of a Grade 6 pupil, who has not sat anything and cannot make sense
   * of the question. It is the same field the pricing and leaderboard-band rules
   * turn on, so the client having it also stops the next screen inventing its
   * own way to tell school tracks apart.
   */
  maxGrade: number | null;
}

/**
 * The one refusal every failed code gets (T-266).
 *
 * One shape, so a caller cannot tell a wrong code from a missing account by the
 * response it gets back. `reason` distinguishes only things the clock already
 * told the student — expired, spent, locked — never anything about the digits.
 *
 * **`retryAt` is a clock time, never a duration.** The design is emphatic: "you
 * can try again at 14:32", not "try again later". Somebody who does not know
 * when the door reopens has to keep trying it, which is both the worst
 * experience and the most traffic.
 */
function codeRejected(verdict: CodeVerdict & { ok: false }, retryAt: Date | null = null) {
  const message =
    verdict.reason === 'locked'
      ? // The time, in the sentence. It was computed, put in `retryAt`, and then
        // the prose said "for a short while" — so the one number that answers
        // the student's actual question lived only in a machine field. QA
        // quoted this back as a failure and was right to.
        retryAt === null
        ? 'Too many wrong codes. This number is locked for fifteen minutes.'
        : `Too many wrong codes. This number is locked until ${clockTime(retryAt)}.`
      : verdict.reason === 'expired'
        ? 'That code has expired. Codes last ten minutes — ask for a new one.'
        : 'That code is not right. Ask for a new one if you need to.';

  return new UnauthorizedException({
    error: 'CODE_REJECTED',
    reason: verdict.reason,
    triesLeft: verdict.triesLeft,
    retryAt: retryAt?.toISOString() ?? null,
    message,
  });
}

/**
 * A wall-clock time in Addis, for putting inside a sentence.
 *
 * Formatted on the server rather than left to the reader's browser because this
 * string is also read out by the bot and by anything else holding the API, and
 * every student sitting these exams is in one timezone. `retryAt` stays in the
 * response as an ISO instant for anybody who would rather format it themselves.
 */
function clockTime(at: Date): string {
  return at.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  private get botToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN ?? '';
  }

  private get jwtSecret(): string {
    return process.env.JWT_SECRET ?? '';
  }

  /*
   * `signInWithTelegram` was here (T-265).
   *
   * Telegram is no longer a way *in*. Sign-in is a phone number and a password,
   * and accounts are created by verifying a number — see `startPhoneRegistration`
   * and `completePhoneRegistration` above.
   *
   * `signInWithTelegramId` below stays, because linking is not logging in: an
   * account that loses its history when a student changes SIM is the failure the
   * design is most explicit about avoiding, and the bot still needs to resolve a
   * chat to an account it is already linked to.
   */
  async signInWithTelegramId(
    profile: {
      id: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    },
    deviceLabel?: string,
  ): Promise<SignInResult> {
    // A deactivated account cannot sign back in (T-164). Checked before the
    // session is opened, or deactivating would only last until the next login.
    const known = await this.prisma.user.findUnique({
      where: { telegramId: profile.id },
      select: { deactivatedAt: true },
    });
    if (known?.deactivatedAt) {
      throw new UnauthorizedException('This account is not active. Contact support.');
    }

    const { user, isNew } = await this.findOrCreateTelegramUser({
      id: profile.id,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      languageCode: null,
      isPremium: false,
    });
    const session = await this.startSession(user.id, deviceLabel);

    return {
      token: signSessionToken({ sub: user.id, sid: session.id }, this.jwtSecret),
      userId: user.id,
      sessionId: session.id,
      displayName: user.displayName,
      fieldId: user.fieldId,
      isNew,
    };
  }


  /**
   * Opens a session, evicting the oldest if the device limit is already met.
   *
   * PRODUCT.md: two concurrent sessions, a third login evicts the oldest. The
   * eviction happens **on login, not on use** — the alternative is refusing the
   * third login, which strands a student who has lost the phone they signed in
   * on. Sharing is discouraged by making it inconvenient, never by locking the
   * real owner out.
   *
   * Evicted rows are revoked rather than deleted, so "signed out on 3 August,
   * because a third device signed in" is still answerable.
   */
  async startSession(userId: string, deviceLabel?: string): Promise<{ id: string }> {
    /*
     * The cap depends on the track (T-260).
     *
     * Read outside the transaction: it is a property of the student's programme,
     * not of the sessions being evicted, and holding a second table's row for
     * the length of the write buys nothing.
     */
    const cap = await this.sessionCapFor(userId);

    return this.prisma.$transaction(async (tx) => {
      const live = await tx.session.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      // `>=`, not `>`: the new session is about to exist, so room has to be made
      // for it before it does — otherwise three live sessions exist briefly, and
      // a concurrent read sees a limit that does not hold.
      const excess = live.length - (cap - 1);
      if (excess > 0) {
        await tx.session.updateMany({
          where: { id: { in: live.slice(0, excess).map((s) => s.id) } },
          data: { revokedAt: new Date(), revokedReason: EVICTED_REASON },
        });
      }

      return tx.session.create({
        // Constrained here, where it is written. A client supplies this
        // string and the provider's activity feed shows it to somebody other
        // than its author; a filter at the display would leave the original in
        // the database for the next reader to find.
        data: { userId, deviceLabel: safeDeviceLabel(deviceLabel) },
        select: { id: true },
      });
    });
  }

  /**
   * Attaches a Telegram identity to the account already signed in.
   *
   * The direction is the security property. The caller proves the phone account
   * with a session token and proves the Telegram account with a signed
   * `initData`; nothing here takes either identity on the caller's word, so
   * there is no request that claims a phone number or a `telegramId` somebody
   * else owns.
   *
   * **Two populated accounts are never merged.** If the Telegram id already
   * belongs to a different user, that user may have attempts, a subscription and
   * a history; folding them together is a data decision with no correct default,
   * and folding them *wrongly* is unrecoverable. It refuses and says which
   * accounts are involved.
   */
  async linkTelegram(userId: string, initData: string): Promise<LinkResult> {
    const verified = verifyInitData(initData, this.botToken);
    if (!verified.ok) throw new UnauthorizedException(verified.reason);

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, telegramId: true, phone: true },
    });
    if (!me) throw new NotFoundException('No such account.');

    if (me.telegramId === verified.user.id) {
      // Already linked, by this user, to this identity. Saying "done" is the
      // honest answer to a request whose goal is already true.
      return { userId: me.id, telegramId: me.telegramId, alreadyLinked: true };
    }
    if (me.telegramId !== null) {
      throw new ConflictException(
        'This account is already linked to a different Telegram identity.',
      );
    }

    const holder = await this.prisma.user.findUnique({
      where: { telegramId: verified.user.id },
      select: { id: true },
    });
    if (holder && holder.id !== me.id) {
      throw new ConflictException(
        'That Telegram account is already a separate Lomi-Test account. Merging two accounts has to be done by support.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: me.id },
      data: {
        telegramId: verified.user.id,
        telegramUsername: verified.user.username,
      },
      select: { id: true, telegramId: true },
    });
    return { userId: updated.id, telegramId: updated.telegramId, alreadyLinked: false };
  }

  /**
   * Chooses the programme this student is sitting.
   *
   * Only a **published** field can be chosen. An unpublished one is either not
   * ready or deliberately withheld (Geography is seeded unpublished for exactly
   * this reason), and letting a student select it would strand them on a field
   * with nothing servable in it.
   *
   * Changing it later is allowed — students do switch programmes, and refusing
   * would mean a support ticket for a mistake made in the first thirty seconds
   * of using the app. What that does to progress and readiness is T-140's
   * problem, not this endpoint's.
   */
  /**
   * Records the programme, and optionally whether this is a retake (T-166, D8).
   *
   * `isRetaker` rides along here because this is the only onboarding question
   * the product asks — sign-in is a deep link with no form behind it. It is
   * **left alone when not supplied**, so a student updating their programme does
   * not silently overwrite an answer they gave months ago with "unknown".
   */
  /**
   * Signs in with a phone number and a password (T-263).
   *
   * **The phone number is the username.** It is the one identifier an Ethiopian
   * student already has, cannot forget, and that a reset can be sent to — and it
   * is normalised first, because `0911223344`, `+251911223344` and
   * `251 91 122 33 44` are the same handset and refusing four of the five would
   * be a sign-in that fails for reasons nobody can see.
   *
   * **One message for every failure.** Unknown number, no password set, wrong
   * password — all answer the same way. Telling them apart is an oracle: an
   * attacker learns which numbers hold accounts by reading the error, and in a
   * country where numbers are guessable in blocks that is a list worth having.
   *
   * The password is verified even when there is no account, against a throwaway
   * hash, so the two paths take the same time. A sign-in that returns instantly
   * for an unknown number and slowly for a known one has published the same list
   * through the clock instead of the message.
   */
  async signInWithPassword(
    rawPhone: unknown,
    password: unknown,
    deviceLabel?: string,
  ): Promise<SignInResult> {
    const phone = typeof rawPhone === 'string' ? normaliseEthiopianMobile(rawPhone) : null;
    const supplied = typeof password === 'string' ? password : '';

    const user = phone
      ? await this.prisma.user.findUnique({
          where: { phone },
          select: { id: true, passwordHash: true, deactivatedAt: true },
        })
      : null;

    /*
     * The decoy.
     *
     * Hashed once at module load would be faster, but the point is to spend the
     * same wall-clock time as a real verification, and a real verification runs
     * scrypt. This is the cheapest honest way to make the two indistinguishable.
     */
    const stored = user?.passwordHash ?? DECOY_HASH;
    const matched = await verifyPassword(supplied, stored);

    if (!user || !user.passwordHash || !matched || user.deactivatedAt !== null) {
      throw new UnauthorizedException({
        error: 'SIGN_IN_FAILED',
        message: 'That phone number and password do not match an account.',
      });
    }

    /*
     * Opened the same way a Telegram sign-in opens one, including the device
     * eviction (T-260). Two sign-in doors that manage sessions differently is
     * how one of them ends up not counting against the limit.
     */
    // The client's own label — "Chrome on Android" — constrained at the write by
    // `safeDeviceLabel`. Falling back to a constant would make every row in the
    // device list identical, which is the bug QA filed against the seeder.
    const session = await this.startSession(user.id, deviceLabel);
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { displayName: true, fieldId: true },
    });
    return {
      token: signSessionToken({ sub: user.id, sid: session.id }, this.jwtSecret),
      userId: user.id,
      sessionId: session.id,
      displayName: account.displayName,
      fieldId: account.fieldId,
      isNew: false,
    };
  }

  /**
   * Sets or replaces a password on an account.
   *
   * Separate from sign-in because the two have different guards: this one needs
   * the caller to already be who they say they are, by session or by a verified
   * one-time code.
   */
  async setPassword(userId: string, password: unknown): Promise<{ ok: true }> {
    const check = checkPassword(password);
    if (!check.ok) {
      throw new UnprocessableEntityException({ error: 'WEAK_PASSWORD', reasons: check.reasons });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password as string) },
    });
    return { ok: true };
  }

  /**
   * Starts registration: sends a one-time code to a phone number (T-264).
   *
   * **Answers the same way whether or not the number already has an account.**
   * "That number is already registered" is a membership oracle, and mobile
   * numbers are issued in guessable blocks — so an existing account is quietly
   * sent a *sign-in* code instead of a registration one, and the caller cannot
   * tell the two apart. The student who really owns the number is unaffected
   * either way; the person enumerating numbers learns nothing.
   */
  async startPhoneRegistration(
    rawPhone: unknown,
    now: Date = new Date(),
  ): Promise<{ sent: true; expiresInSec: number }> {
    const phone = typeof rawPhone === 'string' ? normaliseEthiopianMobile(rawPhone) : null;
    if (!phone) {
      throw new UnprocessableEntityException({
        error: 'INVALID_PHONE',
        message: 'That is not an Ethiopian mobile number.',
      });
    }

    await this.issueCode(phone, 'REGISTER', now);
    return { sent: true, expiresInSec: CODE_TTL_SEC };
  }

  /**
   * Sends a code, or refuses because one was just sent.
   *
   * Shared by sign-up and reset because the rules are identical and must stay
   * that way: **a generous reset path beside a strict sign-in is the same as
   * having no sign-in.** Reset is a second equal front door onto a live
   * account, not a convenience bolted onto the first one.
   *
   * The cooldown is per number *and per purpose*. Sharing it would let a
   * sign-up attempt rate-limit a password reset on the same handset, which
   * looks like the reset being broken.
   */
  private async issueCode(phone: string, purpose: OtpPurpose, now: Date): Promise<void> {
    /*
     * A locked number cannot buy its way out with a new code (T-268).
     *
     * **The lock was on the code, not on the number.** `lockedUntil` is a column
     * on `OtpCode`, verification only ever reads the newest row, and this method
     * created a fresh one with `attempts: 0` — so three wrong guesses, one press
     * of "Send another code", and the attacker had three more. QA verified it:
     * locked until 19:40, resent, and was immediately told "2 tries left". The
     * sentence "This number is locked until 19:40" was simply untrue, and the
     * cap was worth three times what it claimed.
     *
     * Checked here as well as at verification because sending is the half that
     * costs money: a locked number that keeps being sent codes is a telecom
     * bill being run up by somebody who cannot use them.
     */
    const lockedUntil = await this.lockedUntilFor(phone, purpose, now);
    if (lockedUntil) throw codeRejected({ ok: false, reason: 'locked', triesLeft: 0 }, lockedUntil);

    const newest = await this.prisma.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const wait = cooldownRemainingSec(newest, now);
    if (wait > 0) {
      // Its own status, because "wait 40 seconds" is a different instruction
      // from "you have tried too many times today".
      throw new TooManyRequests(wait);
    }

    const code = generateCode();
    await this.prisma.otpCode.create({
      data: { phone, purpose, codeHash: hashCode(code), expiresAt: expiryFrom(now) },
    });

    /*
     * Not awaited, and that is a privacy fix rather than a speed one (T-268).
     *
     * **The reset path was timeable.** `startPasswordReset` is careful to answer
     * identically for a registered and an unregistered number — same status,
     * same body, same cooldown — and then awaited an HTTP call to the SMS
     * provider on exactly one of those two paths. Measured locally: 330ms for a
     * number with an account, 11ms for one without. Anybody can type numbers
     * into the form and read the answer off a stopwatch, which is the directory
     * the identical wording exists to prevent. QA suspected an oracle here and
     * could not pin it down; this is it.
     *
     * Safe to drop the await: `SmsService.send` never throws — it logs and
     * returns — so nothing downstream depended on it resolving, and the student
     * is told a code is on its way rather than that it has arrived. `void` with
     * an explicit catch so an unhandled rejection can never take the process
     * down on a background send.
     */
    void this.sms
      .send(phone, `Your Lomi code is ${code}. It expires in 10 minutes.`)
      .catch(() => {});
  }

  /**
   * Checks a code and spends it, or throws the one refusal every failure gets.
   *
   * **The refusal carries what the student needs and nothing an attacker can
   * use.** How many guesses remain, and when a locked number reopens, are both
   * stated: somebody who does not know how many tries are left cannot decide
   * whether to guess again, so they guess — the exact behaviour the cap exists
   * to prevent. Neither figure says anything about whether the digits were
   * close, because `checkCode` settles the clock and the counter *before* it
   * compares anything.
   *
   * What is deliberately NOT distinguished is whether the number has an
   * account: a missing row and a wrong code are one answer, so the reset path
   * cannot be used to ask which of your students are registered.
   *
   * Spending it is the caller's win condition — the code is gone whether or not
   * whatever comes next succeeds, because a code that outlives a rejected
   * password is one somebody can hold open while they try passwords.
   *
   * **`spend: false` judges without consuming**, which is what the code screen
   * needs (T-268). The three screens are number → code → password, and the code
   * was only ever judged on the third: a student who mistyped it was told
   * nothing, chose a password, and was then thrown back a screen with a try
   * already burned. QA read that as "the client never checks the code at all",
   * which is the right conclusion from the outside.
   *
   * Checking without spending is not a weaker check. A wrong guess still counts
   * and still locks, so the number of guesses is unchanged; a right guess leaves
   * a code that was already valid for ten minutes valid for the ninety seconds
   * it takes to choose a password. What it buys is the refusal arriving on the
   * screen that caused it.
   */
  /**
   * When this **number** may next try a code, or null (T-268).
   *
   * `lockedUntil` is a column on a code row, and a number can have many rows —
   * so asking only the newest one meant a resend erased the lock. The lock
   * belongs to the number: any unexpired lock on any of its codes holds.
   */
  private async lockedUntilFor(
    phone: string,
    purpose: OtpPurpose,
    now: Date,
  ): Promise<Date | null> {
    const held = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, lockedUntil: { gt: now } },
      orderBy: { lockedUntil: 'desc' },
      select: { lockedUntil: true },
    });
    return held?.lockedUntil ?? null;
  }

  private async spendCode(
    phone: string,
    purpose: OtpPurpose,
    supplied: string,
    now: Date,
    { spend = true }: { spend?: boolean } = {},
  ): Promise<void> {
    // The number's lock, before the newest code's own state. Otherwise a code
    // issued after a lock was set carries `attempts: 0` and hands back a fresh
    // set of guesses.
    const locked = await this.lockedUntilFor(phone, purpose, now);
    if (locked) throw codeRejected({ ok: false, reason: 'locked', triesLeft: 0 }, locked);

    const stored = await this.prisma.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (!stored) throw codeRejected({ ok: false, reason: 'wrong', triesLeft: 0 });

    const verdict = checkCode(supplied, stored, now);
    if (!verdict.ok) {
      if (verdict.reason === 'wrong') {
        const attempts = stored.attempts + 1;
        await this.prisma.otpCode.update({
          where: { id: stored.id },
          data: {
            attempts,
            // The last wrong guess closes the door on the number, not just on
            // the code. Otherwise three guesses per code times a free resend
            // every minute is not a cap, it is a slower keyboard.
            ...(attempts >= MAX_ATTEMPTS ? { lockedUntil: lockUntil(now) } : {}),
          },
        });
        throw codeRejected(
          attempts >= MAX_ATTEMPTS
            ? { ok: false, reason: 'locked', triesLeft: 0 }
            : verdict,
          attempts >= MAX_ATTEMPTS ? lockUntil(now) : null,
        );
      }
      throw codeRejected(verdict, stored.lockedUntil);
    }

    if (spend) {
      await this.prisma.otpCode.update({ where: { id: stored.id }, data: { consumedAt: now } });
    }
  }

  /**
   * Judges a code without spending it, for the code screen (T-268).
   *
   * Returns nothing on success and throws the same refusal `spendCode` throws on
   * failure, so the client has one shape to render either way.
   */
  async checkCode(
    rawPhone: unknown,
    purpose: OtpPurpose,
    supplied: unknown,
    now: Date = new Date(),
  ): Promise<{ ok: true }> {
    const phone = typeof rawPhone === 'string' ? normaliseEthiopianMobile(rawPhone) : null;
    // The same answer a wrong code gets. A malformed number must not be
    // distinguishable here either — this endpoint is reachable without a
    // session, so it is a directory if it answers differently.
    if (!phone) throw codeRejected({ ok: false, reason: 'wrong', triesLeft: 0 });
    const code = typeof supplied === 'string' ? supplied.trim() : '';
    await this.spendCode(phone, purpose, code, now, { spend: false });
    return { ok: true };
  }

  /**
   * Sends a code to reset a password (T-266).
   *
   * **The answer is the same whether or not the number has an account.** Reset
   * is the one path where confirming would be a directory of who your students
   * are — anybody could type numbers in and read the answers off the screen.
   * Sign-up is allowed to confirm, because a student blocked by a number they
   * already own with no way to find out is simply stuck; reset has no such
   * excuse, since a student who owns the number gets the code either way.
   *
   * So the cooldown is checked for every number, and only the send is
   * conditional. An unregistered number that skipped the cooldown would answer
   * instantly where a registered one waited, which is the same oracle wearing a
   * stopwatch.
   */
  async startPasswordReset(
    rawPhone: unknown,
    now: Date = new Date(),
  ): Promise<{ sent: true; expiresInSec: number }> {
    const phone = typeof rawPhone === 'string' ? normaliseEthiopianMobile(rawPhone) : null;
    if (!phone) {
      throw new UnprocessableEntityException({
        error: 'INVALID_PHONE',
        message: 'That is not an Ethiopian mobile number.',
      });
    }

    const account = await this.prisma.user.findFirst({
      where: { phone, deactivatedAt: null },
      select: { id: true },
    });
    if (account) {
      await this.issueCode(phone, 'RESET', now);
    } else {
      // Nothing to send to, and nothing to say about it. The cooldown is still
      // spent so the timing matches a number that does have an account.
      await this.holdCooldown(phone, 'RESET', now);
    }
    return { sent: true, expiresInSec: CODE_TTL_SEC };
  }

  /**
   * Proves the number, sets the new password, and signs the student in.
   *
   * Signing them in is deliberate: they have just proved they own the handset
   * and chosen a password with it, and asking them to type that password again
   * on the next screen is a step that proves nothing.
   *
   * **Every session is ended first.** A reset is what somebody does when they
   * think their account is not theirs any more, and a reset that leaves the
   * other party signed in has not given the account back.
   */
  async completePasswordReset(
    rawPhone: unknown,
    code: unknown,
    password: unknown,
    device: string,
    now: Date = new Date(),
  ): Promise<SignInResult> {
    const phone = typeof rawPhone === 'string' ? normaliseEthiopianMobile(rawPhone) : null;
    const supplied = typeof code === 'string' ? code.trim() : '';
    if (!phone || supplied === '') {
      throw codeRejected({ ok: false, reason: 'wrong', triesLeft: 0 });
    }

    await this.spendCode(phone, 'RESET', supplied, now);

    const check = checkPassword(password);
    if (!check.ok) {
      throw new UnprocessableEntityException({ error: 'WEAK_PASSWORD', reasons: check.reasons });
    }

    /*
     * The account is looked up only now, and its absence is the same refusal a
     * wrong code gets.
     *
     * A code for a number with no account cannot exist — `startPasswordReset`
     * does not issue one — so reaching here means the row was created and the
     * account was deleted in between. Rare, and it must not become the one path
     * that answers "no such account".
     */
    const account = await this.prisma.user.findFirst({
      where: { phone, deactivatedAt: null },
      select: { id: true },
    });
    if (!account) throw codeRejected({ ok: false, reason: 'wrong', triesLeft: 0 });

    await this.prisma.user.update({
      where: { id: account.id },
      data: { passwordHash: await hashPassword(password as string), phoneVerifiedAt: now },
    });

    // See the docstring: a reset that leaves the other party signed in has not
    // given the account back.
    await this.prisma.session.updateMany({
      where: { userId: account.id, revokedAt: null },
      data: { revokedAt: now },
    });

    const session = await this.startSession(account.id, device);
    const who = await this.prisma.user.findUniqueOrThrow({
      where: { id: account.id },
      select: { displayName: true, fieldId: true },
    });
    return {
      token: signSessionToken({ sub: account.id, sid: session.id }, this.jwtSecret),
      userId: account.id,
      sessionId: session.id,
      displayName: who.displayName,
      fieldId: who.fieldId,
      isNew: false,
    };
  }

  /**
   * Spends the resend cooldown without sending anything.
   *
   * Only used where a send is skipped for a reason the caller must not reveal.
   * Without it, an unregistered number answers instantly where a registered one
   * has to wait, and the difference is readable with a stopwatch.
   */
  private async holdCooldown(phone: string, purpose: OtpPurpose, now: Date): Promise<void> {
    const newest = await this.prisma.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const wait = cooldownRemainingSec(newest, now);
    if (wait > 0) throw new TooManyRequests(wait);

    /*
     * A real row, with a code nobody will ever be told.
     *
     * The alternative — no row — leaves the cooldown with nothing to measure,
     * so the *second* request for an unregistered number returns immediately
     * while a registered one is still waiting out its minute. The row is what
     * makes the two indistinguishable, and its code is unusable because it was
     * generated and discarded.
     */
    await this.prisma.otpCode.create({
      data: { phone, purpose, codeHash: hashCode(generateCode()), expiresAt: expiryFrom(now) },
    });
  }

  /**
   * Finishes registration: checks the code, sets the password, opens a session.
   *
   * The code is spent whether or not the password is acceptable — a code that
   * survives a rejected password is a code somebody can keep trying passwords
   * against, and the student can ask for another in a minute.
   */
  async completePhoneRegistration(
    rawPhone: unknown,
    code: unknown,
    password: unknown,
    now: Date = new Date(),
  ): Promise<SignInResult> {
    const phone = typeof rawPhone === 'string' ? normaliseEthiopianMobile(rawPhone) : null;
    const supplied = typeof code === 'string' ? code.trim() : '';
    if (!phone || supplied === '') {
      throw new UnauthorizedException({
        error: 'CODE_REJECTED',
        message: 'That code is not right, or it has expired. Ask for a new one.',
      });
    }

    await this.spendCode(phone, 'REGISTER', supplied, now);

    const check = checkPassword(password);
    if (!check.ok) {
      throw new UnprocessableEntityException({ error: 'WEAK_PASSWORD', reasons: check.reasons });
    }
    const passwordHash = await hashPassword(password as string);

    /*
     * Created or updated, and the difference is invisible to the caller.
     *
     * A number that already had an account has just proved it owns the handset,
     * so this doubles as password recovery — which is the reason phone is the
     * username in the first place. Telling the two paths apart in the response
     * would reintroduce the membership oracle the send step was careful to
     * close.
     */
    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, deactivatedAt: true },
    });
    if (existing?.deactivatedAt) {
      throw new UnauthorizedException({
        error: 'CODE_REJECTED',
        message: 'That code is not right, or it has expired. Ask for a new one.',
      });
    }

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, phoneVerifiedAt: now },
          select: { id: true, displayName: true, fieldId: true },
        })
      : await this.prisma.user.create({
          data: {
            phone,
            phoneVerifiedAt: now,
            passwordHash,
            // The product generates its own handle and takes one from nobody
            // (T-086). Registration asks for a number and a password, and
            // nothing else — the profile comes later, and only where it buys
            // the student something.
            displayName: generateDisplayName(),
          },
          select: { id: true, displayName: true, fieldId: true },
        });

    const session = await this.startSession(user.id, 'phone');
    return {
      token: signSessionToken({ sub: user.id, sid: session.id }, this.jwtSecret),
      userId: user.id,
      sessionId: session.id,
      displayName: user.displayName,
      fieldId: user.fieldId,
      isNew: existing === null,
    };
  }

  /**
   * Why this student may not move to `fieldId`, or null if they may.
   *
   * Inline rather than through `SubscriptionsService`: the rule is one pure
   * function and two queries, and reaching for the payments service from the
   * auth service is how a dependency cycle starts. `plansForTrack` is the same
   * predicate the picker and the purchase gate are built on, so the three
   * cannot drift.
   */
  private async crossesPricingLine(userId: string, fieldId: string): Promise<string | null> {
    const live = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: { select: { code: true } } },
    });
    if (!live) return null;

    const target = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: { maxGrade: true },
    });
    if (!target) return null;

    if (planFitsTrack(live.plan.code, target.maxGrade)) return null;

    /*
     * Named as a price difference, not as a refusal to let somebody study what
     * they like. This is the one case where "message us" is the honest answer:
     * the fix is a payment, and a student cannot make it themselves without
     * first giving up access they have already paid for.
     */
    return live.plan.code === 'SCHOOL_YEAR'
      ? 'Your access was bought on a school plan. Exit-exam programmes are priced differently — message us and we will move you across.'
      : 'Your access was bought on an exit-exam plan. Message us and we will move you across.';
  }

  async chooseField(
    userId: string,
    fieldId: string,
    isRetaker?: boolean,
  ): Promise<{ fieldId: string; name: string }> {
    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: { id: true, name: true, isPublished: true },
    });
    if (!field || !field.isPublished) {
      // One message for both: which unpublished fields exist is not a signed-in
      // student's business.
      throw new NotFoundException('No such programme.');
    }

    /*
     * A move across the pricing line, while holding access bought on the other
     * side of it (T-268).
     *
     * Grade 12 and below pay Br 300 a year; an exit-exam candidate pays Br 800
     * for the same twelve months. Subscriptions are account-wide, so without
     * this the cheaper plan buys the dearer product in two moves — claim
     * `SCHOOL_YEAR` on a Grade 6 account, then come here. It was verified
     * against the running server before this existed.
     *
     * Only blocks the crossing. Grade 6 to Grade 8 is the same plan and stays
     * open, and a student with no live subscription may go anywhere.
     */
    const blocked = await this.crossesPricingLine(userId, fieldId);
    if (blocked) {
      throw new ConflictException({ error: 'PLAN_COVERS_ANOTHER_TRACK', message: blocked });
    }

    /*
     * Published is not the same as ready.
     *
     * Choosing an empty programme strands a student: every screen behind the
     * field gate works perfectly and has nothing to show, and practice reports
     * "nothing left today" about a bank that was never filled. Refused here
     * rather than left to the first screen that notices, so the answer arrives
     * while they are still on the chooser and can pick something else.
     */
    const published = await this.prisma.question.count({
      where: { fieldId: field.id, status: 'PUBLISHED' },
    });
    if (published === 0) {
      throw new UnprocessableEntityException({
        error: 'PROGRAMME_NOT_READY',
        message: `${field.name} has no questions yet. Choose another for now — this one is being written.`,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fieldId: field.id,
        ...(typeof isRetaker === 'boolean' ? { isRetaker } : {}),
      },
    });
    return { fieldId: field.id, name: field.name };
  }

  /** The programmes a student may choose between. */
  /**
   * The student's own verified number (T-078a).
   *
   * Unmasked, because it is theirs and they are the only reader — the masking
   * on the checkout's waiting screen is for a number being read back at
   * somebody, which is a different situation.
   *
   * `verifiedAt` rides along rather than being inferred from `phone` being
   * non-null: the column can hold a number from a path that never verified it,
   * and a screen that says "verified" about one of those would be lying on the
   * strength of a null check.
   */
  async contactOf(userId: string): Promise<{ phone: string | null; verifiedAt: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, phoneVerifiedAt: true },
    });
    return {
      phone: user?.phone ?? null,
      verifiedAt: user?.phoneVerifiedAt?.toISOString() ?? null,
    };
  }

  /** Who a session belongs to, for the screen that says so (T-251). */
  async identityOf(userId: string): Promise<Identity> {
    // Two reads rather than a join: `User` declares no reverse relation to
    // `StaffMember`, deliberately — see the schema note on why a derived role
    // and a person are separate models — and `staffRoleOf` is the one place
    // that lookup lives.
    const [user, staffRole] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true },
      }),
      this.staffRoleOf(userId),
    ]);
    if (!user) throw new NotFoundException('No such account.');
    return { userId: user.id, displayName: user.displayName, staffRole };
  }

  /** The caller's staff role, or null. See `MeController.staff` for why it exists. */
  async staffRoleOf(userId: string): Promise<StaffRole | null> {
    const staff = await this.prisma.staffMember.findUnique({
      where: { userId },
      select: { role: true },
    });
    return staff?.role ?? null;
  }

  async publishedFields(userId?: string): Promise<FieldOption[]> {
    const fields = await this.prisma.field.findMany({
      where: { isPublished: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, maxGrade: true },
    });

    /*
     * Which one is theirs, marked on the list itself.
     *
     * **This closed a real bug.** Progress and the mock exam both did
     * `fields[0]` and called that the student's programme, so a student sitting
     * Public Health saw Accounting & Finance's readiness — "Nothing answered
     * yet" over a screen full of their own answers — and would have been handed
     * the wrong paper. Neither screen was wrong to want one field; there was
     * simply no way to ask which.
     *
     * A flag on the existing list rather than a second route, so a caller
     * cannot fetch the list and the choice separately and have them disagree.
     */
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { fieldId: true } })
      : null;

    /*
     * How much is actually in each one.
     *
     * One grouped count rather than a query per field: the chooser is the first
     * screen a new student sees, on the worst connection they will ever have.
     */
    const counts = await this.prisma.question.groupBy({
      by: ['fieldId'],
      where: { fieldId: { in: fields.map((f) => f.id) }, status: 'PUBLISHED' },
      _count: { _all: true },
    });
    const byField = new Map(counts.map((c) => [c.fieldId, c._count._all]));

    return fields.map((f) => ({
      ...f,
      chosen: f.id === user?.fieldId,
      questionCount: byField.get(f.id) ?? 0,
    }));
  }

  /**
   * The student's live devices.
   *
   * Revoked rows are left out. This screen answers "who is signed in as me right
   * now", and a history of ended sessions buries that under noise — the reason a
   * session ended is kept on the row for support, not for this list.
   */
  async listDevices(userId: string, currentSessionId: string): Promise<DeviceList> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, deviceLabel: true, lastSeenAt: true, createdAt: true },
    });

    /*
     * The cap this account actually has (T-268).
     *
     * School tracks get four (T-260) — a household sharing one phone is the
     * best customer this product has — and the screen said "Two devices at a
     * time" to everybody. QA read that sentence above a list of four live
     * devices on a Grade 6 account and filed the product as contradicting
     * itself, which from the screen is exactly what it was doing.
     *
     * Sent rather than duplicated in the client: the number is a rule, it has
     * already changed once, and a copy of it in the web app is a copy that will
     * be wrong the next time.
     */
    const cap = await this.sessionCapFor(userId);

    const devices = sessions.map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      lastSeenAt: session.lastSeenAt,
      signedInAt: session.createdAt,
      // Marked, not filtered out: a student needs to see which row is the phone
      // in their hand before they revoke the other one.
      isCurrent: session.id === currentSessionId,
    }));

    return { devices, maxDevices: cap };
  }

  /**
   * How many devices this account may hold at once.
   *
   * Extracted from `startSession`, which computed the same thing inline — two
   * copies of a rule that has already been changed once is how the screen and
   * the enforcement come to disagree.
   */
  private async sessionCapFor(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    const field = user?.fieldId
      ? await this.prisma.field.findUnique({
          where: { id: user.fieldId },
          select: { maxGrade: true },
        })
      : null;
    return bandFor(field?.maxGrade ?? null) === 'junior'
      ? MAX_CONCURRENT_SESSIONS_JUNIOR
      : MAX_CONCURRENT_SESSIONS;
  }

  /**
   * Ends one session immediately.
   *
   * Scoped to the caller's own sessions by the WHERE clause rather than by a
   * check afterwards: an id belonging to somebody else simply matches nothing,
   * so the same 404 answers "no such session" and "not yours" — and there is no
   * ordering in which a mistake here revokes a stranger's device.
   *
   * Revoking the session you are using is allowed. It is what "sign out" is.
   */
  async revokeDevice(userId: string, sessionId: string): Promise<RevokeResult> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, revokedAt: true },
    });
    if (!session) throw new NotFoundException('No such device.');

    if (session.revokedAt !== null) {
      return { id: session.id, revoked: true, alreadyRevoked: true };
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: REVOKED_BY_USER_REASON },
    });
    return { id: session.id, revoked: true, alreadyRevoked: false };
  }

  /**
   * One Telegram id, one user row.
   *
   * `telegramId` is unique in the schema, so two simultaneous first sign-ins
   * race: both see no row, both insert, one loses. The loser's error is caught
   * and the existing row read instead — the alternative is a student meeting a
   * 500 on the one action that must work, their very first.
   */
  private async findOrCreateTelegramUser(profile: TelegramUser): Promise<{
    user: { id: string; displayName: string; fieldId: string | null };
    isNew: boolean;
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId: profile.id },
      select: { id: true, displayName: true, fieldId: true },
    });
    if (existing) {
      // The username is refreshed because people change it; the display name is
      // NOT touched — it is the student's, and an import must never overwrite a
      // handle they chose.
      if (profile.username) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { telegramUsername: profile.username },
        });
      }
      return { user: existing, isNew: false };
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          telegramId: profile.id,
          telegramUsername: profile.username,
          // Never the Telegram name: a Telegram profile usually IS the person's
          // real name, and copying it into the public handle leaks exactly what
          // PRODUCT.md's rule protects (T-086).
          displayName: generateDisplayName(),
          name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null,
        },
        select: { id: true, displayName: true, fieldId: true },
      });
      return { user: created, isNew: true };
    } catch {
      const raced = await this.prisma.user.findUnique({
        where: { telegramId: profile.id },
        select: { id: true, displayName: true, fieldId: true },
      });
      if (!raced) throw new UnauthorizedException('Could not create or find the account.');
      return { user: raced, isNew: false };
    }
  }
}
