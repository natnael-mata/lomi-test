/**
 * Integration test — `GET /admin/review/next` against the real database.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const SFX = 'e2e-review';

describe('GET /admin/review/next (T-065)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let topicId = '';
  let fieldId = '';

  const make = async (
    stableId: string,
    over: { authorId?: string | null; status?: 'IN_REVIEW' | 'DRAFT' | 'PUBLISHED' } = {},
  ): Promise<string> => {
    const q = await prisma.question.create({
      data: {
        stableId: `${stableId}-${SFX}`,
        topicId,
        fieldId,
        qType: 'CONCEPT',
        stem: `Stem for ${stableId}`,
        timeLimitSec: 60,
        status: over.status ?? 'IN_REVIEW',
        authorId: over.authorId === undefined ? 'author-a' : over.authorId,
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'because b' },
          ],
        },
      },
    });
    return q.id;
  };

  /** Nudges updatedAt so "oldest first" is testable without waiting. */
  const age = async (stableId: string, minutesAgo: number): Promise<void> => {
    const when = new Date(Date.parse('2026-01-01T00:00:00Z') + (1000 - minutesAgo) * 60_000);
    await prisma.$executeRaw`UPDATE "Question" SET "updatedAt" = ${when} WHERE "stableId" = ${`${stableId}-${SFX}`}`;
  };

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
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
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Review ${SFX}`, slug: `field-${SFX}` },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}` },
    });
    topicId = topic.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const next = async (reviewerId: string) =>
    (await request(app.getHttpServer()).get('/admin/review/next').query({ reviewerId }).expect(200))
      .body;

  it('returns null when the queue is empty', async () => {
    expect(await next('reviewer-b')).toEqual({});
  });

  // The task's own test.
  it('does not hand author A their own question', async () => {
    await make('OWN', { authorId: 'author-a' });
    expect(await next('author-a')).toEqual({});
    // And it is genuinely in the queue — just not for its author.
    expect((await next('reviewer-b')).stableId).toBe(`OWN-${SFX}`);
  });

  it('returns the oldest waiting question first', async () => {
    await make('NEWER', { authorId: 'author-c' });
    await age('OWN', 10);
    await age('NEWER', 1);
    expect((await next('reviewer-b')).stableId).toBe(`OWN-${SFX}`);
  });

  it('offers a question with no author to everyone', async () => {
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await make('ORPHAN', { authorId: null });
    // NOT { authorId: 'x' } in SQL drops NULL rows unless handled; an
    // unattributed question is nobody's own work.
    expect((await next('anyone')).stableId).toBe(`ORPHAN-${SFX}`);
  });

  it('ignores questions that are not IN_REVIEW', async () => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await make('DRAFTED', { status: 'DRAFT' });
    await make('LIVE', { status: 'PUBLISHED' });
    expect(await next('reviewer-b')).toEqual({});
  });
});
