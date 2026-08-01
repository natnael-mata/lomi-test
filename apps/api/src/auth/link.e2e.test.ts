/**
 * Integration test — linking a Telegram identity to an existing account (T-081).
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import { createHmac } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { signSessionToken } from './tokens';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';

function initDataFor(id: number, username = `user${id}`): string {
  const user = JSON.stringify({ id, first_name: 'Test', username });
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user,
  };
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const PHONE = '+251900000001';
const TG_LINK = 556000001;
const TG_TAKEN = 556000002;
const TG_OTHER = 556000003;

describe('POST /auth/link/telegram (T-081)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let phoneUserId = '';
  let token = '';

  const cleanup = async (): Promise<void> => {
    await prisma.session.deleteMany({ where: { user: { phone: { startsWith: '+2519000000' } } } });
    await prisma.user.deleteMany({ where: { phone: { startsWith: '+2519000000' } } });
    await prisma.user.deleteMany({
      where: { telegramId: { in: [TG_LINK, TG_TAKEN, TG_OTHER].map(String) } },
    });
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    // A phone-only account, as the OTP flow will eventually produce.
    const user = await prisma.user.create({
      data: { phone: PHONE, phoneVerifiedAt: new Date(), displayName: 'QuietMeadow1234' },
    });
    phoneUserId = user.id;
    const session = await prisma.session.create({ data: { userId: user.id } });
    token = signSessionToken({ sub: user.id, sid: session.id }, JWT_SECRET);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const link = async (initData: string, bearer = token, expectStatus = 201) =>
    (
      await request(app.getHttpServer())
        .post('/auth/link/telegram')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ initData })
        .expect(expectStatus)
    ).body;

  // The task's own test.
  it('leaves one row carrying both phone and telegramId', async () => {
    const body = await link(initDataFor(TG_LINK));
    expect(body.alreadyLinked).toBe(false);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: phoneUserId } });
    expect(user.phone).toBe(PHONE);
    expect(user.telegramId).toBe(String(TG_LINK));
    expect(user.telegramUsername).toBe(`user${TG_LINK}`);

    expect(await prisma.user.count({ where: { telegramId: String(TG_LINK) } })).toBe(1);
  });

  it('is idempotent when the same identity is linked again', async () => {
    const body = await link(initDataFor(TG_LINK));
    expect(body.alreadyLinked).toBe(true);
    expect(await prisma.user.count({ where: { telegramId: String(TG_LINK) } })).toBe(1);
  });

  it('refuses to swap in a different Telegram identity', async () => {
    await link(initDataFor(TG_OTHER), token, 409);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: phoneUserId } });
    expect(user.telegramId).toBe(String(TG_LINK));
  });

  // Two populated accounts are never merged: the other one may hold attempts and
  // a subscription, and folding them wrongly is unrecoverable.
  it('refuses when the Telegram account is already a separate account', async () => {
    const other = await prisma.user.create({
      data: { phone: '+251900000009', displayName: 'SteadyEmber5678' },
    });
    const otherSession = await prisma.session.create({ data: { userId: other.id } });
    const otherToken = signSessionToken({ sub: other.id, sid: otherSession.id }, JWT_SECRET);

    // Give TG_TAKEN its own standalone account first.
    await prisma.user.create({
      data: { telegramId: String(TG_TAKEN), displayName: 'BrightComet4321' },
    });

    const body = await link(initDataFor(TG_TAKEN), otherToken, 409);
    expect(body.message).toContain('support');

    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(untouched.telegramId).toBeNull();
  });

  // Neither identity is taken on the caller's word.
  it('401s without a token', async () => {
    await request(app.getHttpServer())
      .post('/auth/link/telegram')
      .send({ initData: initDataFor(TG_OTHER) })
      .expect(401);
  });

  it('401s on a tampered initData, changing nothing', async () => {
    const forged = initDataFor(TG_LINK).replace(String(TG_LINK), '999000111');
    await link(forged, token, 401);
    expect(await prisma.user.count({ where: { telegramId: '999000111' } })).toBe(0);
  });

  it('401s on a token signed with the wrong secret', async () => {
    const bad = signSessionToken({ sub: phoneUserId, sid: 'whatever' }, 'not-the-secret');
    await link(initDataFor(TG_OTHER), bad, 401);
  });

  // The guard's whole reason for existing: revocation has to mean something.
  it('401s once the session row is revoked, however valid the token', async () => {
    const user = await prisma.user.create({
      data: { phone: '+251900000008', displayName: 'KeenLantern9999' },
    });
    const session = await prisma.session.create({ data: { userId: user.id } });
    const live = signSessionToken({ sub: user.id, sid: session.id }, JWT_SECRET);

    await link(initDataFor(TG_OTHER), live, 201);

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'test' },
    });

    await request(app.getHttpServer())
      .post('/auth/link/telegram')
      .set('Authorization', `Bearer ${live}`)
      .send({ initData: initDataFor(TG_OTHER) })
      .expect(401);
  });

  it('records last-seen on a guarded request', async () => {
    const before = await prisma.session.findFirstOrThrow({
      where: { userId: phoneUserId },
      orderBy: { createdAt: 'desc' },
    });
    await link(initDataFor(TG_LINK));
    const after = await prisma.session.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.lastSeenAt.getTime());
  });
});
