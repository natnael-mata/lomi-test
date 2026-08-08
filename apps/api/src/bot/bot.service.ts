import { Injectable } from '@nestjs/common';

import { generateDisplayName } from '../auth/display-name';
import { PrismaService } from '../prisma/prisma.service';
import { toServedQuestion, type ServedQuestion } from '../practice/question-view';
import { addisDate, planDaily, referralFromPayload, type SkipReason } from './daily';

export interface DailyRecipient {
  userId: string;
  chatId: string;
  question: ServedQuestion;
}

export interface DailyClaim {
  today: string;
  recipients: DailyRecipient[];
  skipped: { userId: string; reason: SkipReason }[];
}

/**
 * What the bot is allowed to ask the API to do (T-180, T-181, T-182).
 *
 * The bot holds no business logic — it renders and sends. Everything about who
 * gets a message, and whether they have already had one, is decided here where
 * the state is.
 */
@Injectable()
export class BotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records how a student arrived, on their first `/start` (T-180).
   *
   * **Keyed on the Telegram id, not our user id**, because the bot has no other
   * handle: somebody opening the bot for the first time has never signed in, and
   * attribution has to happen at first contact or it does not happen at all. So
   * the account is created here if it does not exist — the same
   * find-or-create the sign-in path uses, minus the session.
   *
   * **Set once, never overwritten.** Whoever introduced a student did so once,
   * and letting a later link rewrite it would let anybody claim someone else's
   * referral simply by sending them a fresh one. A second `/start` with a
   * different code is not an error — it is somebody sharing a link — so it is
   * accepted and ignored.
   */
  async recordArrival(
    telegram: { id: string; username?: string | null },
    chatId: string,
    payload: string,
  ): Promise<{ userId: string; referredVia: string | null; wasFirst: boolean }> {
    const referral = referralFromPayload(payload);
    const userId = await this.findOrCreateUser(telegram);
    const existing = await this.prisma.botProfile.findUnique({ where: { userId } });

    if (!existing) {
      const created = await this.prisma.botProfile.create({
        data: { userId, chatId, referredVia: referral },
      });
      return { userId, referredVia: created.referredVia, wasFirst: true };
    }

    // The chat id IS refreshed — a student can reinstall and get a new one, and
    // a stale chat is a student silently receiving nothing.
    await this.prisma.botProfile.update({
      where: { userId },
      data: {
        chatId,
        ...(existing.referredVia === null && referral !== null ? { referredVia: referral } : {}),
      },
    });

    return {
      userId,
      referredVia: existing.referredVia ?? referral,
      wasFirst: existing.referredVia === null && referral !== null,
    };
  }

  /**
   * The account behind a Telegram id, created if this is the first contact.
   *
   * The display name is generated, never taken from the Telegram profile: a
   * Telegram name usually IS the person's real name, and copying it into a
   * public handle leaks exactly what T-086 protects.
   */
  private async findOrCreateUser(telegram: {
    id: string;
    username?: string | null;
  }): Promise<string> {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId: telegram.id },
      select: { id: true },
    });
    if (existing) {
      if (telegram.username) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { telegramUsername: telegram.username },
        });
      }
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: {
        telegramId: telegram.id,
        telegramUsername: telegram.username ?? null,
        displayName: generateDisplayName(),
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Turns nudges off, or back on (T-182). */
  async setOptOut(userId: string, optOut: boolean): Promise<{ botOptOut: boolean }> {
    const row = await this.prisma.botProfile.upsert({
      where: { userId },
      update: { botOptOut: optOut },
      create: { userId, botOptOut: optOut },
    });
    return { botOptOut: row.botOptOut };
  }

  /**
   * Claims today's recipients and marks them sent, in one step (T-181).
   *
   * **Marked before sending, not after** — at-most-once, deliberately. If the
   * bot dies mid-run those students miss one day; if it were marked after, a
   * crash would replay the whole batch and some students would get the same
   * question twice. For a daily nudge, silence is a smaller failure than
   * repetition, and repetition is the one that makes people mute a bot.
   *
   * The claim is a conditional `updateMany` on `lastDailySentOn`, so two runs
   * racing each other cannot both take the same student: whoever loses updates
   * zero rows and sends nothing.
   */
  async claimDaily(now: Date = new Date()): Promise<DailyClaim> {
    const today = addisDate(now);

    const candidates = await this.prisma.botProfile.findMany({
      select: { userId: true, chatId: true, botOptOut: true, lastDailySentOn: true },
    });
    const plan = planDaily(candidates, today);

    const recipients: DailyRecipient[] = [];
    for (const decision of plan.send) {
      const claimed = await this.prisma.botProfile.updateMany({
        // The guard is in the WHERE, not in the read above it. Two runs starting
        // together would otherwise both see `null` and both send.
        //
        // **`OR` with an explicit null, not `{ not: today }`.** In SQL a
        // comparison against NULL is unknown, not true, so `not` silently
        // excludes every row that has never been sent to — which is all of them
        // on day one. This is the same trap as T-065, where `NOT: { authorId }`
        // dropped every author-less question from the review queue. It presents
        // as "the job runs and nobody gets anything", with no error.
        where: {
          userId: decision.userId,
          botOptOut: false,
          OR: [{ lastDailySentOn: null }, { lastDailySentOn: { not: today } }],
        },
        data: { lastDailySentOn: today },
      });
      if (claimed.count === 0) continue;

      const question = await this.pickQuestion(decision.userId);
      const profile = candidates.find((c) => c.userId === decision.userId);
      if (!question || !profile?.chatId) continue;
      recipients.push({ userId: decision.userId, chatId: profile.chatId, question });
    }

    return {
      today,
      recipients,
      skipped: plan.skipped.map((d) => ({ userId: d.userId, reason: d.skip! })),
    };
  }

  /**
   * One published question from the student's own field.
   *
   * Deliberately not the practice sampler: that one enforces the free-tier limit
   * and the same-day rule, and a nudge is neither practice nor an entitlement.
   * It is a taste of the bank, and it must not consume anybody's allowance.
   */
  private async pickQuestion(userId: string): Promise<ServedQuestion | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) return null;

    const question = await this.prisma.question.findFirst({
      where: { fieldId: user.fieldId, status: 'PUBLISHED' },
      // Ordered, so the same bank produces the same question for everyone on a
      // given day rather than whatever Postgres happened to return first.
      orderBy: { stableId: 'asc' },
      include: { options: { orderBy: { label: 'asc' } }, topic: { select: { name: true } } },
    });
    return question ? toServedQuestion(question) : null;
  }
}
