/**
 * The health check reports what it checked (T-268).
 *
 * It used to return a hardcoded `{"status":"ok"}`, which stayed green through a
 * total authentication outage — `JWT_SECRET` unset, every sign-in a 500, nobody
 * able to reach any screen. A check that cannot fail is not a check.
 */
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

/** Just enough Response to record the status a handler asked for. */
function fakeRes() {
  return { statusCode: 200, status(code: number) { this.statusCode = code; return this; } };
}

const reachable = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
const down = { $queryRaw: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };

describe('HealthController (T-268)', () => {
  it('reports ok when the secret is set and the database answers', async () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    const res = fakeRes();
    const body = await new HealthController(reachable as unknown as PrismaService).check(
      res as never,
    );

    expect(body).toEqual({ status: 'ok', checks: { config: 'ok', database: 'ok' } });
    expect(res.statusCode).toBe(200);
  });

  /*
   * THE regression. This is the exact state the service was in while answering
   * `{"status":"ok"}`: alive, database fine, and unable to mint a session.
   */
  it('is unhealthy, and 503, when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    const res = fakeRes();
    const body = await new HealthController(reachable as unknown as PrismaService).check(
      res as never,
    );

    expect(body.status).toBe('unhealthy');
    expect(body.checks.config).toContain('JWT_SECRET');
    expect(res.statusCode).toBe(503);
  });

  it('is unhealthy when the database cannot be reached', async () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    const res = fakeRes();
    const body = await new HealthController(down as unknown as PrismaService).check(res as never);

    expect(body.status).toBe('unhealthy');
    expect(body.checks.database).toBe('unreachable');
    expect(res.statusCode).toBe(503);
  });

  /** The driver's error text carries the connection string, password included. */
  it('never puts the database error into the response', async () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    const secret = { $queryRaw: vi.fn().mockRejectedValue(new Error('postgresql://u:hunter2@h/db')) };
    const body = await new HealthController(secret as unknown as PrismaService).check(
      fakeRes() as never,
    );

    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('postgresql://');
  });
});
