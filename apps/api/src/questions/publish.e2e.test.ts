/**
 * Integration test — hits the real HTTP endpoint against the real database.
 *
 * The unit tests prove the gate's rules. This proves the rules are actually
 * ENFORCED: that a caller who skips the browser entirely still cannot publish an
 * unexplained question, and that a refused publish leaves the row untouched.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const SUFFIX = 'e2e-publish';

describe('POST /admin/questions/:id/publish', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let blockedId = '';
  let publishableId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const field = await prisma.field.create({
      data: { name: `E2E ${SUFFIX}`, slug: `field-${SUFFIX}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `course-${SUFFIX}` },
    });
    // Weighted, so the topic rule is not what blocks the publishable one.
    const topic = await prisma.topic.create({
      data: {
        courseId: course.id,
        name: 'Weighted topic',
        slug: `topic-${SUFFIX}`,
        weightPct: 100,
      },
    });

    // Crafted invalid: no why-wrongs, no concept line. Exactly what an import
    // produces, and exactly what must never reach a student.
    const blocked = await prisma.question.create({
      data: {
        stableId: `E2E-BLOCKED-${SUFFIX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'Unexplained question',
        explanation: 'has an explanation but no why-wrongs',
        timeLimitSec: 60,
        authorId: 'author-1',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false },
          ],
        },
      },
    });
    blockedId = blocked.id;

    const ok = await prisma.question.create({
      data: {
        stableId: `E2E-OK-${SUFFIX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A fully explained question',
        conceptLine: 'One sentence naming the concept.',
        explanation: 'The full rationale.',
        timeLimitSec: 60,
        authorId: 'author-1',
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
  });

  afterAll(async () => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SUFFIX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SUFFIX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SUFFIX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SUFFIX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SUFFIX } } });
    await app.close();
  });

  it('refuses an unpublishable question with 422 and the blocker list', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/questions/${blockedId}/publish`)
      .send({ reviewerId: 'reviewer-2' })
      .expect(422);

    expect(res.body.error).toBe('GATE_BLOCKED');
    expect(res.body.blockers).toContain('Option B: why it is wrong is missing.');
    expect(res.body.blockers).toContain('Concept line is missing.');
  });

  // The point of the whole task: a refused publish must not half-apply.
  it('leaves the status unchanged after a refusal', async () => {
    const after = await prisma.question.findUniqueOrThrow({ where: { id: blockedId } });
    expect(after.status).toBe('DRAFT');
    expect(after.reviewerId).toBeNull();
  });

  it('publishes a question that passes every rule', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/questions/${publishableId}/publish`)
      .send({ reviewerId: 'reviewer-2' })
      .expect(201);
    expect(res.body.status).toBe('PUBLISHED');
  });

  // Self-review is caught at the moment it is attempted, using the caller's id
  // rather than whatever happens to be stored on the row.
  it('refuses when the reviewer is the author', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/questions/${publishableId}/publish`)
      .send({ reviewerId: 'author-1' })
      .expect(422);
    expect(res.body.blockers).toContain('You wrote this question — someone else has to review it.');
  });

  it('404s for a question that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/admin/questions/does-not-exist/publish')
      .send({ reviewerId: 'reviewer-2' })
      .expect(404);
  });
});
