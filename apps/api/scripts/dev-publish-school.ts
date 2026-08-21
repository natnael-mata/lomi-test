/**
 * Publishes the school-track demo banks (T-261).
 *
 * The four school tracks were seeded with year spans and no questions, so
 * coverage read zero out of zero, the per-grade diagnostic had no rows and the
 * banded leaderboard had nobody to band. This fills two of them — Grade 12
 * Natural and Grade 6 — so every screen the restructure added can be reached.
 *
 * **Not a gate bypass.** Every question goes through `gateBlockers`, the same
 * pure function the publish endpoint runs, so the demo bank cannot contain
 * anything the real bank would refuse. And every `sourceGrade` goes through the
 * same span check the importer applies, because a demo bank that violates the
 * rule it exists to demonstrate is worse than no demo bank.
 *
 *   npm run dev:publish:school -w api
 */
import { PrismaClient, type PrismaClient as Client } from '@prisma/client';

import { gateBlockers, type DraftQuestion } from '../src/questions/publish-gate';
import { SCHOOL_TRACKS, type SchoolTrack } from './dev-school-fixtures';

const prisma = new PrismaClient();

/**
 * A sitting date, so the countdown and the daily target have something to work
 * from.
 *
 * **Invented, and only ever set on a demo track.** `examDate` drives a countdown
 * a student plans around, so putting a fabricated one on a real programme would
 * be the product asserting a fact it does not have — the launch fields keep
 * theirs null until a real date is supplied.
 *
 * Fixed distances rather than a real calendar date: this script is re-run, and
 * a hard-coded date that drifts into the past turns `perDay` into "everything
 * that is left" and makes the demo look broken.
 */
function examDateFor(track: SchoolTrack): Date {
  const days = track.fieldSlug === 'grade-6' ? 60 : 120;
  return new Date(Date.now() + days * 86_400_000);
}

async function publishTrack(track: SchoolTrack): Promise<{ published: number; refused: number }> {
  const field = await prisma.field.upsert({
    where: { slug: track.fieldSlug },
    update: {
      minGrade: track.minGrade,
      maxGrade: track.maxGrade,
      isPublished: true,
      examDate: examDateFor(track),
    },
    create: {
      slug: track.fieldSlug,
      name: track.fieldName,
      minGrade: track.minGrade,
      maxGrade: track.maxGrade,
      isPublished: true,
      examDate: examDateFor(track),
    },
  });

  const topicIds = new Map<string, string>();
  for (const spec of track.topics) {
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

  const stated = track.topics.reduce((sum, t) => sum + t.weightPct, 0);
  if (stated !== 100) {
    console.error(`${track.fieldName}: topic weights sum to ${stated}, not 100.`);
    process.exitCode = 1;
  }

  let published = 0;
  let refused = 0;

  for (const fixture of track.fixtures) {
    const topicId = topicIds.get(fixture.topic);
    if (!topicId) {
      console.error(`${fixture.stableId}: no topic "${fixture.topic}".`);
      refused++;
      continue;
    }

    /*
     * The same span check the importer runs (T-253).
     *
     * A demo bank that files a Grade 8 question under Grade 6 would corrupt the
     * very diagnostic it exists to show off, and would do it invisibly.
     */
    if (fixture.sourceGrade < track.minGrade || fixture.sourceGrade > track.maxGrade) {
      console.error(
        `${fixture.stableId}: sourceGrade ${fixture.sourceGrade} is outside ` +
          `${track.fieldName} (${track.minGrade}–${track.maxGrade}).`,
      );
      refused++;
      continue;
    }

    const data = {
      topicId,
      fieldId: field.id,
      sourceGrade: fixture.sourceGrade,
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

    const fresh = await prisma.question.findUniqueOrThrow({
      where: { id: question.id },
      include: { options: { orderBy: { label: 'asc' } }, steps: true, topic: true },
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

  return { published, refused };
}

async function main(): Promise<void> {
  let refusedTotal = 0;

  for (const track of SCHOOL_TRACKS) {
    const { published, refused } = await publishTrack(track);
    refusedTotal += refused;

    const grades = [...new Set(track.fixtures.map((f) => f.sourceGrade))].sort((a, b) => a - b);
    console.log(
      `\n${published} question(s) published in "${track.fieldName}" ` +
        `(grades ${track.minGrade}–${track.maxGrade}).`,
    );
    console.log(`  years covered: ${grades.join(', ')}`);
    for (const t of track.topics) {
      const n = track.fixtures.filter((f) => f.topic === t.slug).length;
      console.log(`  ${t.name.padEnd(22)} ${String(n).padStart(2)} questions · ${t.weightPct}%`);
    }
  }

  if (refusedTotal > 0) {
    console.log(`\n${refusedTotal} refused — the gate is the same one the API runs.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => (prisma as Client).$disconnect());
