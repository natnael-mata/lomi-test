import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { RateLimitService } from './rate-limit.service';
import { RetryAfterFilter } from './retry-after.filter';

/**
 * Global so the limiter is one instance.
 *
 * Its store is in-process (see the service), so a second instance would be a
 * second set of counters — the limit would silently double and nothing would
 * look wrong.
 */
@Global()
@Module({
  providers: [
    RateLimitService,
    // Registered here rather than in `main.ts` so the header is present in the
    // e2e tests too — a `Retry-After` that only exists in production is one
    // nothing verifies.
    { provide: APP_FILTER, useClass: RetryAfterFilter },
  ],
  exports: [RateLimitService],
})
export class CommonModule {}
