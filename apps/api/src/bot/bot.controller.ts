import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { BotGuard } from '../auth/bot.guard';
import { BotService, type DailyClaim } from './bot.service';

/**
 * The routes the bot calls (T-180, T-181, T-182).
 *
 * All behind `BotGuard` — the bot is a server, not a student, and these take a
 * `userId` as an argument rather than from a session. That is only safe because
 * nothing student-reachable can call them.
 */
@Controller('bot')
@UseGuards(BotGuard)
export class BotController {
  constructor(private readonly bot: BotService) {}

  /**
   * First `/start`: records the chat and, once only, the referral code.
   *
   * Takes the Telegram id, because that is all the bot has — somebody opening
   * the bot for the first time has never signed in, and attribution has to
   * happen at first contact or not at all.
   */
  @Post('arrival')
  arrival(
    @Body()
    body: {
      telegramId?: string;
      telegramUsername?: string;
      chatId?: string;
      payload?: string;
    },
  ): Promise<{ userId: string; referredVia: string | null; wasFirst: boolean }> {
    return this.bot.recordArrival(
      { id: String(body?.telegramId ?? ''), username: body?.telegramUsername ?? null },
      body?.chatId ?? '',
      body?.payload ?? '',
    );
  }

  /** Turns nudges off or back on. */
  @Post('opt-out')
  optOut(@Body() body: { userId?: string; optOut?: boolean }): Promise<{ botOptOut: boolean }> {
    return this.bot.setOptOut(body?.userId ?? '', body?.optOut !== false);
  }

  /**
   * Claims today's batch. Marks before sending — see the service for why
   * at-most-once is the right trade for a nudge.
   */
  @Post('daily/claim')
  claimDaily(): Promise<DailyClaim> {
    return this.bot.claimDaily();
  }
}
