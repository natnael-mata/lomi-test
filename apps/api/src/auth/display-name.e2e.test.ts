/**
 * Integration test: a student changing their display name (PATCH /me).
 *
 * The rules themselves are proved in `display-name.test.ts`. What only the
 * server can show is that a refusal changes nothing, an accepted name is what
 * `/me` reads back, the student's own legal name is checked, and only the
 * caller's own row is ever touched.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInByPhone } from './staff-testkit.test-helper';
import { PrismaService } from '../prisma/prisma.service';

const JWT_SECRET = 'test-secret-not-a-real-one';
const TG = 559000101;
const TG_OTHER = 559000102;

describe('PATCH /me, the display name', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let userId = '';

  const cleanup = async (): Promise<void> => {
    const ids = [String(TG), String(TG_OTHER)];
    await prisma.session.deleteMany({ where: { user: { telegramId: { in: ids } } } });
    await prisma.user.deleteMany({ where: { telegramId: { in: ids } } });
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    const body = await signInByPhone(app, prisma, TG);
    token = body.token;
    userId = body.userId;
    await prisma.user.update({ where: { id: userId }, data: { name: 'Abebe Kebede' } });
    await signInByPhone(app, prisma, TG_OTHER);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.JWT_SECRET;
  });

  const patch = (displayName: unknown) =>
    request(app.getHttpServer())
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName });

  it('saves a good name, tidied, and /me reads it back', async () => {
    const res = await patch('  Steady   Learner ').expect(200);
    expect(res.body.displayName).toBe('Steady Learner');
    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.displayName).toBe('Steady Learner');
  });

  it('refuses with every reason and changes nothing', async () => {
    const res = await patch('<0911234567>').expect(422);
    expect(res.body.error).toBe('DISPLAY_NAME_REFUSED');
    expect(res.body.reasons.length).toBeGreaterThan(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.displayName).toBe('Steady Learner');
  });

  it('refuses the student’s own legal name', async () => {
    const res = await patch('Kebede Abebe').expect(422);
    expect(res.body.message).toMatch(/not your real name/);
  });

  it('touches only the caller', async () => {
    await patch('Quiet Comet').expect(200);
    const other = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG_OTHER) } });
    expect(other.displayName).toBe(`Fixture ${TG_OTHER}`);
  });

  it('turns away a caller with no session', async () => {
    await request(app.getHttpServer()).patch('/me').send({ displayName: 'Anyone' }).expect(401);
  });
});
