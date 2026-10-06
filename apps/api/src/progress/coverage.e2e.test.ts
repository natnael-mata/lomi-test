/**
 * Integration test — coverage, and what "beaten" means (T-254, T-255, T-256).
 *
 * Two claims, both of which the product would be actively harmful without.
 *
 * **A guess does not count.** A question is beaten when the student answered it
 * correctly *and* named the reason. The Ethiopian exam is drawn from a question
 * bank, so questions repeat — a student who memorises the letter passes the app
 * and fails the paper. If the reason condition is ever deleted, the fourth test
 * here fails by name.
 *
 * **Grade 12 Natural and Grade 12 Social are separate tracks.** A Natural
 * candidate never sits Geography, so one combined package would put questions
 * they will never be asked into the denominator of their coverage — permanently
 * wrong, and invisible to the person it is wrong for.
 *
 * Everything goes through the real routes. Coverage is arithmetic over what the
 * attempt path actually wrote, and a test that wrote its own attempt rows would
 * agree with itself while the two halves drifted.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { COVERAGE_TARGET_PCT } from './coverage';
import {
  signInByPhone,
  TEST_BOT_TOKEN,
  TEST_JWT_SECRET,
  cleanupStaff,
} from '../auth/staff-testkit.test-helper';

const SFX = 'e2e-coverage';
const TG = 567000010;

describe('coverage (T-256)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let userId = '';
  let naturalId = '';
  let socialId = '';
  /** Natural's questions, in creation order, with the grade each carries. */
  const natural: { id: string; grade: number }[] = [];

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { telegramId: String(TG) },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pointEntry.deleteMany({ where: { userId: { in: ids } } });
    await cleanupStaff(prisma, [TG], SFX);
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: { contains: SFX } } } } });
    await prisma.course.deleteMany({ where: { field: { name: { contains: SFX } } } });
    await prisma.field.deleteMany({ where: { name: { contains: SFX } } });
  };

  /** One answerable question, with a concept line and enough why-wrongs to ask. */
  const makeQuestion = async (
    fieldId: string,
    topicId: string,
    stableId: string,
    sourceGrade: number | null,
  ): Promise<string> => {
    const q = await prisma.question.create({
      data: {
        stableId,
        topicId,
        fieldId,
        sourceGrade,
        qType: 'CONCEPT',
        stem: `Question ${stableId}`,
        conceptLine: `The concept behind ${stableId}.`,
        explanation: 'An explanation.',
        timeLimitSec: 60,
        status: 'PUBLISHED',
        authorId: 'coverage-e2e',
        options: {
          create: [
            { label: 'A', text: 'right', isCorrect: true },
            { label: 'B', text: 'wrong b', isCorrect: false, whyWrong: `B is wrong: ${stableId}` },
            { label: 'C', text: 'wrong c', isCorrect: false, whyWrong: `C is wrong: ${stableId}` },
            { label: 'D', text: 'wrong d', isCorrect: false, whyWrong: `D is wrong: ${stableId}` },
          ],
        },
      },
      select: { id: true },
    });
    return q.id;
  };

  const track = async (name: string, courseName: string): Promise<[string, string]> => {
    const field = await prisma.field.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        isPublished: true,
        minGrade: 9,
        maxGrade: 12,
        // Fixed, so `daysToExam` is arithmetic rather than a race with the clock.
        examDate: new Date(Date.now() + 100 * 86_400_000),
      },
      select: { id: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: courseName, slug: `${courseName.toLowerCase()}-${SFX}` },
      select: { id: true },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: courseName, slug: `t-${courseName.toLowerCase()}-${SFX}` },
      select: { id: true },
    });
    return [field.id, topic.id];
  };

  const coverage = async (fieldId: string) =>
    (
      await request(app.getHttpServer())
        .get(`/me/coverage/${fieldId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;

  /** Answers correctly and returns the reason check that came back with it. */
  const answerRight = async (questionId: string) => {
    const res = await request(app.getHttpServer())
      .post('/attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ questionId, chosenLabel: 'A', timeTakenSec: 20 })
      .expect(201);
    return res.body;
  };

  const nameReason = async (attemptId: string, chosenId: string, expected = 201) =>
    (
      await request(app.getHttpServer())
        .post(`/attempts/${attemptId}/reason`)
        .set('Authorization', `Bearer ${token}`)
        .send({ chosenId })
        .expect(expected)
    ).body;

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const [nid, nTopic] = await track(`Grade 12 Natural ${SFX}`, 'Chemistry');
    const [sid] = await track(`Grade 12 Social ${SFX}`, 'Geography');
    naturalId = nid;
    socialId = sid;

    // Four in Natural, spread across two years so the per-grade breakdown has
    // shape rather than one bar.
    for (const [n, grade] of [
      [1, 9],
      [2, 10],
      [3, 10],
      [4, 12],
    ] as const) {
      natural.push({ id: await makeQuestion(nid, nTopic, `COV-N${n}-${SFX}`, grade), grade });
    }

    // And three in Social, which a Natural candidate must never be counted on.
    const socialTopic = await prisma.topic.findFirstOrThrow({
      where: { course: { fieldId: sid } },
      select: { id: true },
    });
    for (const n of [1, 2, 3]) {
      await makeQuestion(sid, socialTopic.id, `COV-S${n}-${SFX}`, 11);
    }

    const signIn = { body: await signInByPhone(app, prisma, TG) };
    token = signIn.body.token;
    userId = signIn.body.userId;
    await prisma.user.update({ where: { id: userId }, data: { fieldId: nid } });
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('counts only this track — a Natural candidate is never measured on Social', async () => {
    const view = await coverage(naturalId);
    // Four, not seven. The three Geography questions exist, are published, and
    // belong to a track this student is not sitting.
    expect(view.total).toBe(4);
    expect(view.bySubject.map((s: { label: string }) => s.label)).toEqual(['Chemistry']);

    const social = await coverage(socialId);
    expect(social.total).toBe(3);
  });

  it('reports the year span so the client does not hard-code four columns', async () => {
    const view = await coverage(naturalId);
    expect(view.years).toEqual({ min: 9, max: 12 });
  });

  it('starts at nothing beaten', async () => {
    const view = await coverage(naturalId);
    expect(view.beaten).toBe(0);
    expect(view.pct).toBe(0);
    expect(view.targetPct).toBe(COVERAGE_TARGET_PCT);
    // ceil(4 × 0.8) = 4. Every question in a four-question track is needed.
    expect(view.targetCount).toBe(4);
    expect(view.toTarget).toBe(4);
  });

  /*
   * THE test. If the reason condition is ever removed from the coverage query,
   * this is what fails, and it fails saying exactly what went wrong.
   */
  it('does not count a correct answer whose reason was wrong', async () => {
    const attempt = await answerRight(natural[0]!.id);
    expect(attempt.isCorrect).toBe(true);
    expect(attempt.reasonCheck).not.toBeNull();

    // Pick a distractor: anything whose text is not the question's own concept
    // line. The ids carry no hint, so this is the only way to choose one.
    const wrong = attempt.reasonCheck.options.find(
      (o: { text: string }) => !o.text.startsWith('The concept behind'),
    );
    const graded = await nameReason(attempt.attemptId, wrong.id);
    expect(graded.reasonCorrect).toBe(false);
    expect(graded.beaten).toBe(false);

    const view = await coverage(naturalId);
    expect(view.beaten).toBe(0);
    expect(view.toTarget).toBe(4);
  });

  it('counts it once the reason is named', async () => {
    // A second attempt on the same question: the first was correct but not
    // beaten, so the check must be offered again.
    const attempt = await answerRight(natural[0]!.id);
    expect(attempt.reasonCheck).not.toBeNull();

    const right = attempt.reasonCheck.options.find((o: { text: string }) =>
      o.text.startsWith('The concept behind'),
    );
    const graded = await nameReason(attempt.attemptId, right.id);
    expect(graded.beaten).toBe(true);

    const view = await coverage(naturalId);
    expect(view.beaten).toBe(1);
    expect(view.pct).toBe(25);
    expect(view.toTarget).toBe(3);
  });

  it('stops asking once a question is beaten', async () => {
    const attempt = await answerRight(natural[0]!.id);
    expect(attempt.isCorrect).toBe(true);
    // Nothing left to prove on this one, and asking again is friction with
    // nothing behind it.
    expect(attempt.reasonCheck).toBeNull();
  });

  it('refuses a second answer to the same check', async () => {
    const attempt = await answerRight(natural[1]!.id);
    const right = attempt.reasonCheck.options.find((o: { text: string }) =>
      o.text.startsWith('The concept behind'),
    );
    await nameReason(attempt.attemptId, right.id);
    // Walking the options until one takes is a worse guess than the letter.
    const again = await nameReason(attempt.attemptId, right.id, 409);
    expect(again.error).toBe('REASON_ALREADY_ANSWERED');
  });

  it('breaks the track down by the year each question came from', async () => {
    const view = await coverage(naturalId);
    const grades = Object.fromEntries(
      view.byGrade.map((g: { key: string; total: number; beaten: number }) => [g.key, g]),
    );
    // Two beaten so far, both Grade 9 and Grade 10 questions.
    expect(grades['9'].total).toBe(1);
    expect(grades['10'].total).toBe(2);
    expect(grades['12'].total).toBe(1);
    expect(view.byGrade.map((g: { key: string }) => g.key)).toEqual(['9', '10', '12']);
  });

  it('derives a daily target from the days that are left', async () => {
    const view = await coverage(naturalId);
    expect(view.daysToExam).toBe(100);
    // Two to go over a hundred days is arithmetic nobody can act on, so the
    // floor lifts the ask while `toTarget` and `daysToExam` stay honest. It
    // lifts it to the two that are left and no further: twelve would be ten
    // questions that do not exist.
    expect(view.perDay).toBe(2);
    expect(view.toTarget).toBe(2);
  });

  it('reports no daily target where no exam date has been set', async () => {
    await prisma.field.update({ where: { id: naturalId }, data: { examDate: null } });
    const view = await coverage(naturalId);
    // Absent, not zero — a zero against a target draws a full progress bar.
    expect(view.daysToExam).toBeNull();
    expect(view.perDay).toBeNull();
  });
});
