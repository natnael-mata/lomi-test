/**
 * Development seed.
 *
 * Idempotent: every row is upserted on its natural key, so running it twice
 * converges rather than duplicating or failing. `npm run db:seed` is expected to
 * be safe to re-run against a database that already has data.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Every programme the product offers, and the school years each one draws on.
 *
 * The taxonomy did not need inventing: **Field is the track**, Course is the
 * subject, and `Field.examDate` already carries the countdown. What changed is
 * that a Field is no longer always a degree.
 *
 * **Grade 12 is two Fields, not one** (T-254). A Natural candidate never sits
 * Geography or History, so a single Grade 12 track would put questions they
 * will never be asked into the denominator of their coverage figure — and a
 * denominator that is wrong is worse than one that is missing, because it looks
 * right. The student cannot detect it and neither can we.
 *
 * `minGrade`/`maxGrade` are **both null for a university exit exam**, which
 * draws on a degree rather than a school year. The importer validates
 * `Question.sourceGrade` against this span (T-253) and the coverage diagnostic
 * reads its column count from it, so it is 4 columns for Grade 12, 2 for Grade
 * 8 and 3 for Grade 6 — a hard-coded four is wrong on three of the four school
 * tracks.
 *
 * The three exit-exam fields are the launch programmes: the only source files
 * that arrived with usable answer keys (CONTENT-PIPELINE.md). Geography,
 * Economics, Biology and Management are deliberately absent — they need answers
 * authored and verified first, and seeding them would imply content that does
 * not exist.
 */
const LAUNCH_FIELDS = [
  // School tracks.
  { slug: 'grade-6', name: 'Grade 6', minGrade: 4, maxGrade: 6 },
  { slug: 'grade-8', name: 'Grade 8', minGrade: 7, maxGrade: 8 },
  { slug: 'grade-12-natural', name: 'Grade 12 Natural', minGrade: 9, maxGrade: 12 },
  { slug: 'grade-12-social', name: 'Grade 12 Social', minGrade: 9, maxGrade: 12 },
  // University exit exams — one per degree subject, no school years.
  { slug: 'computer-science', name: 'Computer Science', minGrade: null, maxGrade: null },
  { slug: 'public-health', name: 'Public Health', minGrade: null, maxGrade: null },
  { slug: 'accounting-finance', name: 'Accounting & Finance', minGrade: null, maxGrade: null },
] as const;

async function main(): Promise<void> {
  for (const f of LAUNCH_FIELDS) {
    await prisma.field.upsert({
      where: { slug: f.slug },
      // The span is corrected on re-run: it is a fact about the track, not a
      // choice an operator makes per environment.
      update: { name: f.name, minGrade: f.minGrade, maxGrade: f.maxGrade },
      // isPublished: true is a DEV convenience so the app has something to show.
      // In production a field is published only after its topics are weighted to
      // 100% (T-024) and it has questions that pass the gate — never by a seed.
      // examDate stays null: no real sitting date has been supplied, and
      // inventing one would put a fabricated countdown on screen.
      create: {
        slug: f.slug,
        name: f.name,
        minGrade: f.minGrade,
        maxGrade: f.maxGrade,
        isPublished: true,
      },
    });
  }

  const published = await prisma.field.count({ where: { isPublished: true } });
  const school = LAUNCH_FIELDS.filter((f) => f.minGrade !== null).length;
  console.log(
    `seeded ${LAUNCH_FIELDS.length} fields — ${school} school tracks, ` +
      `${LAUNCH_FIELDS.length - school} exit exams (${published} published)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
