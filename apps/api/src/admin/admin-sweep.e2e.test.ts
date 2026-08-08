/**
 * Integration sweep over every `/admin` route (T-167, T-168).
 *
 * Both of these are claims about a **set**, not about a route, so both are
 * tested by walking the router rather than by listing endpoints by hand. A list
 * covers the routes somebody remembered; the router covers the one added next
 * month, which is the one that will be missing its guard.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { PrismaService } from '../prisma/prisma.service';

const SFX = 'e2e-adminsweep';
const TG_ADMIN = 566000010;
const TG_STUDENT = 566000011;

interface Route {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
}

/** Every `/admin` route the app actually serves. */
function adminRoutes(app: INestApplication): Route[] {
  const server = app.getHttpAdapter().getInstance() as {
    router?: { stack?: unknown[] };
    _router?: { stack?: unknown[] };
  };
  const stack = (server.router?.stack ?? server._router?.stack ?? []) as {
    route?: { path: string; methods: Record<string, boolean> };
  }[];
  return stack
    .filter((l) => l.route?.path.startsWith('/admin'))
    .flatMap((l) =>
      Object.keys(l.route!.methods).map((m) => ({
        method: m.toLowerCase() as Route['method'],
        path: l.route!.path,
      })),
    );
}

describe('every /admin route (T-167, T-168)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: StaffSession;
  let student: StaffSession;
  let routes: Route[] = [];
  let fieldId = '';
  let topicId = '';
  let questionId = '';
  let targetUserId = '';

  const wipe = async (): Promise<void> => {
    const fields = await prisma.field.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });
    const ids = fields.map((f) => f.id);
    const exams = await prisma.exam.findMany({
      where: { fieldId: { in: ids } },
      select: { id: true },
    });
    const topics = await prisma.topic.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });
    await prisma.examQuestion.deleteMany({ where: { examId: { in: exams.map((e) => e.id) } } });
    await prisma.exam.deleteMany({ where: { id: { in: exams.map((e) => e.id) } } });
    await prisma.topicWeightOverride.deleteMany({
      where: { topicId: { in: topics.map((t) => t.id) } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { contains: '' }, entity: 'field' } });
    await prisma.option.deleteMany({ where: { question: { fieldId: { in: ids } } } });
    await prisma.question.deleteMany({ where: { fieldId: { in: ids } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { id: { in: ids } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    for (const tg of [TG_ADMIN, TG_STUDENT]) {
      await prisma.session.deleteMany({ where: { user: { telegramId: String(tg) } } });
      await prisma.user.deleteMany({ where: { telegramId: String(tg) } });
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const field = await prisma.field.create({
      data: { name: `Sweep ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}`, weightPct: 100 },
    });
    topicId = topic.id;
    const question = await prisma.question.create({
      data: {
        stableId: `SWEEP-${SFX}`,
        topicId,
        fieldId,
        qType: 'CONCEPT',
        stem: 'Sweep question',
        conceptLine: 'concept',
        explanation: 'explanation',
        timeLimitSec: 60,
        status: 'PUBLISHED',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'no' },
            { label: 'C', text: 'c', isCorrect: false, whyWrong: 'no' },
            { label: 'D', text: 'd', isCorrect: false, whyWrong: 'no' },
          ],
        },
      },
    });
    questionId = question.id;

    admin = await signInAsStaff(app, prisma, TG_ADMIN, 'ADMIN', SFX);
    // A signed-in account with no staff row at all: the ordinary student.
    student = await signInAsStaff(app, prisma, TG_STUDENT, 'ADMIN', SFX);
    await prisma.staffMember.deleteMany({ where: { userId: student.userId } });
    targetUserId = student.userId;

    routes = adminRoutes(app);
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  it('found the admin routes to sweep', () => {
    // Guards the walker: a sweep over zero routes passes forever.
    expect(routes.length).toBeGreaterThanOrEqual(8);
  });

  /**
   * T-168's stated test, at its stated scope: a non-admin token on **every**
   * `/admin/*` route.
   *
   * 403 and not 404: the caller is authenticated and the route exists, they are
   * simply not allowed. A 404 here would be lying to an operator debugging
   * their own permissions.
   */
  it('refuses a signed-in non-admin on every route', async () => {
    for (const route of routes) {
      const path = route.path.replace(/:[^/]+/g, 'x');
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>
      )[route.method]!(path)
        .set(student.auth)
        .send({});
      expect(res.status, `${route.method.toUpperCase()} ${route.path} let a student in`).toBe(403);
    }
  });

  it('refuses an unauthenticated caller on every route', async () => {
    for (const route of routes) {
      const path = route.path.replace(/:[^/]+/g, 'x');
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>
      )[route.method]!(path).send({});
      expect(res.status, `${route.method.toUpperCase()} ${route.path} is unguarded`).toBe(401);
    }
  });

  /**
   * T-167's stated test: each admin mutation produces exactly one audit row.
   *
   * "Exactly one" is the half that matters. Zero is an action nobody can answer
   * for; two makes one action look like two in a record somebody may later have
   * to read out.
   */
  describe('every mutation is audited exactly once (T-167)', () => {
    const auditCount = async (): Promise<number> => prisma.auditLog.count();

    const mutates = async (label: string, call: () => Promise<request.Response>): Promise<void> => {
      const before = await auditCount();
      const res = await call();
      expect(res.status, `${label} failed: ${JSON.stringify(res.body)}`).toBeLessThan(400);
      const after = await auditCount();
      expect(after - before, `${label} wrote ${after - before} audit rows, not 1`).toBe(1);
    };

    it('audits deriving weights', async () => {
      await mutates('derive weights', () =>
        request(app.getHttpServer())
          .post(`/admin/fields/${fieldId}/weights/derive`)
          .set(admin.auth)
          .send({}),
      );
    });

    it('audits a weight override', async () => {
      await mutates('override weight', () =>
        request(app.getHttpServer())
          .post(`/admin/fields/${fieldId}/weights/topics/${topicId}`)
          .set(admin.auth)
          .send({ weightPct: 100, reason: 'Sweep test.' }),
      );
    });

    it('audits clearing an override', async () => {
      await mutates('clear override', () =>
        request(app.getHttpServer())
          .delete(`/admin/fields/${fieldId}/weights/topics/${topicId}`)
          .set(admin.auth),
      );
    });

    it('audits building a paper', async () => {
      await mutates('build exam', () =>
        request(app.getHttpServer())
          .post('/admin/exams')
          .set(admin.auth)
          .send({
            fieldId,
            blueprint: { conceptCount: 1, calculationCount: 0, durationSec: 600 },
          }),
      );
    });

    it('audits a device reset', async () => {
      await mutates('reset devices', () =>
        request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/reset-devices`)
          .set(admin.auth)
          .send({ reason: 'Lost phone.' }),
      );
    });

    it('audits a deactivation and a reactivation separately', async () => {
      await mutates('deactivate', () =>
        request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/deactivate`)
          .set(admin.auth)
          .send({ active: false, reason: 'Sweep test.' }),
      );
      await mutates('reactivate', () =>
        request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/deactivate`)
          .set(admin.auth)
          .send({ active: true }),
      );
    });

    it('audits retiring a question', async () => {
      await mutates('retire', () =>
        request(app.getHttpServer())
          .post(`/admin/questions/${questionId}/retire`)
          .set(admin.auth)
          .send({ reason: 'Sweep test.' }),
      );
    });

    /**
     * Every row says who and what. An audit entry missing either is a record
     * nobody can act on, and the database refuses it — but the service is what
     * has to supply it.
     */
    it('names an actor and a subject on every row it wrote', async () => {
      const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.actorId, `${row.action} has no actor`).not.toBe('');
        expect(row.entity, `${row.action} has no entity`).not.toBe('');
        expect(row.entityId, `${row.action} has no entity id`).not.toBe('');
      }
    });
  });
});
