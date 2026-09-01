import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Whether this process can actually serve requests (T-268).
 *
 * **It used to return `{"status":"ok"}` unconditionally.** A hardcoded literal
 * answers "is a Node process listening", which the TCP connection already
 * proved. During a total authentication outage — `JWT_SECRET` unset, every
 * sign-in a 500, nobody able to reach any screen — this endpoint stayed green,
 * and a tester reasonably called that worse than having no health check at all.
 *
 * So it checks the two things the service cannot work without and reports what
 * it found. The database is a real round trip: a pool that has lost its
 * connection is the most common way this process stops being useful while
 * remaining alive, and it is invisible from the outside until a student meets
 * it.
 *
 * 503 rather than a 200 with `"status":"degraded"`, because the consumers are
 * load balancers and uptime checks that read the status line. A body that says
 * "unhealthy" under a 200 is a health check that still lies, just more
 * verbosely.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<{
    status: string;
    checks: Record<string, string>;
  }> {
    const checks: Record<string, string> = {};

    // Named, never echoed. The value is the one secret in the process that
    // would let somebody mint a session for any account.
    checks.config = (process.env.JWT_SECRET ?? '').trim() === '' ? 'JWT_SECRET missing' : 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      // No driver text: it carries the connection string, password included.
      checks.database = 'unreachable';
    }

    const failed = Object.values(checks).some((value) => value !== 'ok');
    if (failed) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: failed ? 'unhealthy' : 'ok', checks };
  }
}
