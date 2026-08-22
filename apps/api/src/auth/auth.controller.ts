import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';

import { normaliseEthiopianMobile } from '../common/phone';
import { RateLimitService } from '../common/rate-limit.service';
import { AuthService, type LinkResult, type SignInResult } from './auth.service';
import { clearedSessionCookie, cookieOptionsFor, sessionCookie } from './session-cookie';
import { SessionGuard, type AuthedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

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
   * Smoke-test sign-in (deploy testing only).
   *
   * **An authentication bypass, and it is spelled that way on purpose.** It
   * exists because Telegram deep-link is the only real way in, which makes
   * clicking through a freshly deployed box impossible until a bot, a token and
   * a phone all exist.
   *
   * Off unless `DEV_LOGIN_SECRET` is set to something at least 32 characters
   * long — no default and no "development mode" inference, so every environment
   * is closed until somebody types the variable. It can only ever sign in
   * accounts it minted itself, under a reserved negative Telegram id, so a
   * leaked secret is a nuisance rather than a takeover of every account.
   *
   * Delete before launch: T-206a.
   */
  /**
   * Signs in with a phone number and a password (T-263).
   *
   * Rate limited on the same `signIn` bucket as the Telegram door — five in ten
   * minutes. A password door is the one worth guessing at, and a second door
   * with its own allowance would be a cheaper way in beside a guarded one.
   *
   * Keyed on the *address* here rather than the user, deliberately and unlike
   * the practice limits: the whole point is somebody trying many accounts, so
   * there is no user to key on until they succeed.
   */
  @Post('sign-in')
  async signIn(
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown; password?: unknown },
  ): Promise<SignInResult> {
    /*
     * Two buckets, and the tight one is keyed on the number (T-263).
     *
     * An address is a room in this product — school labs and shared mobile NAT
     * — so limiting sign-in by address means one student's typo locks out
     * everybody near them. The per-phone bucket protects the account; the looser
     * per-address one catches somebody walking a block of numbers.
     *
     * Normalised before it is keyed, or `0911…` and `+251911…` would each get
     * their own five attempts against the same account.
     */
    const attempted = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    this.rateLimit.consume('passwordSignInAddress', null, req.ip ?? null);
    if (attempted) this.rateLimit.consume('passwordSignIn', attempted, null);

    const result = await this.auth.signInWithPassword(body?.phone, body?.password);
    res.setHeader('Set-Cookie', sessionCookie(result.token, cookieOptionsFor(process.env)));
    return result;
  }

  @Post('dev-login')
  async devLogin(
    @Res({ passthrough: true }) res: Response,
    @Body() body: { secret?: string; label?: string },
  ): Promise<SignInResult> {
    const result = await this.auth.signInAsTester(body?.secret ?? '', body?.label ?? 'student');
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
