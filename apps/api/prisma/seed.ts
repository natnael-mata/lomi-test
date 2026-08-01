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
 * The three launch programmes — the only source files that arrived with usable
 * answer keys (CONTENT-PIPELINE.md). Geography, Economics, Exit-2015, Biology
 * and Management are deliberately absent: they need answers authored and
 * verified first, and seeding them would imply content that does not exist.
 */
const LAUNCH_FIELDS = [
  { slug: 'computer-science', name: 'Computer Science' },
  { slug: 'public-health', name: 'Public Health' },
  { slug: 'accounting-finance', name: 'Accounting & Finance' },
] as const;

async function main(): Promise<void> {
  for (const f of LAUNCH_FIELDS) {
    await prisma.field.upsert({
      where: { slug: f.slug },
      update: { name: f.name },
      // isPublished: true is a DEV convenience so the app has something to show.
      // In production a field is published only after its topics are weighted to
      // 100% (T-024) and it has questions that pass the gate — never by a seed.
      // examDate stays null: no real sitting date has been supplied, and
      // inventing one would put a fabricated countdown on screen.
      create: { slug: f.slug, name: f.name, isPublished: true },
    });
  }

  const published = await prisma.field.count({ where: { isPublished: true } });
  console.log(`seeded ${LAUNCH_FIELDS.length} launch fields (${published} published)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
