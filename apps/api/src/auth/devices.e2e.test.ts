/**
 * Integration test — the two-device limit (T-082).
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
import { MAX_CONCURRENT_SESSIONS } from './auth.service';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
const TG = 557000001;

function initData(): string {
  const user = JSON.stringify({ id: TG, first_name: 'Test', username: `user${TG}` });
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

describe('the device limit', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const cleanup = async (): Promise<void> => {
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const login = async (deviceLabel: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/telegram')
        .send({ initData: initData(), deviceLabel })
        .expect(201)
    ).body;

  const liveSessions = async (userId: string) =>
    prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });

  // The task's own test.
  it('leaves exactly two live sessions after three logins, evicting the first', async () => {
    const first = await login('Phone');
    const second = await login('Laptop');
    const third = await login('Tablet');

    const live = await liveSessions(first.userId);
    expect(live).toHaveLength(MAX_CONCURRENT_SESSIONS);
    expect(live.map((s) => s.id)).toEqual([second.sessionId, third.sessionId]);

    const evicted = await prisma.session.findUniqueOrThrow({ where: { id: first.sessionId } });
    expect(evicted.revokedAt).not.toBeNull();
  });

  // Kept rather than deleted, so "signed out on 3 August, because a third
  // device signed in" is still answerable.
  it('says why the evicted session ended', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG) } });
    const revoked = await prisma.session.findFirstOrThrow({
      where: { userId: user.id, revokedAt: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    expect(revoked.revokedReason).toContain('another device signed in');
  });

  // The evicted device has to actually stop working — that is the whole point.
  it("refuses the evicted device's token on the next request", async () => {
    await cleanup();
    const first = await login('Phone');
    await login('Laptop');
    await login('Tablet');

    await request(app.getHttpServer())
      .post('/auth/link/telegram')
      .set('Authorization', `Bearer ${first.token}`)
      .send({ initData: initData() })
      .expect(401);
  });

  it('keeps a surviving device working', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG) } });
    const live = await liveSessions(user.id);
    expect(live).toHaveLength(2);
  });

  // The third login is never refused: refusing it strands a student who has lost
  // the phone they signed in on.
  it('never refuses a login, however many devices came before', async () => {
    for (let i = 0; i < 5; i++) await login(`Device ${i}`);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG) } });
    expect(await liveSessions(user.id)).toHaveLength(MAX_CONCURRENT_SESSIONS);
  });

  it('does not evict another user’s sessions', async () => {
    const other = await prisma.user.create({
      data: { telegramId: '557999999', displayName: 'CalmDelta1111' },
    });
    await prisma.session.create({ data: { userId: other.id } });

    await login('Yet another device');

    const theirs = await liveSessions(other.id);
    expect(theirs).toHaveLength(1);

    await prisma.session.deleteMany({ where: { userId: other.id } });
    await prisma.user.delete({ where: { id: other.id } });
  });

  it('does not resurrect a session that was already revoked', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG) } });
    const revokedCount = await prisma.session.count({
      where: { userId: user.id, revokedAt: { not: null } },
    });
    await login('One more');
    const after = await prisma.session.count({
      where: { userId: user.id, revokedAt: { not: null } },
    });
    expect(after).toBe(revokedCount + 1);
  });
});
