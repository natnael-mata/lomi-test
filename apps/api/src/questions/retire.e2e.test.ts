/**
 * Integration test — retiring a question (T-070, partial).
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { cleanupStaff, signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';

const SFX = 'e2e-retire';

describe('POST /admin/questions/:id/retire', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: StaffSession;
  const TG_ADMIN = 563000003;

  let questionId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.auditLog.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanupStaff(prisma, [TG_ADMIN], SFX);
    admin = await signInAsStaff(app, prisma, TG_ADMIN, 'ADMIN', SFX);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Retire ${SFX}`, slug: `field-${SFX}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}` },
    });
    const q = await prisma.question.create({
      data: {
        stableId: `RET-${SFX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A question that turns out to be wrong',
        timeLimitSec: 60,
        status: 'PUBLISHED',
      },
    });
    questionId = q.id;
  });

  afterAll(async () => {
    await cleanupStaff(prisma, [TG_ADMIN], SFX);
    await cleanup();
    await app.close();
  });

  const retire = async (body: object, expectStatus = 201) =>
    (
      await request(app.getHttpServer())
        .post(`/admin/questions/${questionId}/retire`)
        .set(admin.auth)
        .send(body)
        .expect(expectStatus)
    ).body;

  it('sets RETIRED and logs it with the reason', async () => {
    const body = await retire({ reason: 'Option B is also correct.' });
    expect(body.status).toBe('RETIRED');
    expect(body.alreadyRetired).toBe(false);

    const rows = await prisma.auditLog.findMany({ where: { questionId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: admin.userId,
      action: 'RETIRED',
      detail: 'Option B is also correct.',
    });
  });

  // A withdrawn question is not deleted: prior attempts reference it, and a
  // student's history pointing at nothing is worse than a question nobody sees.
  it('keeps the row', async () => {
    const after = await prisma.question.findUnique({ where: { id: questionId } });
    expect(after).not.toBeNull();
    expect(after?.stem).toBe('A question that turns out to be wrong');
  });

  it('is idempotent, and does not log a second withdrawal', async () => {
    const body = await retire({});
    expect(body.status).toBe('RETIRED');
    expect(body.alreadyRetired).toBe(true);
    expect(await prisma.auditLog.count({ where: { questionId } })).toBe(1);
  });

  /**
   * This used to assert `null` — "not yet measurable, never zero" — because
   * `Attempt` and `Sitting` did not exist and reporting 0 would have told a
   * reviewer that retiring disturbs nobody, which the code could not know.
   *
   * They exist now, so the number is real and **zero means zero**: nothing has
   * been attempted here and no sitting is in flight. The counting itself is
   * exercised against real attempts and a live sitting in
   * `retire-radius.e2e.test.ts`.
   */
  it('reports a measured blast radius, with zero meaning zero', async () => {
    const body = await retire({});
    expect(body.blastRadius).toEqual({ attempts: 0, liveSittings: 0, measurable: true });
  });

  it('404s for a question that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/admin/questions/does-not-exist/retire')
      .set(admin.auth)
      .send({})
      .expect(404);
  });
});
