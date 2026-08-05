import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginLinkController } from './login-link.controller';
import { LoginLinkService } from './login-link.service';
import { FieldRequiredGuard } from './field-required.guard';
import { MeController } from './me.controller';
import { SessionGuard } from './session.guard';
import { AdminGuard, StaffGuard } from './staff.guard';

@Module({
  controllers: [AuthController, LoginLinkController, MeController],
  providers: [
    AuthService,
    LoginLinkService,
    SessionGuard,
    FieldRequiredGuard,
    StaffGuard,
    AdminGuard,
  ],
  exports: [
    AuthService,
    LoginLinkService,
    SessionGuard,
    FieldRequiredGuard,
    StaffGuard,
    AdminGuard,
  ],
})
export class AuthModule {}
