/**
 * Integration test — the provider's two screens (T-227, T-228, T-229).
 *
 * Three properties, and the first is the one the whole role rests on.
 *
 * 1. **An ADMIN cannot read the activity log.** The feed records what operators
 *    do; an operator who can read it is an operator who can check whether their
 *    own action was noticed. `satisfies()` was two `if`s when there were two
 *    roles, and a third added carelessly to that shape would have let exactly
 *    this through.
 *
 * 2. **The feed leaks neither identity nor performance.** Somebody other than
 *    the subject reads this screen, so it must never carry a legal name, never
 *    an IP, and never a score attached to a named student. Those are asserted
 *    against sentinels planted in the fixtures rather than against the shape of
 *    the response — a field renamed still fails, which is the point.
 *
 * 3. **`not_configured` is not `ok` and not `down`.** SMS is not built here.
 *    Green would be a lie about a channel that cannot deliver; red would be a
 *    permanent alarm, and a board with one is a board nobody reads.
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
import { satisfies } from '../auth/staff.guard';
import type { ActivityPage } from './activity.service';
import type { HealthReport } from './health.service';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
const SFX = 'e2e-provider';

/** Planted in the fixtures. If one reaches the wire, the assertion names it. */
const LEGAL_NAME = 'Legal-Name-SENTINEL';
const IP_SENTINEL = '203.0.113.44';

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

describe('the provider role and its screens (T-227, T-228, T-229)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let studentToken = '';
  let reviewerToken = '';
  let adminToken = '';
  let providerToken = '';
  let studentId = '';

  const TG = { student: 563000001, reviewer: 563000002, admin: 563000003, provider: 563000004 };

  const cleanup = async (): Promise<void> => {
    await prisma.attempt.deleteMany({ where: { field: { slug: { contains: SFX } } } });
    await prisma.auditLog.deleteMany({ where: { reference: { contains: SFX } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    await prisma.session.deleteMany({
      where: { user: { telegramId: { startsWith: '5630000' } } },
    });
    await prisma.user.deleteMany({ where: { telegramId: { startsWith: '5630000' } } });
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

    const student = await signIn(TG.student);
    const reviewer = await signIn(TG.reviewer);
    const admin = await signIn(TG.admin);
    const provider = await signIn(TG.provider);
    studentToken = student.token;
    reviewerToken = reviewer.token;
    adminToken = admin.token;
    providerToken = provider.token;
    studentId = student.userId;

    await prisma.staffMember.create({
      data: { userId: reviewer.userId, role: 'REVIEWER', grantedBy: `test-${SFX}` },
    });
    await prisma.staffMember.create({
      data: { userId: admin.userId, role: 'ADMIN', grantedBy: `test-${SFX}` },
    });
    await prisma.staffMember.create({
      data: { userId: provider.userId, role: 'PROVIDER', grantedBy: `test-${SFX}` },
    });

    /*
     * The student carries a legal name and a session labelled with an IP.
     *
     * Neither should ever reach the feed. The IP is planted in `deviceLabel`
     * even though the schema says that column holds "Chrome on Android" —
     * precisely because a comment is not a control, and this asserts the feed
     * would not carry one if somebody put one there.
     */
    await prisma.user.update({
      where: { id: student.userId },
      data: { name: LEGAL_NAME },
    });
    await prisma.session.updateMany({
      where: { userId: student.userId },
      data: { deviceLabel: IP_SENTINEL },
    });

    const field = await prisma.field.create({
      data: { name: `Provider ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'C', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'T', slug: `topic-${SFX}`, weightPct: 100 },
    });
    const question = await prisma.question.create({
      data: {
        stableId: `PROV-${SFX}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A question',
        conceptLine: 'A concept.',
        explanation: 'An explanation.',
        timeLimitSec: 60,
        status: 'PUBLISHED',
        authorId: 'author-x',
        options: { create: [{ label: 'A', text: 'a', isCorrect: true }] },
      },
    });

    // A wrong answer, so a "how did they do" leak would have something to leak.
    await prisma.attempt.create({
      data: {
        userId: student.userId,
        questionId: question.id,
        fieldId: field.id,
        topicId: topic.id,
        chosenLabel: 'A',
        isCorrect: false,
        timeTakenSec: 30,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  /**
   * The rank, in full.
   *
   * Nine combinations rather than the three that would have caught the bug that
   * prompted this: a table with a hole in it is a table somebody trusts.
   */
  describe('the role hierarchy', () => {
    it('lets each role satisfy itself and everything below it', () => {
      expect(satisfies('REVIEWER', 'REVIEWER')).toBe(true);
      expect(satisfies('ADMIN', 'REVIEWER')).toBe(true);
      expect(satisfies('PROVIDER', 'REVIEWER')).toBe(true);

      expect(satisfies('ADMIN', 'ADMIN')).toBe(true);
      expect(satisfies('PROVIDER', 'ADMIN')).toBe(true);

      expect(satisfies('PROVIDER', 'PROVIDER')).toBe(true);
    });

    it('never lets a lower role satisfy a higher one', () => {
      expect(satisfies('REVIEWER', 'ADMIN')).toBe(false);
      expect(satisfies('REVIEWER', 'PROVIDER')).toBe(false);
      // The one that matters: an operator must not be able to read the record
      // of what operators do.
      expect(satisfies('ADMIN', 'PROVIDER')).toBe(false);
    });
  });

  describe('who may reach /provider', () => {
    for (const path of ['/provider/activity', '/provider/health']) {
      it(`refuses a signed-out caller on ${path}`, async () => {
        await request(app.getHttpServer()).get(path).expect(401);
      });

      it(`refuses a student on ${path}`, async () => {
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', `lomi_session=${studentToken}`)
          .expect(403);
      });

      it(`refuses a reviewer on ${path}`, async () => {
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', `lomi_session=${reviewerToken}`)
          .expect(403);
      });

      it(`refuses an ADMIN on ${path}`, async () => {
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', `lomi_session=${adminToken}`)
          .expect(403);
      });

      it(`lets a PROVIDER read ${path}`, async () => {
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', `lomi_session=${providerToken}`)
          .expect(200);
      });
    }
  });

  describe('the activity feed', () => {
    const feed = async (query = ''): Promise<{ text: string; body: ActivityPage }> => {
      const res = await request(app.getHttpServer())
        .get(`/provider/activity${query}`)
        .set('Cookie', `lomi_session=${providerToken}`)
        .expect(200);
      return { text: JSON.stringify(res.body), body: res.body as ActivityPage };
    };

    it('carries the events it says it does', async () => {
      const { body } = await feed();
      const kinds = new Set(body.events.map((e) => e.kind));
      // Sign-ins and the attempt were both created in setup, so both must be
      // here; a feed that quietly drops a source is the failure this catches.
      expect(kinds.has('signin')).toBe(true);
      expect(kinds.has('practice')).toBe(true);
    });

    it('is newest first', async () => {
      const { body } = await feed();
      const times: string[] = body.events.map((e) => e.at);
      expect([...times].sort().reverse()).toEqual(times);
    });

    it('never carries a legal name', async () => {
      const { text } = await feed();
      expect(text).not.toContain(LEGAL_NAME);
    });

    it('never carries an IP, even when one is sitting in the column', async () => {
      const { text } = await feed();
      expect(text).not.toContain(IP_SENTINEL);
    });

    it('never says how a named student did', async () => {
      const { body } = await feed('?kinds=practice');
      const mine = body.events.filter((e) => e.whoId === studentId);
      expect(mine.length).toBeGreaterThan(0);
      for (const event of mine) {
        // The student answered incorrectly. The feed may say an answer happened;
        // it may not say it was wrong, and it may not carry a score or a
        // percentage beside somebody's name.
        expect(event.what.toLowerCase()).not.toContain('wrong');
        expect(event.what.toLowerCase()).not.toContain('incorrect');
        expect(event.what).not.toMatch(/\d+\s*%/);
      }
    });

    it('filters to the kind asked for', async () => {
      const { body } = await feed('?kinds=signin');
      expect(body.events.length).toBeGreaterThan(0);
      for (const event of body.events) expect(event.kind).toBe('signin');
    });

    it('says what it read to produce the page', async () => {
      const { body } = await feed();
      // The counts are what the screen shows under "read from …". A feed that
      // caps each source and does not say so reports a partial picture as a
      // whole one.
      expect(typeof body.totals.staff).toBe('number');
      expect(typeof body.totals.attempts).toBe('number');
    });
  });

  describe('the health board', () => {
    const report = async (): Promise<HealthReport> =>
      (
        await request(app.getHttpServer())
          .get('/provider/health')
          .set('Cookie', `lomi_session=${providerToken}`)
          .expect(200)
      ).body as HealthReport;

    it('reports every component with a status and what was measured', async () => {
      const body = await report();
      const keys = body.components.map((c) => c.key);
      expect(keys).toEqual(['database', 'api', 'web', 'security', 'vps', 'sms']);
      for (const component of body.components) {
        expect(['ok', 'degraded', 'down', 'not_configured']).toContain(component.status);
        // DESIGN.md: every number on screen is reconstructable. A status board
        // is where an unexplained figure does the most damage.
        expect(component.derivation.length).toBeGreaterThan(10);
      }
    });

    it('measures the database rather than assuming it', async () => {
      const body = await report();
      const database = body.components.find((c) => c.key === 'database')!;
      expect(database.status).toBe('ok');
      // A real query was timed, so there is a latency. A connection check would
      // have none — which is exactly the difference being asserted.
      expect(database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(database.derivation).toContain('SELECT 1');
    });

    it('calls SMS not_configured rather than ok or down', async () => {
      const previous = process.env.SMS_PROVIDER;
      delete process.env.SMS_PROVIDER;
      try {
        const body = await report();
        const sms = body.components.find((c) => c.key === 'sms')!;
        expect(sms.status).toBe('not_configured');
        // Neither a lie about a channel that cannot deliver, nor a permanent
        // alarm on a board somebody has to keep reading.
        expect(sms.status).not.toBe('ok');
        expect(sms.status).not.toBe('down');
      } finally {
        if (previous !== undefined) process.env.SMS_PROVIDER = previous;
      }
    });

    it('says so when the smoke-test sign-in door is open', async () => {
      const previous = process.env.DEV_LOGIN_SECRET;
      process.env.DEV_LOGIN_SECRET = 'a-secret-long-enough-to-count-000';
      try {
        const body = await report();
        const security = body.components.find((c) => c.key === 'security')!;
        expect(security.status).toBe('degraded');
        expect(security.derivation).toContain('DEV_LOGIN_SECRET');
      } finally {
        if (previous === undefined) delete process.env.DEV_LOGIN_SECRET;
        else process.env.DEV_LOGIN_SECRET = previous;
      }
    });

    /**
     * The rule, not a fixed answer.
     *
     * This asserted `overall === 'degraded'` and failed the first time it ran
     * without the web app up — the board correctly reported the front end as
     * `down`, and the test was measuring the environment rather than the rule.
     * What it means to assert is: **the overall is the worst component, and
     * `not_configured` counts as fine** — nothing is wrong with a channel
     * nobody has switched on.
     */
    it('takes the worst component as the overall status', async () => {
      const previous = process.env.DEV_LOGIN_SECRET;
      process.env.DEV_LOGIN_SECRET = 'a-secret-long-enough-to-count-000';
      try {
        const body = await report();
        const RANK: Record<string, number> = { ok: 0, not_configured: 0, degraded: 1, down: 2 };
        const worst = Math.max(...body.components.map((c) => RANK[c.status] ?? 0));
        expect(RANK[body.overall]).toBe(worst);

        // And the half that would otherwise go unchecked: SMS is
        // `not_configured` here, and its presence must not be what set the
        // overall — a permanent alarm is an alarm nobody reads.
        const sms = body.components.find((c) => c.key === 'sms')!;
        expect(sms.status).toBe('not_configured');
        expect(RANK[sms.status]).toBe(0);

        // The open door is degraded, so the overall can never be plain `ok`
        // while it is set.
        expect(body.overall).not.toBe('ok');
      } finally {
        if (previous === undefined) delete process.env.DEV_LOGIN_SECRET;
        else process.env.DEV_LOGIN_SECRET = previous;
      }
    });
  });
});
