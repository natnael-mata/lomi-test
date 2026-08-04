import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FieldRequiredGuard } from './field-required.guard';
import { MeController } from './me.controller';
import { SessionGuard } from './session.guard';
import { AdminGuard, StaffGuard } from './staff.guard';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, SessionGuard, FieldRequiredGuard, StaffGuard, AdminGuard],
  exports: [AuthService, SessionGuard, FieldRequiredGuard, StaffGuard, AdminGuard],
})
export class AuthModule {}
