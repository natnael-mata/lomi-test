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
 *   npm run dev:publish -w api
 */
import { PrismaClient } from '@prisma/client';

import { gateBlockers, type DraftQuestion } from '../src/questions/publish-gate';

const prisma = new PrismaClient();

/** Everything this script owns is under this slug and nothing else is. */
const FIELD_SLUG = 'local-dev';

interface Fixture {
  stableId: string;
  qType: 'CONCEPT' | 'CALCULATION';
  stem: string;
  codeBlock?: string;
  conceptLine: string;
  explanation?: string;
  timeLimitSec: number;
  options: { label: 'A' | 'B' | 'C' | 'D'; text: string; isCorrect?: boolean; whyWrong?: string }[];
  steps?: { stepNo: number; text: string; formula?: string }[];
}

const FIXTURES: Fixture[] = [
  {
    stableId: 'DEV-CALC-1',
    qType: 'CALCULATION',
    stem: 'A retailer sells goods for Br 1,150,000 VAT inclusive (15%). How much VAT is contained in that amount?',
    conceptLine: 'VAT inside a gross amount is extracted with ×15/115.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: '172,500',
        whyWrong: 'That is 15% of the net amount, not the tax inside the gross.',
      },
      { label: 'B', text: '150,000', isCorrect: true },
      { label: 'C', text: '15,000', whyWrong: 'Off by a factor of ten.' },
      { label: 'D', text: '1,000,000', whyWrong: 'That is the net amount, not the VAT.' },
    ],
    steps: [
      { stepNo: 1, text: 'The amount is VAT-inclusive, so the tax is already inside it.' },
      { stepNo: 2, text: 'Extract the tax fraction.', formula: 'gross × 15/115' },
      { stepNo: 3, text: '1,150,000 × 15/115' },
      { stepNo: 4, text: '= 150,000 → answer B' },
    ],
  },
  {
    stableId: 'DEV-CONCEPT-1',
    qType: 'CONCEPT',
    stem: 'To ensure every household in a village has an equal chance of being selected for a survey, you would use:',
    conceptLine: 'Equal probability for every unit is simple random sampling.',
    explanation: 'Only simple random sampling gives every household the same chance of selection.',
    timeLimitSec: 60,
    options: [
      {
        label: 'A',
        text: 'Purposive sampling',
        whyWrong: 'Picks units deliberately, not by chance.',
      },
      {
        label: 'B',
        text: 'Snowball sampling',
        whyWrong: 'Recruits through referral, so chances are unequal.',
      },
      { label: 'C', text: 'Simple random sampling', isCorrect: true },
      {
        label: 'D',
        text: 'Convenience sampling',
        whyWrong: 'Takes whoever happens to be reachable.',
      },
    ],
  },
  {
    stableId: 'DEV-CODE-1',
    qType: 'CONCEPT',
    stem: 'What problem does this CSS solve when creating a navigation bar?',
    codeBlock: 'nav ul { list-style-type: none; margin: 0; padding: 0; }',
    conceptLine: 'Lists carry default bullets and spacing that a navbar must clear first.',
    explanation:
      'Removing the marker and the default margin and padding lets the list be laid out freely.',
    timeLimitSec: 60,
    options: [
      {
        label: 'A',
        text: 'Removes bullet points and default spacing, allowing custom layout',
        isCorrect: true,
      },
      {
        label: 'B',
        text: 'Aligns the navbar to the right of the page',
        whyWrong: 'Alignment is a layout property; none is set here.',
      },
      {
        label: 'C',
        text: 'Adds hover effects to list items',
        whyWrong: 'No :hover rule is present.',
      },
      {
        label: 'D',
        text: 'Converts the list into a dropdown menu',
        whyWrong: 'Nothing here changes visibility or positioning.',
      },
    ],
  },
];

async function main(): Promise<void> {
  const field = await prisma.field.upsert({
    where: { slug: FIELD_SLUG },
    update: { isPublished: true },
    create: { slug: FIELD_SLUG, name: 'Local Dev', isPublished: true },
  });
  const course = await prisma.course.upsert({
    where: { fieldId_slug: { fieldId: field.id, slug: 'local-dev-course' } },
    update: {},
    create: { fieldId: field.id, slug: 'local-dev-course', name: 'Local Dev Course' },
  });
  const topic = await prisma.topic.upsert({
    where: { courseId_slug: { courseId: course.id, slug: 'local-dev-topic' } },
    update: { weightPct: 100 },
    create: {
      courseId: course.id,
      slug: 'local-dev-topic',
      name: 'Local Dev Topic',
      weightPct: 100,
    },
  });

  let published = 0;

  for (const fixture of FIXTURES) {
    const data = {
      topicId: topic.id,
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
      continue;
    }

    await prisma.question.update({
      where: { id: fresh.id },
      data: { status: 'PUBLISHED', reviewerId: 'dev-publish-script' },
    });
    console.log(`${fixture.stableId}: published (${fresh.qType})`);
    published++;
  }

  console.log(`\n${published} question(s) published in "${field.name}" (${FIELD_SLUG}).`);
  console.log(`Point a dev session at it:  npm run dev:session -w api -- ${FIELD_SLUG}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
