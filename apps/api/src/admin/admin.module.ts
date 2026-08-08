import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AdminAnalyticsController, AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminModule {}
