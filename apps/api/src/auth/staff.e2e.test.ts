/**
 * Integration test — `/admin/*` is staff-only.
 *
 * This closed a real, demonstrated hole. Before `StaffGuard` existed, an
 * unauthenticated `GET /admin/review/next` returned a full `answerView`:
 * `correctLabel`, the concept line and every why-wrong. `POST
 * /admin/questions/:id/publish` and `/retire` were open too. The question bank
 * is the product's only asset and it was readable and mutable by a stranger.
 *
 * The assertions below are written to fail loudly if any of that comes back —
 * including the route-inventory test at the bottom, which catches an admin route
 * added later without a guard.
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

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
const SFX = 'e2e-staff';

function initDataFor(id: number): string {
  const user = JSON.stringify({ id, first_name: 'Test', username: `user${id}` });
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

describe('/admin is staff-only', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let studentToken = '';
  let reviewerToken = '';
  let adminToken = '';
  let adminUserId = '';
  let questionId = '';

  const TG = { student: 562000001, reviewer: 562000002, admin: 562000003 };

  const cleanup = async (): Promise<void> => {
    await prisma.auditLog.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    await prisma.session.deleteMany({
      where: { user: { telegramId: { startsWith: '5620000' } } },
    });
    await prisma.user.deleteMany({ where: { telegramId: { startsWith: '5620000' } } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  const signIn = async (tg: number): Promise<{ token: string; userId: string }> =>
    (
      await request(app.getHttpServer())
        .post('/auth/telegram')
        .send({ initData: initDataFor(tg) })
        .expect(201)
    ).body;

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Staff ${SFX}`, slug: `field-${SFX}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'C', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'T', slug: `topic-${SFX}`, weightPct: 100 },
    });
    const q = await prisma.question.create({
      data: {
        stableId: `STAFF-${SFX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A question under review',
        conceptLine: 'CONCEPT-SENTINEL',
        explanation: 'EXPLANATION-SENTINEL',
        timeLimitSec: 60,
        status: 'IN_REVIEW',
        authorId: 'author-x',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            { label: 'C', text: 'c', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            { label: 'D', text: 'd', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
          ],
        },
      },
    });
    questionId = q.id;

    const student = await signIn(TG.student);
    const reviewer = await signIn(TG.reviewer);
    const admin = await signIn(TG.admin);
    studentToken = student.token;
    reviewerToken = reviewer.token;
    adminToken = admin.token;
    adminUserId = admin.userId;

    await prisma.staffMember.create({
      data: { userId: reviewer.userId, role: 'REVIEWER', grantedBy: `test-${SFX}` },
    });
    await prisma.staffMember.create({
      data: { userId: admin.userId, role: 'ADMIN', grantedBy: `test-${SFX}` },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const ADMIN_ROUTES: [method: 'get' | 'post' | 'patch', path: string, body?: object][] = [
    ['get', '/admin/review/next'],
    ['patch', '/admin/review/PLACEHOLDER', { conceptLine: 'x' }],
    ['post', '/admin/review/PLACEHOLDER/submit', {}],
    ['post', '/admin/review/PLACEHOLDER/bounce', { note: 'A perfectly valid note here.' }],
    ['post', '/admin/review/PLACEHOLDER/publish', {}],
    ['post', '/admin/questions/PLACEHOLDER/publish', {}],
    ['post', '/admin/questions/PLACEHOLDER/retire', { reason: 'x' }],
  ];

  const call = (
    method: 'get' | 'post' | 'patch',
    path: string,
    token: string | null,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())[method](path.replace('PLACEHOLDER', questionId));
    if (token) req.set('Authorization', `Bearer ${token}`);
    return body ? req.send(body) : req;
  };

  // The hole, exactly as it was.
  it.each(ADMIN_ROUTES)('401s %s %s with no token', async (method, path, body) => {
    await call(method, path, null, body).expect(401);
  });

  it.each(ADMIN_ROUTES)('403s %s %s for a signed-in student', async (method, path, body) => {
    await call(method, path, studentToken, body).expect(403);
  });

  // The specific leak: a stranger reading the answer key.
  it('leaks no answer content to an unauthenticated caller', async () => {
    const res = await call('get', '/admin/review/next', null);
    expect(res.status).toBe(401);
    for (const sentinel of ['CONCEPT-SENTINEL', 'EXPLANATION-SENTINEL', 'WHYWRONG-SENTINEL']) {
      expect(res.text).not.toContain(sentinel);
    }
  });

  it('leaks no answer content to a signed-in student either', async () => {
    const res = await call('get', '/admin/review/next', studentToken);
    expect(res.status).toBe(403);
    for (const sentinel of ['CONCEPT-SENTINEL', 'EXPLANATION-SENTINEL', 'WHYWRONG-SENTINEL']) {
      expect(res.text).not.toContain(sentinel);
    }
  });

  // Asserts the security property — a reviewer CAN read the queue — without
  // depending on which row the queue happens to hand back. It is oldest-first
  // (T-065), so tying this to the fixture makes it fail whenever any other test
  // leaves an older question in review.
  it('lets a reviewer read the queue, answer content and all', async () => {
    const res = await call('get', '/admin/review/next', reviewerToken).expect(200);
    expect(res.body.answerView).toBeTruthy();
    expect(res.body.answerView.options.length).toBeGreaterThan(1);
    expect(res.body.answerView).toHaveProperty('correctLabel');
  });

  it('lets a reviewer act on a specific question', async () => {
    const res = await call('patch', `/admin/review/${questionId}`, reviewerToken, {
      conceptLine: 'Rewritten by the reviewer.',
    }).expect(200);
    expect(res.body.changed).toContain('concept line');
  });

  // A reviewer proposes; an admin decides what a student reads.
  it('refuses a reviewer the publish and retire routes', async () => {
    await call('post', `/admin/review/${questionId}/publish`, reviewerToken, {}).expect(403);
    await call('post', `/admin/questions/${questionId}/retire`, reviewerToken, {
      reason: 'x',
    }).expect(403);
  });

  it('lets an admin retire', async () => {
    const res = await call('post', `/admin/questions/${questionId}/retire`, adminToken, {
      reason: 'test',
    }).expect(201);
    expect(res.body.status).toBe('RETIRED');
  });

  // The second hole in the same code: the actor used to come from the body, so
  // T-044's self-review rule could be satisfied by naming somebody else.
  it('records the caller as the actor, not anything the body claimed', async () => {
    const rows = await prisma.auditLog.findMany({ where: { questionId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorId).toBe(adminUserId);
  });
});

describe('no admin route is reachable without a guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.JWT_SECRET;
  });

  /**
   * Walks the router Nest actually built and calls every `/admin/*` route with no
   * credentials. A grep over decorators would miss a controller added later, and
   * that is precisely how this hole appeared: the routes were written in Phase 2,
   * before any guard existed, and nobody went back.
   */
  it('401s every /admin route with no token', async () => {
    const server = app.getHttpAdapter().getInstance() as {
      router?: { stack?: unknown[] };
      _router?: { stack?: unknown[] };
    };
    const stack = (server.router?.stack ?? server._router?.stack ?? []) as {
      route?: { path: string; methods: Record<string, boolean> };
    }[];

    const adminRoutes = stack
      .filter((l) => l.route?.path.startsWith('/admin'))
      .flatMap((l) =>
        Object.keys(l.route!.methods).map((m) => ({
          method: m.toLowerCase(),
          path: l.route!.path,
        })),
      );

    // Guards the reflection: zero routes would make this pass vacuously.
    expect(adminRoutes.length).toBeGreaterThan(4);

    const open: string[] = [];
    for (const route of adminRoutes) {
      const path = route.path.replace(/:[^/]+/g, 'some-id');
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>
      )[route.method]!(path).send({});
      if (res.status !== 401)
        open.push(`${route.method.toUpperCase()} ${route.path} → ${res.status}`);
    }
    expect(open, `unguarded admin routes: ${open.join(', ')}`).toEqual([]);
  });
});
