/**
 * Integration test — signing in with a phone number and a password (T-263).
 *
 * **The phone number is the username.** It is the one identifier an Ethiopian
 * student already has, cannot forget, and that a reset can be sent to.
 *
 * Two properties this suite exists to hold, both of which are invisible when
 * they break:
 *
 * **The failure message never says which part was wrong.** Unknown number, no
 * password set, wrong password — one answer for all three. Telling them apart
 * is an oracle, and in a country where mobile numbers are issued in guessable
 * blocks, "which of these numbers has an account" is a list worth having.
 *
 * **The tight rate limit is keyed on the number, not the address.** This product
 * runs in school computer labs and behind shared mobile NAT, where an address is
 * a room. An IP-keyed sign-in limit means the first student to mistype their
 * password locks out everyone around them.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../common/rate-limit.service';
import { hashPassword } from './password';
import { TEST_BOT_TOKEN, TEST_JWT_SECRET } from './staff-testkit.test-helper';

const SFX = 'e2e-password';
const PHONE = '0912000001';
const OTHER = '0912000002';
const NO_PASSWORD = '0912000003';
const PASSWORD = 'lemonade-2026';

describe('signing in with a phone and a password (T-263)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let limits: RateLimitService;

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { displayName: { contains: SFX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    limits = app.get(RateLimitService);
    await wipe();

    await prisma.user.create({
      data: {
        displayName: `Signer ${SFX}`,
        phone: PHONE,
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    await prisma.user.create({
      data: {
        displayName: `Other ${SFX}`,
        phone: OTHER,
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    // An account that has never set one — today, every Telegram-first account.
    await prisma.user.create({ data: { displayName: `Passwordless ${SFX}`, phone: NO_PASSWORD } });
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  // Every test starts with a clean allowance; the limits have their own block.
  beforeEach(() => limits.reset());

  const signIn = (phone: unknown, password: unknown) =>
    request(app.getHttpServer()).post('/auth/sign-in').send({ phone, password });

  it('signs in and returns a session', async () => {
    const res = await signIn(PHONE, PASSWORD).expect(201);
    expect(res.body.displayName).toBe(`Signer ${SFX}`);
    expect(res.body.token).toBeTruthy();
    expect(res.headers['set-cookie']?.join(' ')).toContain('lomi_session');
  });

  /*
   * People write their number every way there is, and all of them are the same
   * handset. Refusing four of the five is a sign-in that fails for reasons
   * nobody can see.
   */
  it('accepts the same handset written any of the usual ways', async () => {
    for (const written of ['0912000001', '+251912000001', '251912000001', '251 91 200 0001']) {
      const res = await signIn(written, PASSWORD);
      expect(res.status, written).toBe(201);
      expect(res.body.displayName, written).toBe(`Signer ${SFX}`);
      limits.reset();
    }
  });

  it('never returns the password or its hash', async () => {
    const res = await signIn(PHONE, PASSWORD).expect(201);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(PASSWORD);
    expect(body).not.toContain('scrypt');
    expect(body).not.toContain('passwordHash');
  });

  /*
   * THE test. Three different failures, one answer — otherwise the error is a
   * directory of which numbers hold accounts.
   */
  it('answers the same way for a wrong password, an unknown number and no password', async () => {
    const wrong = await signIn(PHONE, 'not-the-password');
    limits.reset();
    const unknown = await signIn('0912999999', PASSWORD);
    limits.reset();
    const none = await signIn(NO_PASSWORD, PASSWORD);

    for (const res of [wrong, unknown, none]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('SIGN_IN_FAILED');
    }
    // Byte for byte. A difference in wording is the same oracle as a difference
    // in status.
    expect(unknown.body.message).toBe(wrong.body.message);
    expect(none.body.message).toBe(wrong.body.message);
  });

  it('refuses a deactivated account the same way (T-164)', async () => {
    await prisma.user.update({ where: { phone: OTHER }, data: { deactivatedAt: new Date() } });
    const res = await signIn(OTHER, PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('SIGN_IN_FAILED');
    await prisma.user.update({ where: { phone: OTHER }, data: { deactivatedAt: null } });
  });

  it('refuses a number that is not a mobile at all', async () => {
    for (const bad of ['', 'nonsense', '011111111', '09112233']) {
      expect((await signIn(bad, PASSWORD)).status).toBe(401);
      limits.reset();
    }
  });

  describe('the rate limit', () => {
    /*
     * Keyed on the number. An address is a room in this product — school labs
     * and shared mobile NAT — so limiting by address means one student's typo
     * locks out everybody near them.
     */
    it('locks the account being guessed, not the room', async () => {
      for (let i = 0; i < 5; i++) await signIn(PHONE, 'wrong');
      expect((await signIn(PHONE, PASSWORD)).status).toBe(429);

      // The student at the next desk, on the same address, is unaffected.
      const neighbour = await signIn(OTHER, PASSWORD);
      expect(neighbour.status).toBe(201);
    });

    it('says how long to wait', async () => {
      for (let i = 0; i < 6; i++) await signIn(PHONE, 'wrong');
      const res = await signIn(PHONE, 'wrong');
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });
  });
});
