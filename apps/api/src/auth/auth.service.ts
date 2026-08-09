import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { generateDisplayName } from './display-name';
import { verifyInitData, type TelegramUser } from './telegram-init-data';
import { devDisplayName, devTelegramId, isDevLoginEnabled, secretMatches } from './dev-login';
import { signSessionToken } from './tokens';

/** PRODUCT.md: two concurrent sessions; a third login evicts the oldest. */
export const MAX_CONCURRENT_SESSIONS = 2;

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

    const telegramId = String(devTelegramId(label));
    // Loud on purpose, and through Nest's logger rather than `console` so it
    // passes the redacting sink like everything else. This route should never
    // run unnoticed, and the log is where it will be looked for afterwards.
    new Logger('dev-login').warn(`smoke-test sign-in as ${devDisplayName(label)} (${telegramId})`);

    return this.signInWithTelegramId(
      { id: telegramId, firstName: devDisplayName(label) },
      'smoke-test',
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
    return this.prisma.$transaction(async (tx) => {
      const live = await tx.session.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      // `>=`, not `>`: the new session is about to exist, so room has to be made
      // for it before it does — otherwise three live sessions exist briefly, and
      // a concurrent read sees a limit that does not hold.
      const excess = live.length - (MAX_CONCURRENT_SESSIONS - 1);
      if (excess > 0) {
        await tx.session.updateMany({
          where: { id: { in: live.slice(0, excess).map((s) => s.id) } },
          data: { revokedAt: new Date(), revokedReason: EVICTED_REASON },
        });
      }

      return tx.session.create({
        data: { userId, deviceLabel: deviceLabel ?? null },
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
  async publishedFields(): Promise<{ id: string; name: string; slug: string }[]> {
    return this.prisma.field.findMany({
      where: { isPublished: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
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
