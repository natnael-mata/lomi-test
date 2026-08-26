/**
 * Integration test — choosing a programme, and the guard that insists on one
 * (T-085).
 *
 * The guard is exercised against a stub controller declared in this file rather
 * than against `/questions/next`, which does not exist until T-105. The stub is
 * a harness for the rule, not a stand-in for the feature: what it proves is that
 * `FieldRequiredGuard` answers 409 `FIELD_REQUIRED` for a user with no field and
 * lets a chosen one through. Wiring it onto the real endpoint is T-105's job,
 * and T-085 keeps a note saying so.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */

import { Controller, Get, type INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInByPhone, TEST_JWT_SECRET } from '../auth/staff-testkit.test-helper';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { FieldRequiredGuard } from './field-required.guard';
import { SessionGuard } from './session.guard';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
/** Prefix for every row this suite makes, so cleanup can find them all. */
const SFX = 'FIELD-E2E';
const TG = 559000001;

@Controller('__test/gated')
@UseGuards(SessionGuard, FieldRequiredGuard)
class GatedStubController {
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }
}

describe('choosing a programme', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let userId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    await prisma.option.deleteMany({ where: { question: { stableId: { startsWith: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { startsWith: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { startsWith: SFX.toLowerCase() } } });
    await prisma.course.deleteMany({ where: { slug: { startsWith: SFX.toLowerCase() } } });
  };

  /**
   * Gives a seeded field one published question, so it can be chosen.
   *
   * **Published is not the same as ready** (T-245): choosing a programme with an
   * empty bank strands a student behind the field gate, with every screen
   * working and nothing to show, so `chooseField` refuses it. The launch fields
   * ship unpublished-and-empty on purpose — filling them is T-212 — which left
   * this suite choosing programmes that legitimately cannot be chosen yet.
   *
   * The suite is about the *guard*, not about content, so it brings its own
   * single question rather than depending on seed data it does not control.
   */
  const makeChoosable = async (slug: string): Promise<string> => {
    const field = await prisma.field.findFirstOrThrow({ where: { slug } });
    const course = await prisma.course.upsert({
      // Slugs are unique per field, not globally.
      where: { fieldId_slug: { fieldId: field.id, slug: `${SFX.toLowerCase()}-${slug}` } },
      update: {},
      create: { fieldId: field.id, name: `Course ${slug}`, slug: `${SFX.toLowerCase()}-${slug}` },
    });
    const topic = await prisma.topic.upsert({
      where: { courseId_slug: { courseId: course.id, slug: `${SFX.toLowerCase()}-${slug}` } },
      update: {},
      create: {
        courseId: course.id,
        name: `Topic ${slug}`,
        slug: `${SFX.toLowerCase()}-${slug}`,
        weightPct: 100,
      },
    });
    await prisma.question.upsert({
      where: { stableId: `${SFX}-${slug}` },
      update: { status: 'PUBLISHED' },
      create: {
        stableId: `${SFX}-${slug}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: `A question in ${slug}`,
        conceptLine: 'A concept.',
        explanation: 'An explanation.',
        timeLimitSec: 60,
        status: 'PUBLISHED',
        authorId: 'field-e2e',
        options: {
          create: [
            { label: 'A', text: 'right', isCorrect: true },
            { label: 'B', text: 'wrong', isCorrect: false, whyWrong: 'Because.' },
          ],
        },
      },
    });
    return field.id;
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GatedStubController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const body = await signInByPhone(app, prisma, TG);
    token = body.token;
    userId = body.userId;

    await makeChoosable('computer-science');
    await makeChoosable('public-health');
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  it('starts with no field chosen', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.fieldId).toBeNull();
  });

  // The task's own rule, on a stub of the endpoint T-105 will add.
  it('409s with FIELD_REQUIRED until a field is chosen', async () => {
    const res = await auth(request(app.getHttpServer()).get('/__test/gated')).expect(409);
    expect(res.body.error).toBe('FIELD_REQUIRED');
  });

  it('lists only published programmes', async () => {
    const body = (await auth(request(app.getHttpServer()).get('/me/fields')).expect(200)).body as {
      name: string;
    }[];
    const names = body.map((f) => f.name);
    expect(names).toContain('Computer Science');
    expect(names).toContain('Public Health');
    expect(names).toContain('Accounting & Finance');
    // Geography is seeded unpublished on purpose — it is the needs_answer example.
    expect(names).not.toContain('Geography');
  });

  it('accepts a published field and records it', async () => {
    const cs = await prisma.field.findFirstOrThrow({ where: { slug: 'computer-science' } });
    const body = (
      await auth(request(app.getHttpServer()).put('/me/field')).send({ fieldId: cs.id }).expect(200)
    ).body;
    expect(body).toMatchObject({ fieldId: cs.id, name: 'Computer Science' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.fieldId).toBe(cs.id);
  });

  it('lets the request through once a field is chosen', async () => {
    const res = await auth(request(app.getHttpServer()).get('/__test/gated')).expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  // An unpublished field has nothing servable in it; choosing one strands the
  // student. Same 404 as a nonexistent id — which fields are unpublished is not
  // a student's business.
  it('refuses an unpublished field, the same way as an unknown one', async () => {
    const geo = await prisma.field.findFirstOrThrow({ where: { slug: 'geography' } });
    await auth(request(app.getHttpServer()).put('/me/field')).send({ fieldId: geo.id }).expect(404);
    await auth(request(app.getHttpServer()).put('/me/field')).send({ fieldId: 'nope' }).expect(404);
  });

  /*
   * T-245. Published says we mean to offer a subject; it does not say there is
   * anything in it.
   *
   * Accounting & Finance is the sharp case: it is published and it *has*
   * questions — five of them — none of which are published. A student who chose
   * it landed behind the field gate with every screen working and nothing to
   * show, and practice reporting "nothing left to practise in this programme
   * today" about a bank that had never served a question. Refused on the
   * chooser, where they can still pick something else.
   */
  it('refuses a published programme with no published questions', async () => {
    const af = await prisma.field.findFirstOrThrow({ where: { slug: 'accounting-finance' } });
    expect(await prisma.question.count({ where: { fieldId: af.id, status: 'PUBLISHED' } })).toBe(0);

    const res = await auth(request(app.getHttpServer()).put('/me/field'))
      .send({ fieldId: af.id })
      .expect(422);
    expect(res.body.error).toBe('PROGRAMME_NOT_READY');
    // Named, so the chooser can say which one and the student is not left
    // guessing which of four they just failed to pick.
    expect(res.body.message).toContain('Accounting & Finance');
  });

  it('tells the chooser how much is behind each programme', async () => {
    const fields = (await auth(request(app.getHttpServer()).get('/me/fields')).expect(200)).body;
    const byName = new Map<string, { name: string; questionCount: number }>(
      (fields as { name: string; questionCount: number }[]).map((f) => [f.name, f]),
    );

    // The two this suite filled, and one it deliberately did not.
    expect(byName.get('Computer Science')?.questionCount).toBeGreaterThan(0);
    expect(byName.get('Public Health')?.questionCount).toBeGreaterThan(0);
    expect(byName.get('Accounting & Finance')?.questionCount).toBe(0);
  });

  it('leaves the previous choice in place after a refusal', async () => {
    const cs = await prisma.field.findFirstOrThrow({ where: { slug: 'computer-science' } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.fieldId).toBe(cs.id);
  });

  // Students do switch programmes, and refusing means a support ticket for a
  // mistake made in the first thirty seconds.
  it('allows switching to another published field', async () => {
    const ph = await prisma.field.findFirstOrThrow({ where: { slug: 'public-health' } });
    await auth(request(app.getHttpServer()).put('/me/field')).send({ fieldId: ph.id }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.fieldId).toBe(ph.id);
  });

  it('401s on the gated route without a token, before the field is even considered', async () => {
    await request(app.getHttpServer()).get('/__test/gated').expect(401);
  });
});

/*
 * A programme switch that would change what the student paid (T-268).
 *
 * Subscriptions are account-wide and the price is not. Without this, Br 300 of
 * school access became Br 300 of exit-exam access by choosing a different
 * programme — no exploit needed, just the ordinary screen.
 */
describe('switching programme across the pricing line (T-268)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId = '';
  let schoolField = '';
  let exitField = '';
  const SFX2 = 'e2e-field-cross';

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const school = await prisma.field.create({
      data: {
        name: `Grade 6 ${SFX2}`,
        slug: `grade-6-${SFX2}`,
        isPublished: true,
        minGrade: 4,
        maxGrade: 6,
      },
      select: { id: true },
    });
    const grade8 = await prisma.field.create({
      data: {
        name: `Grade 8 ${SFX2}`,
        slug: `grade-8-${SFX2}`,
        isPublished: true,
        minGrade: 7,
        maxGrade: 8,
      },
      select: { id: true },
    });
    const exit = await prisma.field.create({
      data: { name: `Exit ${SFX2}`, slug: `exit-${SFX2}`, isPublished: true },
      select: { id: true },
    });
    schoolField = school.id;
    exitField = exit.id;

    /*
     * One published question per field.
     *
     * `chooseField` refuses an empty programme before it looks at anything
     * else — "this one is being written" — so without content the pricing guard
     * below is never reached and these tests would pass on the wrong refusal.
     */
    for (const fieldId of [schoolField, grade8.id, exitField]) {
      const course = await prisma.course.create({
        data: { fieldId, name: 'Subject', slug: `c-${fieldId}` },
        select: { id: true },
      });
      const topic = await prisma.topic.create({
        data: { courseId: course.id, name: 'Topic', slug: `t-${fieldId}` },
        select: { id: true },
      });
      await prisma.question.create({
        data: {
          stableId: `${SFX2}-${fieldId}`,
          topicId: topic.id,
          fieldId,
          qType: 'CONCEPT',
          stem: 'Q',
          conceptLine: 'C',
          explanation: 'E',
          timeLimitSec: 60,
          status: 'PUBLISHED',
          authorId: 'field-cross-e2e',
        },
      });
    }

    const user = await prisma.user.create({
      data: { displayName: `Switcher ${SFX2}`, fieldId: schoolField },
      select: { id: true },
    });
    userId = user.id;

    // Live school access, the state that makes the move a price change.
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'SCHOOL_YEAR' } });
    await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        // What they actually paid, which is the whole point of the guard below.
        paidEtb: plan.priceEtb,
        status: 'ACTIVE',
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 300 * 86_400_000),
      },
    });

  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX2 } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: { contains: SFX2 } } } } });
    await prisma.course.deleteMany({ where: { field: { name: { contains: SFX2 } } } });
    await prisma.field.deleteMany({ where: { name: { contains: SFX2 } } });
    await app.close();
  });

  it('refuses a move onto an exit track while school access is live', async () => {
    const service = app.get(AuthService);
    await expect(service.chooseField(userId, exitField)).rejects.toMatchObject({
      response: { error: 'PLAN_COVERS_ANOTHER_TRACK' },
    });
  });

  it('names the price rather than refusing to explain', async () => {
    const service = app.get(AuthService);
    await service.chooseField(userId, exitField).catch((e: unknown) => {
      const body = (e as { response?: { message?: string } }).response;
      // "message us" is the honest answer here: the fix is a payment the student
      // cannot make without first giving up access they hold.
      expect(body?.message).toMatch(/priced differently|message us/i);
    });
  });

  it('allows a move within the same tier', async () => {
    const service = app.get(AuthService);
    const grade8 = await prisma.field.findFirstOrThrow({
      where: { name: `Grade 8 ${SFX2}` },
      select: { id: true },
    });
    // Grade 6 to Grade 8 is the same plan. Blocking it would be punishing a
    // student for moving up a year.
    const moved = await service.chooseField(userId, grade8.id);
    expect(moved.fieldId).toBe(grade8.id);
  });

  it('allows anything once no subscription is live', async () => {
    await prisma.subscription.updateMany({ where: { userId }, data: { status: 'EXPIRED' } });
    const service = app.get(AuthService);
    const moved = await service.chooseField(userId, exitField);
    expect(moved.fieldId).toBe(exitField);
  });
});

