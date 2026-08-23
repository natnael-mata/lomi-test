/**
 * Integration test — the banded board (T-257).
 *
 * The claim this suite exists for is the one about a child: **an eleven-year-old
 * never appears on the senior board, and a junior who has not opted in appears
 * on neither.** T-194's default — listed unless you opt out — is right for an
 * adult deciding whether to compete in public and wrong for a Grade 6 student
 * whose consent belongs to a parent who has not been asked.
 *
 * The other claim is that ranking is by coverage percentage. A Grade 12 package
 * is roughly three times a Grade 6 one, so a points board would rank the
 * package; the fixture below makes the smaller-bank student the better student
 * and checks that the board agrees.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { BoardService } from './board.service';

const SFX = 'e2e-board';

describe('the banded board (T-257)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let boards: BoardService;

  const ids: Record<string, string> = {};
  const fields: Record<string, string> = {};

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { displayName: { contains: SFX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.attempt.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: { contains: SFX } } } } });
    await prisma.course.deleteMany({ where: { field: { name: { contains: SFX } } } });
    await prisma.field.deleteMany({ where: { name: { contains: SFX } } });
  };

  /** A track with `count` published questions. */
  const track = async (name: string, maxGrade: number | null, count: number): Promise<string> => {
    const field = await prisma.field.create({
      data: {
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        isPublished: true,
        minGrade: maxGrade === null ? null : Math.max(1, maxGrade - 2),
        maxGrade,
      },
      select: { id: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Subject', slug: `c-${field.id}` },
      select: { id: true },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `t-${field.id}` },
      select: { id: true },
    });
    for (let n = 0; n < count; n++) {
      await prisma.question.create({
        data: {
          stableId: `${SFX}-${field.id}-${n}`,
          topicId: topic.id,
          fieldId: field.id,
          qType: 'CONCEPT',
          stem: 'Q',
          conceptLine: 'C',
          explanation: 'E',
          timeLimitSec: 60,
          status: 'PUBLISHED',
          authorId: 'board-e2e',
        },
      });
    }
    return field.id;
  };

  /** A student who has beaten `beaten` of their track. */
  const student = async (
    name: string,
    fieldId: string,
    beaten: number,
    optOut: boolean | null,
    daysAgo = 0,
  ): Promise<string> => {
    const user = await prisma.user.create({
      data: { displayName: name, fieldId, leaderboardOptOut: optOut },
      select: { id: true },
    });
    const questions = await prisma.question.findMany({
      where: { fieldId },
      take: beaten,
      select: { id: true, topicId: true },
    });
    for (const q of questions) {
      await prisma.attempt.create({
        data: {
          userId: user.id,
          questionId: q.id,
          fieldId,
          topicId: q.topicId,
          chosenLabel: 'A',
          isCorrect: true,
          reasonCorrect: true,
          reasonChoiceId: 'fixture',
          timeTakenSec: 20,
          createdAt: new Date(Date.now() - daysAgo * 86_400_000),
        },
      });
    }
    return user.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    boards = app.get(BoardService);
    await wipe();

    // A big senior bank and a small junior one — the shape that makes a points
    // board rank the package instead of the student.
    fields.senior = await track(`Grade 12 Natural ${SFX}`, 12, 20);
    fields.junior = await track(`Grade 6 ${SFX}`, 6, 5);

    // Senior: 10 of 20 = 50%.
    ids.senior = await student(`Senior Half ${SFX}`, fields.senior, 10, null);
    // Junior who opted in: 4 of 5 = 80%. Fewer questions, better student.
    ids.juniorIn = await student(`Junior In ${SFX}`, fields.junior, 4, false);
    // Junior who has never been asked. The one that must not appear.
    ids.juniorSilent = await student(`Junior Silent ${SFX}`, fields.junior, 5, null);
    // Senior who asked to be hidden.
    ids.seniorOut = await student(`Senior Hidden ${SFX}`, fields.senior, 18, true);
    // Beaten a fortnight ago, so the weekly board must not see them.
    ids.seniorStale = await student(`Senior Stale ${SFX}`, fields.senior, 20, null, 14);
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  const names = (rows: { displayName: string }[]): string[] => rows.map((r) => r.displayName);

  /*
   * THE test. A Grade 6 student who has never been asked is on no board at all,
   * and is certainly not on the adult one.
   */
  it('never shows an eleven-year-old on the senior board', async () => {
    const senior = await boards.board(ids.senior!);
    expect(senior.band).toBe('senior');
    expect(names(senior.rows)).not.toContain(`Junior Silent ${SFX}`);
    expect(names(senior.rows)).not.toContain(`Junior In ${SFX}`);
  });

  it('does not list a junior who has not opted in, on their own board either', async () => {
    const junior = await boards.board(ids.juniorIn!);
    expect(junior.band).toBe('junior');
    expect(names(junior.rows)).not.toContain(`Junior Silent ${SFX}`);
    // And the one who did opt in is there.
    expect(names(junior.rows)).toContain(`Junior In ${SFX}`);
  });

  it('still tells the unlisted junior where they stand', async () => {
    const view = await boards.board(ids.juniorSilent!);
    // Hidden from the list, not from themselves — a product that answers "you
    // opted out" when asked "how am I doing" has punished a privacy choice.
    expect(names(view.rows)).not.toContain(`Junior Silent ${SFX}`);
    expect(view.you?.listed).toBe(false);
    expect(view.you?.pct).toBe(100);
    expect(view.you?.rank).toBe(1);
  });

  it('keeps the two bands apart', async () => {
    const junior = await boards.board(ids.juniorIn!);
    /*
     * Asserted as an absence, not as a naming convention.
     *
     * This required every name on the junior board to contain "Junior", which
     * held only while this suite's fixtures were the only students in the
     * database — seeding real Grade 6 personas broke it without touching the
     * behaviour. What the rule actually says is that a senior never appears on
     * a junior board, so that is what is checked.
     */
    expect(names(junior.rows)).not.toContain(`Senior Half ${SFX}`);
    expect(names(junior.rows)).not.toContain(`Senior Stale ${SFX}`);
    expect(names(junior.rows)).toContain(`Junior In ${SFX}`);

    const senior = await boards.board(ids.senior!);
    expect(names(senior.rows)).not.toContain(`Junior In ${SFX}`);
  });

  /*
   * The package-size test. The junior has beaten four questions and the senior
   * ten; ranked by points the senior wins, ranked by coverage the junior does —
   * because 4 of 5 is more of your own exam than 10 of 20.
   */
  it('ranks by percentage of your own track, not by volume', async () => {
    const junior = await boards.board(ids.juniorIn!);
    const row = junior.rows.find((r) => r.displayName === `Junior In ${SFX}`);
    expect(row?.pct).toBe(80);
    expect(row?.beaten).toBe(4);
    expect(row?.total).toBe(5);
  });

  it('hides a student who asked to be hidden, and keeps their rank', async () => {
    const view = await boards.board(ids.seniorOut!);
    expect(names(view.rows)).not.toContain(`Senior Hidden ${SFX}`);
    expect(view.you?.listed).toBe(false);
    expect(view.you?.pct).toBe(90);
  });

  /*
   * The weekly board is the default because an all-time board is decided by
   * January — the top places belong to whoever subscribed first, and nobody
   * joining later can reach them.
   */
  it('leaves last fortnight out of the weekly board', async () => {
    const weekly = await boards.board(ids.senior!);
    expect(weekly.window).toBe('week');
    expect(names(weekly.rows)).not.toContain(`Senior Stale ${SFX}`);
  });

  it('counts them on the all-time board', async () => {
    const all = await boards.board(ids.senior!, 'all');
    expect(all.window).toBe('all');
    expect(names(all.rows)).toContain(`Senior Stale ${SFX}`);
  });

  /*
   * Where you stand when you have beaten nothing.
   *
   * `you` was null for anybody absent from the ranking, and the ranking only
   * ever held students with at least one question beaten — so the screen had no
   * answer for a student who was answering questions and getting them wrong.
   * QA read three accounts in that state and reported that nobody sees their
   * own rank; they were right, and the students it silenced are the ones just
   * starting and the ones struggling.
   *
   * The claim being made is narrow and exactly true: everyone on the board has
   * beaten more than you have. It says nothing about the other students on
   * nothing, who share the place.
   */
  describe('a student who has beaten nothing', () => {
    let novice = '';

    beforeAll(async () => {
      novice = await student(`Senior Novice ${SFX}`, fields.senior!, 0, null);
    });

    it('is still told where they stand', async () => {
      const view = await boards.board(novice);
      expect(view.you).not.toBeNull();
      expect(view.you?.beaten).toBe(0);
      expect(view.you?.pct).toBe(0);
      // The denominator is real even when the numerator is not — it is what
      // makes 0 a position rather than an absence.
      expect(view.you?.total).toBe(20);
    });

    it('is placed after everyone who has beaten something', async () => {
      const view = await boards.board(novice, 'all');
      const last = Math.max(...view.rows.map((r) => r.rank));
      expect(view.you!.rank).toBeGreaterThan(last);
    });

    /*
     * THE guard on the fix. Adding the viewer to their own board would report a
     * different competition to each person looking at it, so the rows must not
     * move — a student who has beaten nothing has done nothing to be listed for.
     */
    it('does not appear on the board, or change it for anybody else', async () => {
      const mine = await boards.board(novice, 'all');
      expect(names(mine.rows)).not.toContain(`Senior Novice ${SFX}`);

      const theirs = await boards.board(ids.senior!, 'all');
      expect(names(theirs.rows)).not.toContain(`Senior Novice ${SFX}`);
      // And every other rank is exactly where it was.
      expect(theirs.rows.map((r) => r.rank)).toEqual(mine.rows.map((r) => r.rank));
    });
  });
});
