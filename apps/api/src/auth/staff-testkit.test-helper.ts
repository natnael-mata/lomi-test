/**
 * Signing in as staff, for integration tests.
 *
 * Named `*.test-helper.ts` and excluded from the build alongside `*.test.ts`:
 * this mints sessions and grants staff rows, and none of it belongs in `dist`.
 *
 * It exists because `/admin/*` became staff-only and four existing test suites
 * were calling those routes unauthenticated — which is exactly the hole that was
 * closed. Rather than weaken the guard for tests, the tests now hold a real
 * credential.
 */
import { createHmac } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';
import request from 'supertest';

import type { PrismaService } from '../prisma/prisma.service';

export const TEST_BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
export const TEST_JWT_SECRET = 'test-secret-not-a-real-one';

/** A signed `initData` for a synthetic Telegram user. */
export function testInitData(telegramId: number): string {
  const user = JSON.stringify({ id: telegramId, first_name: 'Test' });
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user,
  };
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secret = createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

export interface StaffSession {
  token: string;
  userId: string;
  /** `Authorization: Bearer …`, ready to spread into `.set()`. */
  auth: { Authorization: string };
}

/**
 * Signs in and grants the role.
 *
 * `grantedBy` is tagged with the caller's suffix so a suite can delete exactly
 * its own grants and leave everyone else's alone — the same discipline every
 * other fixture here uses.
 */
export async function signInAsStaff(
  app: INestApplication,
  prisma: PrismaService,
  telegramId: number,
  role: StaffRole,
  suffix: string,
): Promise<StaffSession> {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const body = (
    await request(app.getHttpServer())
      .post('/auth/telegram')
      .send({ initData: testInitData(telegramId) })
      .expect(201)
  ).body as { token: string; userId: string };

  await prisma.staffMember.upsert({
    where: { userId: body.userId },
    update: { role },
    create: { userId: body.userId, role, grantedBy: `test-${suffix}` },
  });

  return {
    token: body.token,
    userId: body.userId,
    auth: { Authorization: `Bearer ${body.token}` },
  };
}

/** Removes the sessions, users and grants a suite created. */
export async function cleanupStaff(
  prisma: PrismaService,
  telegramIds: number[],
  suffix: string,
): Promise<void> {
  const ids = telegramIds.map(String);
  await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${suffix}` } });
  await prisma.session.deleteMany({ where: { user: { telegramId: { in: ids } } } });
  await prisma.user.deleteMany({ where: { telegramId: { in: ids } } });
}
