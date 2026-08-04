/**
 * Integration test — the audit log against the real database.
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

const SFX = 'e2e-audit';

describe('the audit log (T-069)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: StaffSession;
  const TG_ADMIN = 563000002;

  let publishableId = '';
  let blockedId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.auditLog.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
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
      data: { name: `Audit ${SFX}`, slug: `field-${SFX}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}`, weightPct: 100 },
    });

    const ok = await prisma.question.create({
      data: {
        stableId: `AUD-OK-${SFX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A fully explained question',
        conceptLine: 'One sentence naming the concept.',
        explanation: 'The full rationale.',
        timeLimitSec: 60,
        status: 'IN_REVIEW',
        authorId: 'author-a',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'because' },
            { label: 'C', text: 'c', isCorrect: false, whyWrong: 'because' },
            { label: 'D', text: 'd', isCorrect: false, whyWrong: 'because' },
          ],
        },
      },
    });
    publishableId = ok.id;

    const blocked = await prisma.question.create({
      data: {
        stableId: `AUD-BLOCKED-${SFX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'An unexplained question',
        timeLimitSec: 60,
        status: 'IN_REVIEW',
        authorId: 'author-a',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false },
          ],
        },
      },
    });
    blockedId = blocked.id;
  });

  afterAll(async () => {
    await cleanupStaff(prisma, [TG_ADMIN], SFX);
    await cleanup();
    await app.close();
  });

  const rowsFor = async (questionId: string) =>
    prisma.auditLog.findMany({ where: { questionId }, orderBy: { createdAt: 'asc' } });

  // The task's own test.
  it('writes exactly one row on publish, with the reviewer as actor', async () => {
    await request(app.getHttpServer())
      .post(`/admin/questions/${publishableId}/publish`)
      .set(admin.auth)
      .send({})
      .expect(201);

    const rows = await rowsFor(publishableId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: admin.userId,
      action: 'PUBLISHED',
      questionId: publishableId,
      stableId: `AUD-OK-${SFX}`,
    });
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
  });

  // The half that matters: a refused publish must leave no trace of having
  // happened, or the log stops being evidence of anything.
  it('writes nothing when the gate refuses', async () => {
    await request(app.getHttpServer())
      .post(`/admin/questions/${blockedId}/publish`)
      .set(admin.auth)
      .send({})
      .expect(422);

    expect(await rowsFor(blockedId)).toHaveLength(0);
  });

  it('records a bounce with its note, which the column will later overwrite', async () => {
    const note = 'Option B needs a why-wrong before this can go live.';
    await request(app.getHttpServer())
      .post(`/admin/review/${blockedId}/bounce`)
      .set(admin.auth)
      .send({ note })
      .expect(201);

    const rows = await rowsFor(blockedId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: admin.userId,
      action: 'BOUNCED',
      detail: note,
    });

    // A second bounce overwrites the column but appends to the log.
    const second = 'Still missing the why-wrong.';
    await request(app.getHttpServer())
      .post(`/admin/review/${blockedId}/bounce`)
      .set(admin.auth)
      .send({ note: second })
      .expect(201);

    const after = await rowsFor(blockedId);
    expect(after.map((r) => r.detail)).toEqual([note, second]);
    const question = await prisma.question.findUniqueOrThrow({ where: { id: blockedId } });
    expect(question.bounceNote).toBe(second);
  });

  it('writes nothing when a bounce is refused for a short note', async () => {
    const before = await rowsFor(blockedId);
    await request(app.getHttpServer())
      .post(`/admin/review/${blockedId}/bounce`)
      .set(admin.auth)
      .send({ note: 'no' })
      .expect(400);
    expect(await rowsFor(blockedId)).toHaveLength(before.length);
  });

  it('keeps the history in the order it happened', async () => {
    const rows = await rowsFor(blockedId);
    expect(rows.map((r) => r.action)).toEqual(['BOUNCED', 'BOUNCED']);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(rows[i - 1]!.createdAt.getTime());
    }
  });

  // The log has to outlive what it describes, which is why there is no FK.
  it('survives the question it describes being deleted', async () => {
    const doomed = await prisma.question.create({
      data: {
        stableId: `AUD-GONE-${SFX}`,
        topicId: (await prisma.topic.findFirstOrThrow({ where: { slug: `topic-${SFX}` } })).id,
        fieldId: (await prisma.field.findFirstOrThrow({ where: { slug: `field-${SFX}` } })).id,
        qType: 'CONCEPT',
        stem: 'A question about to be deleted',
        timeLimitSec: 60,
        status: 'IN_REVIEW',
      },
    });
    await request(app.getHttpServer())
      .post(`/admin/review/${doomed.id}/bounce`)
      .set(admin.auth)
      .send({ note: 'This one is going away entirely.' })
      .expect(201);

    await prisma.question.delete({ where: { id: doomed.id } });

    const rows = await rowsFor(doomed.id);
    expect(rows).toHaveLength(1);
    // And it is still readable: the stableId was copied in, not joined to.
    expect(rows[0]!.stableId).toBe(`AUD-GONE-${SFX}`);
  });
});
