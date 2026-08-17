/**
 * Creates published questions for local development.
 *
 * The seed leaves every imported question `DRAFT`, which is correct — nothing is
 * servable until a human has reviewed it — so a fresh database has an empty
 * practice screen. This builds a **separate local-only field** with its own
 * questions and publishes them.
 *
 * It deliberately does NOT touch the seeded template questions. An earlier
 * version did, and it was wrong twice over: it left them PUBLISHED with fixture
 * text where tests expect DRAFT with the CSV's own text, and re-importing the
 * template then saw that fixture text as a content change and demoted them to
 * IN_REVIEW — T-054 working exactly as designed, against data that had no
 * business being edited. Local convenience must not mutate shared fixtures.
 *
 * It is **not a gate bypass**: every question goes through `gateBlockers`, the
 * same pure function the publish endpoint runs, and is refused if it does not
 * genuinely pass.
 *
 * The bank itself lives in `dev-fixtures.ts` — four weighted topics and twenty
 * questions, which is the smallest bank that can demonstrate the product: ten
 * distinct questions is the free wall, four topics is a readiness table with
 * something in it, and twenty is enough to sample a short mock from.
 *
 *   npm run dev:publish -w api
 */
import { PrismaClient } from '@prisma/client';

import { FIXTURES, TOPICS } from './dev-fixtures';
import { isDevTelegramId } from '../src/auth/dev-login';
import { DEV_SESSION_TELEGRAM_ID } from './dev-accounts';
import { gateBlockers, type DraftQuestion } from '../src/questions/publish-gate';

const prisma = new PrismaClient();

/** Everything this script owns is under this slug and nothing else is. */
const FIELD_SLUG = 'local-dev';

/**
 * Removes demo content this script no longer owns.
 *
 * **Without this the field's weights stop summing to 100.** An earlier version
 * of the demo bank was one topic at 100%; the four topics here are 30/25/25/20,
 * and leaving the old one behind makes 200 — which fails the taxonomy check, so
 * no mock paper can be built and the failure reads as a product bug rather than
 * as a stale fixture.
 *
 * Only inside `local-dev`, and only for accounts in the smoke-test range. If a
 * real attempt ever pointed at one of these questions the script leaves it
 * alone and says so: local convenience does not get to delete somebody's
 * history, even history that looks like a fixture's.
 */
async function removeSupersededContent(fieldId: string, keepTopics: Set<string>): Promise<void> {
  const keepIds = new Set(FIXTURES.map((f) => f.stableId));

  const stale = await prisma.question.findMany({
    where: { fieldId, stableId: { notIn: [...keepIds] } },
    select: { id: true, stableId: true },
  });

  for (const question of stale) {
    const attempts = await prisma.attempt.findMany({
      where: { questionId: question.id },
      select: { id: true, user: { select: { telegramId: true } } },
    });
    // `dev:session` signs in as a fixture account whose telegram id is a
    // string, so `isDevTelegramId` — which is about the reserved *numeric*
    // range — correctly says no. It is still a fixture account, and treating it
    // as a real student would leave this content uncleanable forever.
    const real = attempts.filter(
      (a) => !isDevTelegramId(a.user.telegramId) && a.user.telegramId !== DEV_SESSION_TELEGRAM_ID,
    );
    if (real.length > 0) {
      console.log(
        `${question.stableId}: kept — ${real.length} attempt(s) from outside the smoke-test range.`,
      );
      continue;
    }

    await prisma.attempt.deleteMany({ where: { questionId: question.id } });
    await prisma.examQuestion.deleteMany({ where: { questionId: question.id } });
    await prisma.step.deleteMany({ where: { questionId: question.id } });
    await prisma.option.deleteMany({ where: { questionId: question.id } });
    await prisma.question.delete({ where: { id: question.id } });
    console.log(`${question.stableId}: removed — superseded by the current demo bank.`);
  }

  // Topics and courses left holding nothing. Deleted last, and only when empty,
  // so a topic that kept a question above keeps its topic too.
  const topics = await prisma.topic.findMany({
    where: { course: { fieldId } },
    select: { id: true, slug: true, _count: { select: { questions: true } } },
  });
  for (const topic of topics) {
    if (keepTopics.has(topic.id) || topic._count.questions > 0) continue;
    await prisma.topic.delete({ where: { id: topic.id } });
    console.log(`topic "${topic.slug}": removed — no questions left in it.`);
  }
  const courses = await prisma.course.findMany({
    where: { fieldId },
    select: { id: true, slug: true, _count: { select: { topics: true } } },
  });
  for (const course of courses) {
    if (course._count.topics > 0) continue;
    await prisma.course.delete({ where: { id: course.id } });
    console.log(`course "${course.slug}": removed — no topics left in it.`);
  }
}

async function main(): Promise<void> {
  const field = await prisma.field.upsert({
    where: { slug: FIELD_SLUG },
    update: { isPublished: true },
    create: { slug: FIELD_SLUG, name: 'Local Dev', isPublished: true },
  });

  /*
   * One course per topic rather than one course holding all four.
   *
   * The taxonomy is Field → Course → Topic and the demo topics come from four
   * different subjects; hanging Depreciation under a course called "Local Dev
   * Course" would make every screen that names the course say something false.
   */
  const topicIds = new Map<string, string>();
  for (const spec of TOPICS) {
    const course = await prisma.course.upsert({
      where: { fieldId_slug: { fieldId: field.id, slug: `${spec.slug}-course` } },
      update: { name: spec.course },
      create: { fieldId: field.id, slug: `${spec.slug}-course`, name: spec.course },
    });
    const topic = await prisma.topic.upsert({
      where: { courseId_slug: { courseId: course.id, slug: spec.slug } },
      update: { name: spec.name, weightPct: spec.weightPct },
      create: {
        courseId: course.id,
        slug: spec.slug,
        name: spec.name,
        weightPct: spec.weightPct,
      },
    });
    topicIds.set(spec.slug, topic.id);
  }

  await removeSupersededContent(field.id, new Set(topicIds.values()));

  const stated = TOPICS.reduce((sum, t) => sum + t.weightPct, 0);
  if (stated !== 100) {
    // The exam builder samples against these and the readiness screen ranks by
    // them. A set that does not sum to 100 produces a paper with a hole in it
    // and a progress screen whose bars do not add up — both of which look like
    // product bugs rather than like a bad fixture file.
    console.error(`Topic weights sum to ${stated}, not 100. Fix dev-fixtures.ts.`);
    process.exitCode = 1;
    return;
  }

  let published = 0;
  let refused = 0;

  for (const fixture of FIXTURES) {
    const topicId = topicIds.get(fixture.topic);
    if (!topicId) {
      console.error(`${fixture.stableId}: no topic "${fixture.topic}" in TOPICS.`);
      refused++;
      continue;
    }

    const data = {
      topicId,
      fieldId: field.id,
      qType: fixture.qType,
      stem: fixture.stem,
      codeBlock: fixture.codeBlock ?? null,
      conceptLine: fixture.conceptLine,
      explanation: fixture.explanation ?? null,
      timeLimitSec: fixture.timeLimitSec,
      authorId: 'dev-fixture-author',
      status: 'DRAFT' as const,
    };

    const question = await prisma.question.upsert({
      where: { stableId: fixture.stableId },
      update: data,
      create: { stableId: fixture.stableId, ...data },
    });

    await prisma.option.deleteMany({ where: { questionId: question.id } });
    await prisma.option.createMany({
      data: fixture.options.map((o) => ({
        questionId: question.id,
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect ?? false,
        whyWrong: o.whyWrong ?? null,
      })),
    });

    await prisma.step.deleteMany({ where: { questionId: question.id } });
    if (fixture.steps) {
      await prisma.step.createMany({
        data: fixture.steps.map((s) => ({
          questionId: question.id,
          stepNo: s.stepNo,
          text: s.text,
          formula: s.formula ?? null,
        })),
      });
    }

    const fresh = await prisma.question.findUniqueOrThrow({
      where: { id: question.id },
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
        topic: true,
      },
    });

    const draft: DraftQuestion = {
      qType: fresh.qType,
      stem: fresh.stem,
      conceptLine: fresh.conceptLine,
      explanation: fresh.explanation,
      timeLimitSec: fresh.timeLimitSec,
      authorId: fresh.authorId,
      reviewerId: 'dev-publish-script',
      topic: { name: fresh.topic.name, weightPct: fresh.topic.weightPct?.toNumber() ?? null },
      steps: fresh.steps.map((s) => ({ stepNo: s.stepNo, text: s.text, formula: s.formula })),
      options: fresh.options.map((o) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect,
        whyWrong: o.whyWrong,
      })),
    };

    const blockers = gateBlockers(draft);
    if (blockers.length > 0) {
      console.log(`${fixture.stableId}: REFUSED by the gate —`);
      for (const b of blockers) console.log(`    ${b}`);
      refused++;
      continue;
    }

    await prisma.question.update({
      where: { id: fresh.id },
      data: { status: 'PUBLISHED', reviewerId: 'dev-publish-script' },
    });
    published++;
  }

  const byTopic = TOPICS.map((t) => {
    const count = FIXTURES.filter((f) => f.topic === t.slug).length;
    return `  ${t.name.padEnd(26)} ${String(count).padStart(2)} questions · ${t.weightPct}%`;
  }).join('\n');

  console.log(`\n${published} question(s) published in "${field.name}" (${FIELD_SLUG}).`);
  console.log(byTopic);
  if (refused > 0) {
    console.log(`\n${refused} refused — see above. The gate is the same one the API runs.`);
    process.exitCode = 1;
  }
  console.log(`\nSet up the test accounts next:  npm run dev:testers -w api`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
