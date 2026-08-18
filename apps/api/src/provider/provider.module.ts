import { Module } from '@nestjs/common';

import { ActivityService } from './activity.service';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProviderController } from './provider.controller';

/**
 * Oversight (T-227, T-228).
 *
 * Its own module rather than more routes under `admin/`, because the boundary
 * is the point: everything here is PROVIDER-guarded and read-only, and putting
 * it beside the routes that change things is how a write ends up behind the
 * wrong guard.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProviderController],
  providers: [ActivityService, HealthService],
})
export class ProviderModule {}
