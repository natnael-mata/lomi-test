import { Body, Controller, Post } from '@nestjs/common';

import { AuthService, type SignInResult } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram')
  telegram(@Body() body: { initData?: string; deviceLabel?: string }): Promise<SignInResult> {
    return this.auth.signInWithTelegram(body?.initData ?? '', body?.deviceLabel);
  }
}
