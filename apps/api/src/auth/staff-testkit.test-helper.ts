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

import { RateLimitService } from '../common/rate-limit.service';
import { hashPassword } from './password';
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
 * The password every fixture account is created with (T-264).
 *
 * A constant rather than a per-suite value: these accounts exist for the length
 * of one test file and the password is never a secret, only a way through the
 * door that replaced Telegram.
 */
export const TEST_ACCOUNT_PASSWORD = 'fixture-password-2026';

/**
 * A phone number derived from the fixture's telegram id.
 *
 * Suites already allocate unique telegram ids to avoid colliding with each
 * other; deriving the number from that id inherits the uniqueness rather than
 * asking every suite to invent a second scheme. `09` plus eight digits is the
 * shape a real Ethiopian mobile has, and these are in an unallocated prefix.
 */
export function testPhone(telegramId: number): string {
  return `09${String(Math.abs(telegramId) % 100_000_000).padStart(8, '0')}`;
}

/**
 * Creates the account and signs in with a phone number and a password.
 *
 * **Telegram sign-in was removed (T-265)**, so the fixtures use the door that
 * replaced it. The account is written directly rather than registered through
 * the OTP flow: a test that wanted a signed-in user should not have to read a
 * one-time code out of a log, and `register.e2e.test.ts` is what proves the
 * real registration path works.
 *
 * The telegram id is still set, because Telegram remains a *linked channel* and
 * several suites clean up by it.
 */
export async function signInByPhone(
  app: INestApplication,
  prisma: PrismaService,
  telegramId: number,
  deviceLabel?: string,
): Promise<{ token: string; userId: string; sessionId: string }> {
  const phone = testPhone(telegramId);
  const passwordHash = await hashPassword(TEST_ACCOUNT_PASSWORD);

  await prisma.user.upsert({
    where: { telegramId: String(telegramId) },
    update: { phone, passwordHash, deactivatedAt: null },
    create: {
      telegramId: String(telegramId),
      phone,
      passwordHash,
      displayName: `Fixture ${telegramId}`,
    },
  });

  /*
   * A clean allowance for every fixture sign-in.
   *
   * The per-number limit is five in ten minutes, which is right for a person
   * and wrong for a suite that signs the same account in four times to prove
   * device eviction. Reset here rather than in each test, so no suite has to
   * know the limit exists — `password-sign-in.e2e.test.ts` is where it is
   * tested on purpose.
   */
  app.get(RateLimitService).reset();

  const body = (
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ phone, password: TEST_ACCOUNT_PASSWORD, deviceLabel })
      .expect(201)
  ).body as { token: string; userId: string; sessionId: string };
  return body;
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

  const body = await signInByPhone(app, prisma, telegramId);

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
