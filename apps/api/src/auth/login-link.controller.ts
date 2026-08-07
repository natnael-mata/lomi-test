import { Body, Controller, Get, Ip, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { BotGuard } from './bot.guard';
import { cookieOptionsFor, sessionCookie } from './session-cookie';
import type { SignInResult } from './auth.service';
import {
  LoginLinkService,
  type LoginLinkCreated,
  type LoginLinkStatus,
  type PendingPrompt,
} from './login-link.service';

/**
 * Signing in on the web through the Telegram bot (T-075–T-078).
 *
 * Two audiences on one resource, split by guard. The student-facing half is
 * unauthenticated by necessity — it is the sign-in — and gives away nothing: a
 * nonce alone produces no session, and the state of somebody else's in-flight
 * login is not readable without their secret.
 *
 * The bot-facing half is behind `BotGuard`. It is the dangerous half: a caller
 * who can reach `approve` with a Telegram id of their choosing can sign in as
 * that person.
 */
@Controller('auth/login-link')
export class LoginLinkController {
  constructor(private readonly login: LoginLinkService) {}

  /** Mints a request. The `pollSecret` in the response never leaves the browser. */
  @Post()
  create(@Ip() ip: string, @Body() body: { deviceLabel?: string }): Promise<LoginLinkCreated> {
    return this.login.create(ip || null, body?.deviceLabel);
  }

  /**
   * Exchanges the browser's secret for a session once the student has confirmed.
   *
   * 202 while the request is still pending — the browser polls this, and
   * "not yet" is the ordinary answer, not a failure.
   */
  @Post('claim')
  async claim(
    @Res({ passthrough: true }) res: Response,
    @Body() body: { nonce?: string; pollSecret?: string; deviceLabel?: string },
  ): Promise<SignInResult | { pending: true }> {
    const result = await this.login.claim(
      body?.nonce ?? '',
      body?.pollSecret ?? '',
      body?.deviceLabel,
    );
    if (!result) return { pending: true };
    // The session cookie is set here, on the one route that turns a confirmed
    // login into a session (T-112a).
    res.setHeader('Set-Cookie', sessionCookie(result.token, cookieOptionsFor(process.env)));
    return result;
  }

  /** What the page shows while waiting. Carries no identity and no secret. */
  @Get(':nonce/status')
  status(@Param('nonce') nonce: string): Promise<LoginLinkStatus> {
    return this.login.status(nonce);
  }

  /** Bot only: what to put in the confirmation prompt. */
  @Get(':nonce/prompt')
  @UseGuards(BotGuard)
  prompt(@Param('nonce') nonce: string): Promise<PendingPrompt> {
    return this.login.prompt(nonce);
  }

  /**
   * Bot only: the student confirmed.
   *
   * The Telegram identity comes from the bot, which had it from Telegram. No
   * student-reachable route can supply it, which is what keeps a browser from
   * naming whose account it is signing in to.
   */
  @Post(':nonce/approve')
  @UseGuards(BotGuard)
  approve(
    @Param('nonce') nonce: string,
    @Body() body: { telegramId?: string; telegramUsername?: string },
  ): Promise<{ pairingCode: string }> {
    return this.login.approve(nonce, {
      id: String(body?.telegramId ?? ''),
      username: body?.telegramUsername ?? null,
    });
  }

  /** Bot only: the student said it was not them. */
  @Post(':nonce/decline')
  @UseGuards(BotGuard)
  async decline(@Param('nonce') nonce: string): Promise<{ ok: true }> {
    await this.login.decline(nonce);
    return { ok: true };
  }
}
