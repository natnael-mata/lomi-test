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
   * Starts registration: a one-time code to a phone number (T-264).
   *
   * Two rate limits, for two different abuses. The per-number one stops a
   * resend button spending a telecom balance; the per-address one stops
   * somebody walking a block of numbers to make us pay for the SMS. **Every
   * send costs money**, which is why this endpoint is the most heavily guarded
   * in the product.
   *
   * The cooldown itself lives in the service, because it is a fact about the
   * last code sent to that number rather than about this caller.
   */
  @Post('register/start')
  register(
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown },
  ): Promise<{ sent: true; expiresInSec: number }> {
    this.rateLimit.consume('otpSendAddress', null, req.ip ?? null);
    const phone = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    if (phone) this.rateLimit.consume('otpSend', phone, null);
    return this.auth.startPhoneRegistration(body?.phone);
  }

  /**
   * Finishes registration: the code, a password, and a session.
   *
   * Rate limited on the number being verified. Six digits is a million
   * possibilities only if the guesses are counted — the per-code attempt cap in
   * `otp.ts` handles one code, and this handles somebody burning through codes.
   */
  @Post('register/verify')
  async verify(
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown; code?: unknown; password?: unknown },
  ): Promise<SignInResult> {
    this.rateLimit.consume('otpVerifyAddress', null, req.ip ?? null);
    const phone = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    if (phone) this.rateLimit.consume('otpVerify', phone, null);

    const result = await this.auth.completePhoneRegistration(
      body?.phone,
      body?.code,
      body?.password,
    );
    res.setHeader('Set-Cookie', sessionCookie(result.token, cookieOptionsFor(process.env)));
    return result;
  }

  /**
   * Judges a code without spending it, so the code screen can refuse (T-268).
   *
   * **The screen that takes the code has to be the screen that rejects it.**
   * Verification only ever happened at `register/verify`, together with the
   * password, so a mistyped code was accepted in silence, the student picked a
   * password, and only then were they thrown back a screen — with an attempt
   * already gone and nothing on the code screen to say so. From the outside that
   * is indistinguishable from a client that never checks at all, which is
   * exactly how it was reported.
   *
   * Rate limited identically to `register/verify`: this is the same guess
   * against the same code, so it must cost the same.
   */
  @Post('register/check')
  registerCheck(
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown; code?: unknown },
  ): Promise<{ ok: true }> {
    this.rateLimit.consume('otpVerifyAddress', null, req.ip ?? null);
    const phone = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    if (phone) this.rateLimit.consume('otpVerify', phone, null);
    return this.auth.checkCode(body?.phone, 'REGISTER', body?.code);
  }

  /** The same judgement for the reset flow. See `registerCheck`. */
  @Post('password/reset/check')
  resetCheck(
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown; code?: unknown },
  ): Promise<{ ok: true }> {
    this.rateLimit.consume('otpVerifyAddress', null, req.ip ?? null);
    const phone = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    if (phone) this.rateLimit.consume('otpVerify', phone, null);
    return this.auth.checkCode(body?.phone, 'RESET', body?.code);
  }

  /**
   * Sends a code to reset a forgotten password (T-266).
   *
   * **The same limits as sign-up, on purpose.** Reset is a second equal front
   * door onto a live account, and a generous reset beside a strict sign-in is
   * the same as having no sign-in. An OTP that can set a password can take over
   * an account.
   */
  @Post('password/reset/start')
  resetStart(
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown },
  ): Promise<{ sent: true; expiresInSec: number }> {
    this.rateLimit.consume('otpSendAddress', null, req.ip ?? null);
    const phone = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    if (phone) this.rateLimit.consume('otpSend', phone, null);
    return this.auth.startPasswordReset(body?.phone);
  }

  /**
   * Proves the number, sets the new password, and signs the student in.
   *
   * Signing them in is the point: they have just proved they own the handset
   * and chosen a password with it, so asking them to type it again on the next
   * screen proves nothing and is one more place to get stuck.
   */
  @Post('password/reset/verify')
  async resetVerify(
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
    // `deviceLabel`, the same name sign-in uses. Two names for one thing is how
    // one of them ends up unset and every device row reads the same.
    @Body() body: { phone?: unknown; code?: unknown; password?: unknown; deviceLabel?: unknown },
  ): Promise<SignInResult> {
    this.rateLimit.consume('otpVerifyAddress', null, req.ip ?? null);
    const phone = typeof body?.phone === 'string' ? normaliseEthiopianMobile(body.phone) : null;
    if (phone) this.rateLimit.consume('otpVerify', phone, null);

    const result = await this.auth.completePasswordReset(
      body?.phone,
      body?.code,
      body?.password,
      typeof body?.deviceLabel === 'string' ? body.deviceLabel : '',
    );
    res.setHeader('Set-Cookie', sessionCookie(result.token, cookieOptionsFor(process.env)));
    return result;
  }

  /**
   * Signs in with a phone number and a password (T-263).
   *
   * **The only way in.** The Telegram deep link went first, and the smoke-test
   * bypass beside it went with T-206a; this is what is left, which is the point
   * of both removals.
   *
   * Keyed on the *address* as well as the number, deliberately and unlike the
   * practice limits: the whole point is somebody trying many accounts, so there
   * is no user to key on until they succeed.
   */
  @Post('sign-in')
  async signIn(
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
    @Body() body: { phone?: unknown; password?: unknown; deviceLabel?: string },
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

    const result = await this.auth.signInWithPassword(
      body?.phone,
      body?.password,
      body?.deviceLabel,
    );
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
