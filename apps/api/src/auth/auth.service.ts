import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { StaffRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { generateDisplayName } from './display-name';
import { verifyInitData, type TelegramUser } from './telegram-init-data';
import {
  DEV_PERSONAS,
  devDisplayName,
  devTelegramId,
  isDevLoginEnabled,
  isKnownPersona,
  secretMatches,
} from './dev-login';
import { bandFor } from '../engagement/bands';
import { normaliseEthiopianMobile } from '../common/phone';
import { checkPassword, hashPassword, verifyPassword } from './password';
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
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private get botToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN ?? '';
  }

  private get jwtSecret(): string {
    return process.env.JWT_SECRET ?? '';
  }

  /**
   * Signs in from inside Telegram.
   *
   * The signature is checked first and the result is refused outright if it does
   * not verify — `initData` is the only proof of who this is, so an unverified
   * one is not a degraded credential, it is no credential.
   */
  async signInWithTelegram(initData: string, deviceLabel?: string): Promise<SignInResult> {
    const verified = verifyInitData(initData, this.botToken);
    if (!verified.ok) throw new UnauthorizedException(verified.reason);
    return this.signInWithTelegramId(verified.user, deviceLabel);
  }

  /**
   * Signs in from a Telegram identity that has **already been proved**.
   *
   * Split out for the deep-link login (T-077), where the proof arrives at the
   * bot rather than at this process: Telegram delivered the update to the bot,
   * so there is no `initData` to check here and nothing would be gained by
   * inventing one.
   *
   * **This method trusts its argument completely**, which is why it is not
   * reachable from any student-facing route. Everything that calls it must have
   * established the identity first — `signInWithTelegram` by checking the HMAC,
   * `LoginLinkService.claim` by reading it off a row only the bot can write.
   * Handing it a caller-supplied id would be an account-takeover endpoint.
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
   * Signs in a **smoke-test** account (deploy testing only).
   *
   * Guarded by `DEV_LOGIN_SECRET`, which has no default: an unset variable is a
   * closed door. See `dev-login.ts` for why the whole thing is built around
   * minting its own account rather than accepting a user id — a bypass that
   * takes an id is a complete compromise of every account in the product, and
   * one that mints a throwaway is a nuisance.
   *
   * The label is a persona name, not an identity: "student" is the same
   * throwaway account every time, so a tester who signs back in finds
   * yesterday's practice rather than a fresh account.
   */
  async signInAsTester(presentedSecret: string, label: string): Promise<SignInResult> {
    const configured = process.env.DEV_LOGIN_SECRET;
    if (!isDevLoginEnabled(configured) || !secretMatches(presentedSecret, configured)) {
      // Identical for "not enabled" and "wrong secret". Telling them apart
      // tells somebody probing whether the door exists at all.
      throw new UnauthorizedException('No.');
    }

    /*
     * Checked after the secret, never before.
     *
     * Order matters: answering "no such persona" to an unauthenticated caller
     * would confirm the door exists and enumerate what is behind it. Somebody
     * without the secret gets the same "No." for everything.
     */
    if (!isKnownPersona(label)) {
      throw new UnprocessableEntityException({
        error: 'UNKNOWN_PERSONA',
        message: `No testing account is called "${label}". Try one of: ${DEV_PERSONAS.join(', ')}.`,
      });
    }

    const telegramId = String(devTelegramId(label));
    // Loud on purpose, and through Nest's logger rather than `console` so it
    // passes the redacting sink like everything else. This route should never
    // run unnoticed, and the log is where it will be looked for afterwards.
    new Logger('dev-login').warn(`smoke-test sign-in as ${devDisplayName(label)} (${telegramId})`);

    return this.signInWithTelegramId(
      { id: telegramId, firstName: devDisplayName(label) },
      /*
       * A label somebody can tell apart (T-252).
       *
       * Every session the door minted was called "smoke-test", so the device
       * list showed two identical rows differing only by a timestamp and
       * revoking the right one was guesswork — QA said so on both passes and
       * declined to try, since revoking the wrong one ends your own run.
       *
       * The clock is the only thing that distinguishes two sign-ins to the same
       * account from the same browser, so it goes in the label.
       */
      `smoke-test ${new Date().toISOString().slice(11, 16)}`,
    );
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
    const cap =
      bandFor(field?.maxGrade ?? null) === 'junior'
        ? MAX_CONCURRENT_SESSIONS_JUNIOR
        : MAX_CONCURRENT_SESSIONS;

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
  async signInWithPassword(rawPhone: unknown, password: unknown): Promise<SignInResult> {
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
    const session = await this.startSession(user.id, 'password');
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
      select: { id: true, name: true, slug: true },
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
  async listDevices(userId: string, currentSessionId: string): Promise<DeviceEntry[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, deviceLabel: true, lastSeenAt: true, createdAt: true },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      lastSeenAt: session.lastSeenAt,
      signedInAt: session.createdAt,
      // Marked, not filtered out: a student needs to see which row is the phone
      // in their hand before they revoke the other one.
      isCurrent: session.id === currentSessionId,
    }));
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
