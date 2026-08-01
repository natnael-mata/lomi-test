import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { generateDisplayName } from './display-name';
import { verifyInitData, type TelegramUser } from './telegram-init-data';
import { signSessionToken } from './tokens';

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
