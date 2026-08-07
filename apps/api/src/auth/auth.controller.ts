import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { AuthService, type LinkResult, type SignInResult } from './auth.service';
import { clearedSessionCookie, cookieOptionsFor, sessionCookie } from './session-cookie';
import { SessionGuard, type AuthedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Signs in from inside Telegram.
   *
   * Sets the session cookie **and** returns the token. The cookie is what the
   * web uses (T-112a); the token stays in the body for callers with nowhere to
   * put a cookie — a webview with cookies blocked, a script — and dropping it
   * would break them for no gain, since an httpOnly cookie is unreadable to a
   * script either way.
   */
  @Post('telegram')
  async telegram(
    @Res({ passthrough: true }) res: Response,
    @Body() body: { initData?: string; deviceLabel?: string },
  ): Promise<SignInResult> {
    const result = await this.auth.signInWithTelegram(body?.initData ?? '', body?.deviceLabel);
    res.setHeader('Set-Cookie', sessionCookie(result.token, cookieOptionsFor(process.env)));
    return result;
  }

  /**
   * Signs out: revokes the session row and clears the cookie.
   *
   * Both, deliberately. Clearing the cookie alone would leave a live session a
   * stolen token could still use, and revoking alone would leave the browser
   * sending a dead cookie on every request — signed out everywhere except in
   * the one place the student is looking.
   */
  @Post('sign-out')
  @UseGuards(SessionGuard)
  async signOut(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.revokeDevice(req.auth!.userId, req.auth!.sessionId);
    res.setHeader('Set-Cookie', clearedSessionCookie(cookieOptionsFor(process.env)));
    return { ok: true };
  }

  /**
   * Attaches a Telegram identity to the account this token belongs to.
   *
   * Guarded, and that is the point: the phone account is proved by the session
   * token and the Telegram account by the signed `initData`, so neither identity
   * is taken on the caller's word.
   */
  @Post('link/telegram')
  @UseGuards(SessionGuard)
  linkTelegram(
    @Req() req: AuthedRequest,
    @Body() body: { initData?: string },
  ): Promise<LinkResult> {
    return this.auth.linkTelegram(req.auth!.userId, body?.initData ?? '');
  }
}
