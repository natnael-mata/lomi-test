/**
 * Integration test — deriving and overriding topic weights (T-134, T-134a).
 *
 * The arithmetic is proved in `weights.test.ts` without a database. What is
 * checked here is the part only a database can show: that the derived numbers
 * actually land on `Topic.weightPct`, that an override survives a re-derivation,
 * and that a published question moving the bank moves the weights with it.
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

const SFX = 'e2e-weights';
const TG = 566000004;

describe('topic weights (T-134, T-134a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let staff: StaffSession;
  let fieldId = '';
  const topicIds: Record<string, string> = {};

  /** Publishes `count` more questions into a topic, moving the bank. */
  const addPublished = async (topic: string, count: number, from = 0): Promise<void> => {
    for (let i = 0; i < count; i++) {
      await prisma.question.create({
        data: {
          stableId: `W-${topic}-${from + i}-${SFX}`,
          topicId: topicIds[topic]!,
          fieldId,
          qType: 'CONCEPT',
          stem: `Q${from + i}`,
          timeLimitSec: 60,
          status: 'PUBLISHED',
        },
      });
    }
  };

  const derive = async () =>
    (
      await request(app.getHttpServer())
        .post(`/admin/fields/${fieldId}/weights/derive`)
        .set(staff.auth)
        .expect(201)
    ).body;

  const wipe = async (): Promise<void> => {
    const fields = await prisma.field.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });
    const ids = fields.map((f) => f.id);
    const topics = await prisma.topic.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });
    await prisma.topicWeightOverride.deleteMany({
      where: { topicId: { in: topics.map((t) => t.id) } },
    });
    await prisma.option.deleteMany({ where: { question: { fieldId: { in: ids } } } });
    await prisma.question.deleteMany({ where: { fieldId: { in: ids } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { id: { in: ids } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const field = await prisma.field.create({
      data: { name: `Weights ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });
    for (const name of ['Algorithms', 'Databases', 'Networks']) {
      const topic = await prisma.topic.create({
        data: { courseId: course.id, name, slug: `topic-${name.toLowerCase()}-${SFX}` },
      });
      topicIds[name] = topic.id;
    }

    staff = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  it('refuses to derive from a bank with nothing published', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/fields/${fieldId}/weights/derive`)
      .set(staff.auth)
      .expect(422);
    expect(res.body.error).toBe('NO_PUBLISHED_QUESTIONS');
  });

  it('is admin-only', async () => {
    await request(app.getHttpServer()).post(`/admin/fields/${fieldId}/weights/derive`).expect(401);
  });

  /** T-134's stated test, through the database: equal thirds land as 34/33/33. */
  it('writes derived weights that sum to exactly 100', async () => {
    for (const name of ['Algorithms', 'Databases', 'Networks']) await addPublished(name, 1);

    const body = await derive();
    expect(body.map((r: { topicName: string }) => r.topicName)).toEqual([
      'Algorithms',
      'Databases',
      'Networks',
    ]);
    expect(body.map((r: { weightPct: number }) => r.weightPct)).toEqual([34, 33, 33]);
    expect(body.every((r: { weightSource: string }) => r.weightSource === 'derived')).toBe(true);

    // On the topic rows themselves, which is what everything else reads.
    const stored = await prisma.topic.findMany({
      where: { id: { in: Object.values(topicIds) } },
      orderBy: { name: 'asc' },
      select: { weightPct: true },
    });
    expect(stored.map((t) => t.weightPct?.toNumber())).toEqual([34, 33, 33]);
  });

  it('is idempotent on an unchanged bank', async () => {
    const first = await derive();
    const second = await derive();
    expect(second).toEqual(first);
  });

  // The weights are a view of the bank, so publishing more must move them.
  it('follows the bank when more questions are published', async () => {
    await addPublished('Algorithms', 7, 100);
    const body = await derive();
    const byName = new Map(
      body.map((r: { topicName: string; weightPct: number }) => [r.topicName, r.weightPct]),
    );
    expect(byName.get('Algorithms')).toBe(80);
    expect(byName.get('Databases')).toBe(10);
    expect(byName.get('Networks')).toBe(10);
  });

  // Only PUBLISHED counts. A draft is not evidence about a past paper.
  it('ignores drafts', async () => {
    await prisma.question.create({
      data: {
        stableId: `W-draft-${SFX}`,
        topicId: topicIds.Networks!,
        fieldId,
        qType: 'CONCEPT',
        stem: 'draft',
        timeLimitSec: 60,
        status: 'DRAFT',
      },
    });
    const body = await derive();
    const networks = body.find((r: { topicName: string }) => r.topicName === 'Networks');
    expect(networks.publishedCount).toBe(1);
    expect(networks.weightPct).toBe(10);
  });

  describe('a reviewer overriding a weight (T-134a)', () => {
    /** T-134a's stated test. */
    it('pins one topic and leaves the rest summing to 60', async () => {
      const body = (
        await request(app.getHttpServer())
          .post(`/admin/fields/${fieldId}/weights/topics/${topicIds.Databases}`)
          .set(staff.auth)
          .send({ weightPct: 40, reason: 'Databases is under-imported; past papers say 40%.' })
          .expect(201)
      ).body;

      const byName = new Map(
        body.map((r: { topicName: string; weightPct: number }) => [r.topicName, r.weightPct]),
      );
      expect(byName.get('Databases')).toBe(40);
      expect(
        body
          .filter((r: { topicName: string }) => r.topicName !== 'Databases')
          .reduce((s: number, r: { weightPct: number }) => s + r.weightPct, 0),
      ).toBe(60);
    });

    it('says which weights are a human’s and why', async () => {
      const body = await derive();
      const databases = body.find((r: { topicName: string }) => r.topicName === 'Databases');
      expect(databases.weightSource).toBe('override');
      expect(databases.overrideReason).toContain('under-imported');
      // And keeps the bank's own opinion alongside, so the size of the
      // correction stays visible.
      expect(databases.derivedPct).toBe(10);

      const algorithms = body.find((r: { topicName: string }) => r.topicName === 'Algorithms');
      expect(algorithms.weightSource).toBe('derived');
      expect(algorithms.overrideReason).toBeNull();
    });

    /**
     * The failure this design exists to prevent.
     *
     * If the override lived in `Topic.weightPct` itself, the next import
     * followed by a re-derive would overwrite it — and nothing would say so. A
     * reviewer's judgement would evaporate on the most routine action there is.
     */
    it('survives a re-derivation after the bank moves', async () => {
      await addPublished('Networks', 10, 200);
      const body = await derive();
      const byName = new Map(
        body.map((r: { topicName: string; weightPct: number }) => [r.topicName, r.weightPct]),
      );
      expect(byName.get('Databases')).toBe(40);
      expect(body.reduce((s: number, r: { weightPct: number }) => s + r.weightPct, 0)).toBe(100);
    });

    it('refuses an override with no reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/fields/${fieldId}/weights/topics/${topicIds.Networks}`)
        .set(staff.auth)
        .send({ weightPct: 20, reason: '   ' })
        .expect(422);
      expect(res.body.error).toBe('REASON_REQUIRED');
    });

    it('refuses a weight outside 0..100', async () => {
      for (const weightPct of [-1, 101, 12.5]) {
        const res = await request(app.getHttpServer())
          .post(`/admin/fields/${fieldId}/weights/topics/${topicIds.Networks}`)
          .set(staff.auth)
          .send({ weightPct, reason: 'because' })
          .expect(422);
        expect(res.body.error).toBe('INVALID_WEIGHT');
      }
    });

    it('goes back to the bank when the override is cleared', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/fields/${fieldId}/weights/topics/${topicIds.Databases}`)
        .set(staff.auth)
        .expect(200);

      const body = await derive();
      const databases = body.find((r: { topicName: string }) => r.topicName === 'Databases');
      expect(databases.weightSource).toBe('derived');
      expect(databases.overrideReason).toBeNull();
      expect(body.reduce((s: number, r: { weightPct: number }) => s + r.weightPct, 0)).toBe(100);
    });
  });

  /**
   * The point of the whole task: T-046 refuses to publish a question whose topic
   * has no weight, so until T-134 ran, every real question was unpublishable.
   */
  it('leaves every topic weighted, which is what the publish gate needs', async () => {
    const topics = await prisma.topic.findMany({
      where: { id: { in: Object.values(topicIds) } },
      select: { name: true, weightPct: true },
    });
    for (const topic of topics) {
      expect(topic.weightPct, `${topic.name} is unweighted`).not.toBeNull();
    }
  });
});
