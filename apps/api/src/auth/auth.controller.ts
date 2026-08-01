import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { AuthService, type LinkResult, type SignInResult } from './auth.service';
import { SessionGuard, type AuthedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram')
  telegram(@Body() body: { initData?: string; deviceLabel?: string }): Promise<SignInResult> {
    return this.auth.signInWithTelegram(body?.initData ?? '', body?.deviceLabel);
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
