/**
 * Integration test — the database refuses a question whose `fieldId` disagrees
 * with its topic's real field (T-029a).
 *
 * These assertions can only be made against a real Postgres: the rule is a
 * trigger, so a mocked Prisma would happily accept every one of them.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const SFX = 'e2e-drift';

describe('Question.fieldId must match its topic (T-029a)', () => {
  let prisma: PrismaService;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  /** Two complete field → course → topic chains, so a question can be misfiled. */
  let fieldA = '';
  let fieldB = '';
  let topicA = '';
  let topicB = '';

  const cleanup = async (): Promise<void> => {
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  const chain = async (letter: string): Promise<{ fieldId: string; topicId: string }> => {
    const field = await prisma.field.create({
      data: { name: `Drift ${letter} ${SFX}`, slug: `field-${letter}-${SFX}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `course-${letter}-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${letter}-${SFX}` },
    });
    return { fieldId: field.id, topicId: topic.id };
  };

  const question = (stableId: string, topicId: string, fieldId: string) =>
    prisma.question.create({
      data: {
        stableId: `${stableId}-${SFX}`,
        topicId,
        fieldId,
        qType: 'CONCEPT',
        stem: 'A question',
        timeLimitSec: 60,
      },
    });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    await cleanup();

    const a = await chain('a');
    const b = await chain('b');
    fieldA = a.fieldId;
    topicA = a.topicId;
    fieldB = b.fieldId;
    topicB = b.topicId;
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('accepts a question whose field matches its topic', async () => {
    const q = await question('MATCHES', topicA, fieldA);
    expect(q.fieldId).toBe(fieldA);
  });

  // The whole point: this row would look entirely normal and serve a student
  // another programme's question.
  it('refuses an insert whose fieldId belongs to a different programme', async () => {
    await expect(question('MISFILED', topicA, fieldB)).rejects.toThrow(
      /does not match its topic's field/,
    );
    await expect(
      prisma.question.findUnique({ where: { stableId: `MISFILED-${SFX}` } }),
    ).resolves.toBeNull();
  });

  it('refuses moving a question to a topic in another field without updating fieldId', async () => {
    await expect(
      prisma.question.update({
        where: { stableId: `MATCHES-${SFX}` },
        data: { topicId: topicB },
      }),
    ).rejects.toThrow(/does not match its topic's field/);
  });

  it('refuses changing fieldId on its own', async () => {
    await expect(
      prisma.question.update({
        where: { stableId: `MATCHES-${SFX}` },
        data: { fieldId: fieldB },
      }),
    ).rejects.toThrow(/does not match its topic's field/);
  });

  it('allows a move when both are updated together', async () => {
    const moved = await prisma.question.update({
      where: { stableId: `MATCHES-${SFX}` },
      data: { topicId: topicB, fieldId: fieldB },
    });
    expect(moved.topicId).toBe(topicB);
    expect(moved.fieldId).toBe(fieldB);
  });

  it('leaves unrelated updates alone', async () => {
    const edited = await prisma.question.update({
      where: { stableId: `MATCHES-${SFX}` },
      data: { stem: 'An edited question' },
    });
    expect(edited.stem).toBe('An edited question');
  });

  // Everything the app already writes has to keep working — the trigger is a
  // guard against future mistakes, not a change of contract.
  it('does not obstruct the importer', async () => {
    const seeded = await prisma.question.findMany({
      where: { stableId: { in: ['AF-0001', 'CS-0001', 'GEO-0001'] } },
      include: { topic: { include: { course: true } } },
    });
    expect(seeded).toHaveLength(3);
    for (const q of seeded) expect(q.fieldId).toBe(q.topic.course.fieldId);
  });
});
