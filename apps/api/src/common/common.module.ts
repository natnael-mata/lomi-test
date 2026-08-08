import { Global, Module } from '@nestjs/common';

import { RateLimitService } from './rate-limit.service';

/**
 * Global so the limiter is one instance.
 *
 * Its store is in-process (see the service), so a second instance would be a
 * second set of counters — the limit would silently double and nothing would
 * look wrong.
 */
@Global()
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class CommonModule {}
