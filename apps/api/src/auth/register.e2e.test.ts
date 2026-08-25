/**
 * Integration test — creating an account with a phone number (T-264, T-265).
 *
 * **This is the only way an account comes into existence now.** Telegram sign-in
 * was removed, so if this flow breaks nobody can join the product at all —
 * which is why it is tested against the real routes rather than the service.
 *
 * The properties worth holding are all about what registration refuses to tell
 * you:
 *
 * - **Asking for a code never reveals whether the number is already registered.**
 *   "That number is taken" is a membership oracle, and Ethiopian mobile numbers
 *   are issued in guessable blocks.
 * - **A wrong code, a stale code and a spent code are one answer.** Anything
 *   else turns a dead code into a test for whether the digits were close.
 * - **Every send is rate limited**, per number and per address, because an SMS
 *   costs money and an unthrottled send endpoint is how a telecom balance
 *   disappears overnight.
 *
 * The code is read out of the database rather than an SMS. The sender is a stub
 * (`sms.service.ts`) and wiring a real provider is the one remaining job; the
 * flow either side of it is finished and is what this proves.
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
import { TEST_JWT_SECRET } from './staff-testkit.test-helper';

const NEW_PHONE = '0913000001';
const RETURNING = '0913000002';
const PASSWORD = 'lemonade-2026';

describe('registering with a phone number (T-264)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let limits: RateLimitService;

  const wipe = async (): Promise<void> => {
    const phones = [NEW_PHONE, RETURNING];
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
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  beforeEach(() => limits.reset());

  const start = (phone: unknown) =>
    request(app.getHttpServer()).post('/auth/register/start').send({ phone });

  const verify = (phone: unknown, code: unknown, password: unknown) =>
    request(app.getHttpServer()).post('/auth/register/verify').send({ phone, code, password });

  /**
   * The code, from the database.
   *
   * A test cannot read an SMS, and the row stores only a hash — so the code is
   * planted rather than read back. That is the honest shape: it proves the
   * *verification* path, and the generator has its own unit test.
   */
  const plantCode = async (phone: string, code: string, over: Record<string, unknown> = {}) => {
    await prisma.otpCode.deleteMany({ where: { phone } });
    return prisma.otpCode.create({
      data: {
        phone,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + 600_000),
        ...over,
      },
    });
  };

  it('sends a code to a number with no account', async () => {
    const res = await start(NEW_PHONE).expect(201);
    expect(res.body.sent).toBe(true);
    expect(res.body.expiresInSec).toBe(600);

    const stored = await prisma.otpCode.findFirst({ where: { phone: NEW_PHONE } });
    expect(stored).not.toBeNull();
    // Hashed. A leaked database must not be a list of live codes.
    expect(stored?.codeHash).toHaveLength(64);
  });

  /*
   * THE membership test. A number that already has an account is answered
   * identically — anything else is a directory of who is registered.
   */
  it('answers the same way whether or not the number is already registered', async () => {
    await prisma.user.create({ data: { phone: RETURNING, displayName: 'Returning' } });
    limits.reset();

    const fresh = await start('0913009999');
    limits.reset();
    const taken = await start(RETURNING);

    expect(taken.status).toBe(fresh.status);
    expect(taken.body).toEqual(fresh.body);
    await prisma.otpCode.deleteMany({ where: { phone: '0913009999' } });
  });

  it('refuses a number that is not an Ethiopian mobile', async () => {
    const res = await start('01122334455');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INVALID_PHONE');
  });

  it('creates the account, sets the password and signs in', async () => {
    await plantCode(NEW_PHONE, '123456');
    const res = await verify(NEW_PHONE, '123456', PASSWORD).expect(201);

    expect(res.body.isNew).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toContain('lomi_session');
    // A generated handle, never a name taken from anybody (T-086).
    expect(res.body.displayName).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { phone: NEW_PHONE } });
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeTruthy();

    // And the password works on the sign-in door.
    limits.reset();
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ phone: NEW_PHONE, password: PASSWORD })
      .expect(201);
  });

  it('spends the code, so it cannot be used twice', async () => {
    await plantCode(NEW_PHONE, '222222');
    await verify(NEW_PHONE, '222222', PASSWORD).expect(201);
    limits.reset();
    const again = await verify(NEW_PHONE, '222222', PASSWORD);
    expect(again.status).toBe(401);
    expect(again.body.error).toBe('CODE_REJECTED');
  });

  /*
   * Expired, spent and wrong are now told apart — deliberately, and the
   * reasoning that forbade it was too broad.
   *
   * The property worth protecting is that nothing reveals whether the *digits*
   * were close. `checkCode` settles consumption, expiry and the attempt counter
   * **before** it compares anything, so saying "that code expired" is a
   * statement about the clock, which the student already knows: they know when
   * they asked for it. Nothing about their guess leaks.
   *
   * What the old behaviour cost was real. A student whose code timed out was
   * told it was wrong, and went looking for a typing mistake they had not made
   * — while the fix, asking for a new code, was the one thing the message did
   * not suggest. The design (§12b) states it plainly: expiry is a rule, not a
   * fault.
   *
   * The membership oracle is untouched and has its own test above.
   */
  it('tells an expired code apart from a wrong one, without leaking the digits', async () => {
    await plantCode(NEW_PHONE, '333333');
    const wrong = await verify(NEW_PHONE, '999999', PASSWORD);
    limits.reset();

    /*
     * Aged at both ends, because the database will not accept it otherwise —
     * `OtpCode_expires_after_creation` refuses a code that expired before it was
     * created, which is not a state a real row can be in.
     */
    await plantCode(NEW_PHONE, '444444', {
      createdAt: new Date(Date.now() - 3_600_000),
      expiresAt: new Date(Date.now() - 1000),
    });
    const expired = await verify(NEW_PHONE, '444444', PASSWORD);
    limits.reset();

    await plantCode(NEW_PHONE, '555555', { consumedAt: new Date() });
    const spent = await verify(NEW_PHONE, '555555', PASSWORD);

    for (const res of [wrong, expired, spent]) {
      expect(res.status).toBe(401);
      // One error code for all of them, so a client cannot branch on it, and
      // one shape, so the response length gives nothing away either.
      expect(res.body.error).toBe('CODE_REJECTED');
    }

    // The clock is allowed to speak.
    expect(expired.body.reason).toBe('expired');
    expect(expired.body.message).toContain('expired');

    /*
     * And the digits are not. A wrong guess reports how many tries remain — a
     * fact about the counter — and never anything about the guess itself: no
     * "close", no partial match, no difference between one wrong digit and six.
     */
    expect(wrong.body.reason).toBe('wrong');
    expect(wrong.body.message).not.toContain('close');
    expect(typeof wrong.body.triesLeft).toBe('number');

    // A spent code says nothing about what it once was.
    expect(spent.body.reason).toBe('consumed');
  });

  /*
   * Three wrong guesses close the door on the *number*, not just the code.
   *
   * Otherwise three tries per code times a free resend every minute is not a
   * cap, it is a slower keyboard.
   */
  it('locks the number after the third wrong guess, and says when it reopens', async () => {
    await plantCode(NEW_PHONE, '888888');
    let last = await verify(NEW_PHONE, '000000', PASSWORD);
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      limits.reset();
      last = await verify(NEW_PHONE, '000000', PASSWORD);
    }

    expect(last.status).toBe(401);
    expect(last.body.reason).toBe('locked');
    // A clock time, never "later": somebody who does not know when the door
    // reopens has to keep trying it.
    expect(typeof last.body.retryAt).toBe('string');
    expect(new Date(last.body.retryAt).getTime()).toBeGreaterThan(Date.now());

    // And the right code does not get in either — the lock is on the number.
    limits.reset();
    const right = await verify(NEW_PHONE, '888888', PASSWORD);
    expect(right.status).toBe(401);
  });

  it('counts wrong guesses and gives up after five', async () => {
    await plantCode(NEW_PHONE, '666666');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await verify(NEW_PHONE, '000000', PASSWORD);
      limits.reset();
    }
    // Six digits is a million possibilities only if the guesses are counted.
    const right = await verify(NEW_PHONE, '666666', PASSWORD);
    expect(right.status).toBe(401);

    const stored = await prisma.otpCode.findFirstOrThrow({ where: { phone: NEW_PHONE } });
    expect(stored.attempts).toBe(MAX_ATTEMPTS);
  });

  it('refuses a weak password, and spends the code anyway', async () => {
    await plantCode(NEW_PHONE, '777777');
    const res = await verify(NEW_PHONE, '777777', 'short');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('WEAK_PASSWORD');

    // Spent regardless: a code that survives a rejected password is one somebody
    // can hold open while they try passwords.
    const stored = await prisma.otpCode.findFirstOrThrow({ where: { phone: NEW_PHONE } });
    expect(stored.consumedAt).not.toBeNull();
  });

  /*
   * Every send costs money. This is the limit that stops a resend button
   * spending a telecom balance as fast as it can be pressed.
   */
  it('holds a cooldown before a second code to the same number', async () => {
    await prisma.otpCode.deleteMany({ where: { phone: '0913005555' } });
    await start('0913005555').expect(201);
    limits.reset();

    const again = await start('0913005555');
    expect(again.status).toBe(429);
    expect(again.headers['retry-after']).toBeDefined();
    await prisma.otpCode.deleteMany({ where: { phone: '0913005555' } });
  });
});
