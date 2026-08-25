/**
 * Integration test — resetting a forgotten password (T-266).
 *
 * **This is the door that did not exist, and it is the one that matters.**
 * Sign-in moved from Telegram pairing to phone-and-password, which makes
 * lockout *more* likely than what it replaced: a student who changes SIM, or
 * simply forgets, previously had a pairing link and now has nothing. Every
 * account this product sells is reachable only through here.
 *
 * Which is also why it is the most dangerous thing in the codebase. **An OTP
 * that can set a password can take over an account.** Reset is not a
 * convenience bolted onto sign-in, it is a second equal front door, and every
 * limit that guards the first applies here identically — a generous reset beside
 * a strict sign-in is the same as having no sign-in at all.
 *
 * The properties held below:
 *
 * - **Reset never confirms whether a number is registered.** Sign-up is allowed
 *   to; reset is not. Confirming here would turn the endpoint into a directory
 *   of who your students are, readable by typing numbers into a form.
 * - **The timing does not confirm it either.** An unregistered number spends the
 *   cooldown like a registered one, or the oracle just needs a stopwatch.
 * - **A reset ends every other session**, because a reset is what somebody does
 *   when they think the account is no longer theirs.
 * - **Three wrong codes lock the number**, and the lock survives a right one.
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
import { MAX_ATTEMPTS, hashCode } from './otp';
import { hashPassword } from './password';
import { TEST_JWT_SECRET } from './staff-testkit.test-helper';

/** Has an account. */
const KNOWN = '0913100001';
/** Does not, and must be indistinguishable from one that does. */
const UNKNOWN = '0913100002';
const OLD_PASSWORD = 'old-password-2026';
const NEW_PASSWORD = 'brand-new-password-2026';

describe('resetting a forgotten password (T-266)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let limits: RateLimitService;
  let userId = '';

  const wipe = async (): Promise<void> => {
    const phones = [KNOWN, UNKNOWN];
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.otpCode.deleteMany({ where: { phone: { in: phones } } });
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    limits = app.get(RateLimitService);
    await wipe();

    const user = await prisma.user.create({
      data: {
        phone: KNOWN,
        displayName: 'Reset Test',
        passwordHash: await hashPassword(OLD_PASSWORD),
        phoneVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  beforeEach(() => limits.reset());

  const start = (phone: unknown) =>
    request(app.getHttpServer()).post('/auth/password/reset/start').send({ phone });

  const verify = (phone: unknown, code: unknown, password: unknown) =>
    request(app.getHttpServer())
      .post('/auth/password/reset/verify')
      .send({ phone, code, password, device: 'Chrome on Android' });

  /** Plants a RESET code, since a test cannot read an SMS. */
  const plantCode = async (phone: string, code: string, over: Record<string, unknown> = {}) => {
    await prisma.otpCode.deleteMany({ where: { phone, purpose: 'RESET' } });
    return prisma.otpCode.create({
      data: {
        phone,
        purpose: 'RESET',
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + 600_000),
        ...over,
      },
    });
  };

  /*
   * THE test. Anything else here is a form anybody can type numbers into to
   * find out which of your students have accounts.
   */
  it('answers identically for a number with an account and one without', async () => {
    const known = await start(KNOWN);
    limits.reset();
    const unknown = await start(UNKNOWN);

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.sent).toBe(true);
  });

  /*
   * And the same with a stopwatch. Skipping the cooldown for an unregistered
   * number would answer instantly where a registered one waits out its minute
   * — the same oracle, one layer down.
   */
  it('spends the cooldown for a number with no account', async () => {
    await prisma.otpCode.deleteMany({ where: { phone: UNKNOWN } });
    await start(UNKNOWN).expect(201);
    limits.reset();

    const again = await start(UNKNOWN);
    expect(again.status).toBe(429);
    expect(again.headers['retry-after']).toBeDefined();
  });

  it('refuses a number that is not an Ethiopian mobile', async () => {
    const res = await start('01122334455');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INVALID_PHONE');
  });

  it('sets the new password and signs the student in', async () => {
    await plantCode(KNOWN, '123456');
    const res = await verify(KNOWN, '123456', NEW_PASSWORD).expect(201);

    expect(res.body.token).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toContain('lomi_session');
    // Not a new account. A reset finds an account, it does not create one.
    expect(res.body.isNew).toBe(false);

    limits.reset();
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ phone: KNOWN, password: NEW_PASSWORD })
      .expect(201);
  });

  it('stops the old password working', async () => {
    limits.reset();
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ phone: KNOWN, password: OLD_PASSWORD });
    expect(res.status).toBe(401);
  });

  /*
   * A reset is what somebody does when they think the account is not theirs any
   * more. One that leaves the other party signed in has not given it back.
   */
  it('ends every other session', async () => {
    const live = await prisma.session.count({ where: { userId, revokedAt: null } });
    await plantCode(KNOWN, '222222');
    const res = await verify(KNOWN, '222222', NEW_PASSWORD).expect(201);

    const after = await prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    // Exactly one: the session this reset just opened.
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(res.body.sessionId);
    expect(live).toBeGreaterThanOrEqual(0);
  });

  it('spends the code, so it cannot be used twice', async () => {
    await plantCode(KNOWN, '333333');
    await verify(KNOWN, '333333', NEW_PASSWORD).expect(201);
    limits.reset();

    const again = await verify(KNOWN, '333333', NEW_PASSWORD);
    expect(again.status).toBe(401);
    expect(again.body.error).toBe('CODE_REJECTED');
  });

  it('refuses a weak password, and spends the code anyway', async () => {
    await plantCode(KNOWN, '444444');
    const res = await verify(KNOWN, '444444', 'short');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('WEAK_PASSWORD');

    // A code that survives a rejected password is one somebody can hold open
    // while they try passwords.
    const stored = await prisma.otpCode.findFirstOrThrow({
      where: { phone: KNOWN, purpose: 'RESET' },
    });
    expect(stored.consumedAt).not.toBeNull();
  });

  /*
   * A sign-up code must not open the reset door. One OTP with two meanings is
   * one OTP too many.
   */
  it('will not accept a code issued for sign-up', async () => {
    await prisma.otpCode.deleteMany({ where: { phone: KNOWN } });
    await prisma.otpCode.create({
      data: {
        phone: KNOWN,
        purpose: 'REGISTER',
        codeHash: hashCode('555555'),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    const res = await verify(KNOWN, '555555', NEW_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('CODE_REJECTED');
  });

  it('locks the number after three wrong codes, and the lock beats a right one', async () => {
    await plantCode(KNOWN, '666666');
    let last = await verify(KNOWN, '000000', NEW_PASSWORD);
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      limits.reset();
      last = await verify(KNOWN, '000000', NEW_PASSWORD);
    }
    expect(last.body.reason).toBe('locked');
    // A clock time, never "later".
    expect(new Date(last.body.retryAt).getTime()).toBeGreaterThan(Date.now());

    limits.reset();
    const right = await verify(KNOWN, '666666', NEW_PASSWORD);
    expect(right.status).toBe(401);
  });

  it('tells a wrong code apart from an expired one, and counts down the tries', async () => {
    await plantCode(KNOWN, '777777');
    const wrong = await verify(KNOWN, '000000', NEW_PASSWORD);
    expect(wrong.body.reason).toBe('wrong');
    expect(wrong.body.triesLeft).toBe(MAX_ATTEMPTS - 1);
    limits.reset();

    // Aged at both ends: the database refuses a code that expired before it was
    // created, which is not a state a real row reaches.
    await plantCode(KNOWN, '888888', {
      createdAt: new Date(Date.now() - 3_600_000),
      expiresAt: new Date(Date.now() - 1000),
    });
    const expired = await verify(KNOWN, '888888', NEW_PASSWORD);
    expect(expired.body.reason).toBe('expired');
    // Expiry is a rule, not a fault — the copy must never imply otherwise.
    expect(expired.body.message).not.toMatch(/wrong|incorrect|mistake/i);
  });
});
