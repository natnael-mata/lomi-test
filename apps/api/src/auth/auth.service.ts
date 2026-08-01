import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { generateDisplayName } from './display-name';
import { verifyInitData, type TelegramUser } from './telegram-init-data';
import { signSessionToken } from './tokens';

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

    const { user, isNew } = await this.findOrCreateTelegramUser(verified.user);
    const session = await this.prisma.session.create({
      data: { userId: user.id, deviceLabel: deviceLabel ?? null },
    });

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
