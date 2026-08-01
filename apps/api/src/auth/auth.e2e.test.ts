/**
 * Integration test — Telegram sign-in against the real database (T-080).
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
import { verifySessionToken } from './tokens';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';

/** Signs an initData for a given Telegram id, dated now so freshness passes. */
function initDataFor(id: number, extra: Record<string, unknown> = {}): string {
  const user = JSON.stringify({ id, first_name: 'Test', username: `user${id}`, ...extra });
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user,
  };
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const TG_A = 555000001;
const TG_B = 555000002;

describe('POST /auth/telegram (T-080)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const cleanup = async (): Promise<void> => {
    await prisma.session.deleteMany({
      where: { user: { telegramId: { in: [String(TG_A), String(TG_B)] } } },
    });
    await prisma.user.deleteMany({ where: { telegramId: { in: [String(TG_A), String(TG_B)] } } });
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

  const signIn = async (initData: string, expectStatus = 201, deviceLabel?: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/telegram')
        .send({ initData, deviceLabel })
        .expect(expectStatus)
    ).body;

  // The task's own test.
  it('yields one user row for two sign-ins with the same id', async () => {
    const first = await signIn(initDataFor(TG_A));
    const second = await signIn(initDataFor(TG_A));

    expect(first.userId).toBe(second.userId);
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);

    expect(await prisma.user.count({ where: { telegramId: String(TG_A) } })).toBe(1);
  });

  it('gives a different Telegram id a different account', async () => {
    const other = await signIn(initDataFor(TG_B));
    const a = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_A) } });
    expect(other.userId).not.toBe(a.id);
  });

  it('issues a token carrying the user and the session', async () => {
    const body = await signIn(initDataFor(TG_A));
    const result = verifySessionToken(body.token, JWT_SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe(body.userId);
      expect(result.claims.sid).toBe(body.sessionId);
    }
  });

  it('records a session row per sign-in, so devices can be listed and revoked', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_A) } });
    const sessions = await prisma.session.count({ where: { userId: user.id } });
    expect(sessions).toBeGreaterThanOrEqual(2);
  });

  it('stores the device label when one is given', async () => {
    const body = await signIn(initDataFor(TG_A), 201, 'Chrome on Android');
    const session = await prisma.session.findUniqueOrThrow({ where: { id: body.sessionId } });
    expect(session.deviceLabel).toBe('Chrome on Android');
  });

  // PRODUCT.md: a real name never appears on a public surface, and a Telegram
  // profile name usually IS the real name.
  it('never uses the Telegram name as the public display name', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_A) } });
    expect(user.displayName).not.toContain('Test');
    expect(user.displayName).not.toBe(user.name);
    expect(user.displayName).not.toContain('user');
    expect(user.displayName).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{4}$/);
  });

  it('keeps the display name across later sign-ins, including one a student chose', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_A) } });
    await prisma.user.update({ where: { id: user.id }, data: { displayName: 'ChosenHandle' } });

    await signIn(initDataFor(TG_A));

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.displayName).toBe('ChosenHandle');
  });

  it('refreshes the Telegram username, which people do change', async () => {
    await signIn(initDataFor(TG_A, { username: 'renamed' }));
    const after = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_A) } });
    expect(after.telegramUsername).toBe('renamed');
  });

  it('starts a new account with no field chosen', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_B) } });
    expect(user.fieldId).toBeNull();
  });

  // An unverified initData is not a weak credential, it is no credential.
  it('401s on a tampered initData, creating nothing', async () => {
    const forged = initDataFor(TG_A).replace(String(TG_A), '999999999');
    await signIn(forged, 401);
    expect(await prisma.user.count({ where: { telegramId: '999999999' } })).toBe(0);
  });

  it('401s on empty initData', async () => {
    await signIn('', 401);
  });
});
