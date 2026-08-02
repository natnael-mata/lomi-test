import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FieldRequiredGuard } from './field-required.guard';
import { MeController } from './me.controller';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, SessionGuard, FieldRequiredGuard],
  exports: [AuthService, SessionGuard, FieldRequiredGuard],
})
export class AuthModule {}
