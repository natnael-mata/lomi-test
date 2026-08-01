/**
 * Seeds the worked examples from `docs/question_import_template.csv`.
 *
 * Reads the CSV rather than hard-coding the rows, so "verbatim" is a property of
 * the code and not of my typing. The parser here is deliberately minimal — the
 * real importer, with cleaning passes and per-row reporting, is T-051.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, type QType } from '@prisma/client';

const CSV = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/question_import_template.csv',
);

/** RFC4180-ish: handles quoted fields containing commas, newlines and "". */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rows = parseCsv(readFileSync(CSV, 'utf8'));
  let seeded = 0;

  for (const r of rows) {
    // Match an existing field by NAME before deriving a slug. `slugify` turns
    // "Accounting & Finance" into "accounting-and-finance", but T-030 seeded it
    // as "accounting-finance" — deriving blindly created a second, unpublished
    // Accounting field and hung every AF question off it.
    //
    // Fields not in the launch set are created UNPUBLISHED: Geography is in the
    // template as a `needs_answer` example and must never be served.
    const existing = await prisma.field.findFirst({ where: { name: r.field! } });
    const field =
      existing ??
      (await prisma.field.upsert({
        where: { slug: slugify(r.field!) },
        update: {},
        create: { slug: slugify(r.field!), name: r.field!, isPublished: false },
      }));

    const courseSlug = slugify(r.course || 'unsorted');
    const course = await prisma.course.upsert({
      where: { fieldId_slug: { fieldId: field.id, slug: courseSlug } },
      update: {},
      create: { fieldId: field.id, slug: courseSlug, name: r.course || 'Unsorted' },
    });

    const topicSlug = slugify(r.topic || 'unsorted');
    const topic = await prisma.topic.upsert({
      where: { courseId_slug: { courseId: course.id, slug: topicSlug } },
      update: {},
      create: { courseId: course.id, slug: topicSlug, name: r.topic || 'Unsorted' },
    });

    // D4 pacing budgets. The template has no question-type column, so type is
    // inferred from whether the source supplied worked arithmetic.
    const qType: QType = /VAT liability|How much VAT|excluding VAT|inclusive/i.test(
      r.question_text!,
    )
      ? 'CALCULATION'
      : 'CONCEPT';

    const data = {
      topicId: topic.id,
      fieldId: field.id,
      qType,
      stem: r.question_text!,
      codeBlock: r.code_block || null,
      explanation: r.explanation || null,
      timeLimitSec: qType === 'CALCULATION' ? 180 : 60,
      sourceRef: r.source || null,
      year: r.year ? Number(r.year) : null,
      // Never PUBLISHED from an import, whatever the CSV's `status` says
      // (T-054) — and these rows could not pass the gate anyway: the template
      // carries no per-option why-wrong and no concept line.
      status: 'DRAFT' as const,
    };

    const q = await prisma.question.upsert({
      where: { stableId: r.question_id! },
      update: data,
      create: { stableId: r.question_id!, ...data },
    });

    await prisma.option.deleteMany({ where: { questionId: q.id } });
    for (const label of ['A', 'B', 'C', 'D'] as const) {
      const text = r[`option_${label.toLowerCase()}`];
      if (!text) continue;
      await prisma.option.create({
        data: {
          questionId: q.id,
          label,
          text,
          isCorrect: (r.correct_option || '').trim().toUpperCase() === label,
        },
      });
    }
    seeded++;
  }

  console.log(`seeded ${seeded} sample questions from the import template`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
