/**
 * Integration test — the smoke-test door is shut by default (T-206a).
 *
 * `dev-login.test.ts` proves the lock. This proves the **wiring**: that the
 * route as mounted is closed when nothing is configured, and that it cannot be
 * talked into signing in as somebody real. A lock that is correct and a route
 * that never consults it is the failure this exists to catch.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_JWT_SECRET } from './staff-testkit.test-helper';
import { devTelegramId, isDevTelegramId } from './dev-login';

const SECRET = 'smoke-test-secret-at-least-32-chars-long';

describe('the smoke-test door (T-206a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let previous: string | undefined;

  const wipe = async (): Promise<void> => {
    const testers = await prisma.user.findMany({
      where: { telegramId: { startsWith: '-' } },
      select: { id: true },
    });
    const ids = testers.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    previous = process.env.DEV_LOGIN_SECRET;
    delete process.env.DEV_LOGIN_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();
  });

  afterEach(() => {
    delete process.env.DEV_LOGIN_SECRET;
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    if (previous === undefined) delete process.env.DEV_LOGIN_SECRET;
    else process.env.DEV_LOGIN_SECRET = previous;
  });

  /**
   * The assertion this file exists for. Every environment nobody has explicitly
   * opened is closed — including the one somebody deployed in a hurry.
   */
  it('is shut when nothing is configured', async () => {
    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: SECRET, label: 'student' })
      .expect(401);

    await request(app.getHttpServer()).post('/auth/dev-login').send({}).expect(401);
  });

  it('stays shut for a wrong secret once it is configured', async () => {
    process.env.DEV_LOGIN_SECRET = SECRET;
    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: `${SECRET}-wrong`, label: 'student' })
      .expect(401);
  });

  /**
   * The refusal says the same thing either way. Telling "not enabled" apart
   * from "wrong secret" tells somebody probing whether the door exists.
   */
  it('does not say which kind of no it is', async () => {
    const closed = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: SECRET })
      .expect(401);

    process.env.DEV_LOGIN_SECRET = SECRET;
    const wrong = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: 'nope' })
      .expect(401);

    expect(closed.body.message).toBe(wrong.body.message);
  });

  it('signs in a throwaway account when it is open', async () => {
    process.env.DEV_LOGIN_SECRET = SECRET;
    const res = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: SECRET, label: 'student' })
      .expect(201);

    expect(res.body.token).toBeTruthy();
    // The session cookie is set, so a browser can just carry on.
    expect(res.headers['set-cookie']?.[0] ?? '').toContain('HttpOnly');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.userId } });
    // What marks this as a test account is the negative telegram id, not the
    // name: the product generates display names and takes one from nobody
    // (T-086), which is right and not worth an exception here.
    expect(isDevTelegramId(user.telegramId)).toBe(true);
    expect(res.body.displayName).toBe(user.displayName);
  });

  /**
   * **The property that makes the bypass survivable.** Whatever is presented, it
   * mints its own account in a range Telegram cannot issue — so a leaked secret
   * is a nuisance, not a takeover of every account in the product.
   */
  it('cannot be talked into signing in as a real account', async () => {
    process.env.DEV_LOGIN_SECRET = SECRET;
    const real = await prisma.user.create({
      data: { telegramId: '566000090', displayName: 'RealStudent001' },
    });

    try {
      for (const label of ['566000090', 'RealStudent001', real.id]) {
        const res = await request(app.getHttpServer())
          .post('/auth/dev-login')
          .send({ secret: SECRET, label })
          .expect(201);
        expect(res.body.userId, label).not.toBe(real.id);
      }
    } finally {
      await prisma.session.deleteMany({ where: { userId: real.id } });
      await prisma.user.delete({ where: { id: real.id } });
    }
  });

  /** One persona, one account — so a two-day manual test keeps its history. */
  it('returns the same account for the same persona', async () => {
    process.env.DEV_LOGIN_SECRET = SECRET;
    const first = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: SECRET, label: 'student' })
      .expect(201);
    const again = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: SECRET, label: 'student' })
      .expect(201);

    expect(again.body.userId).toBe(first.body.userId);
    expect(String(devTelegramId('student')).startsWith('-')).toBe(true);
  });
});
