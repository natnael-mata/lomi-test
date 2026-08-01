import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { ImportRow } from './csv-schema';
import { mapRow, type MappedRow } from './map-row';
import { parseImportCsv } from './parse-csv';

export interface RowOutcome {
  stableId: string;
  action: 'created' | 'updated' | 'rejected';
  /** Why it was rejected, or what a human should know about how it was read. */
  messages: string[];
}

export interface ImportReport {
  read: number;
  created: number;
  updated: number;
  rejected: number;
  rows: RowOutcome[];
}

/**
 * Turns a CSV of questions into staged drafts.
 *
 * Two invariants this service exists to hold:
 *
 * 1. **It never publishes.** Whatever `status` a file claims, every row lands as
 *    `DRAFT` (T-054). Publishing is the gate's decision and a reviewer's action.
 * 2. **It stages rather than rejects.** A half-finished question is the normal
 *    case here, not an error — CONTENT-PIPELINE.md's whole strategy is to import
 *    everything now and close the gaps in the review queue.
 */
@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(text: string): Promise<ImportReport> {
    return this.importRows(parseImportCsv(text));
  }

  async importRows(rows: ImportRow[]): Promise<ImportReport> {
    const report: ImportReport = {
      read: rows.length,
      created: 0,
      updated: 0,
      rejected: 0,
      rows: [],
    };

    for (const raw of rows) {
      const mapped = mapRow(raw);
      if (!mapped.ok) {
        report.rejected++;
        report.rows.push({
          stableId: mapped.stableId,
          action: 'rejected',
          messages: mapped.reasons,
        });
        continue;
      }
      const outcome = await this.writeRow(mapped.row);
      report[outcome.action === 'created' ? 'created' : 'updated']++;
      report.rows.push(outcome);
    }

    return report;
  }

  private async writeRow(row: MappedRow): Promise<RowOutcome> {
    // Match an existing field by NAME before deriving a slug: slugs are derived,
    // names are what the file wrote, and a derivation that disagrees with an
    // existing row creates a second field with the same name — which happened
    // once already, in T-031, and quietly split a programme's question bank.
    const existingField = await this.prisma.field.findFirst({ where: { name: row.field } });
    const field =
      existingField ??
      (await this.prisma.field.upsert({
        where: { slug: slugify(row.field) },
        update: {},
        // Unknown fields arrive UNPUBLISHED. A field created by an import has
        // never been reviewed by anyone, and publishing is a decision.
        create: { slug: slugify(row.field), name: row.field, isPublished: false },
      }));

    const course = await this.prisma.course.upsert({
      where: { fieldId_slug: { fieldId: field.id, slug: slugify(row.course) } },
      update: {},
      create: { fieldId: field.id, slug: slugify(row.course), name: row.course },
    });

    const topic = await this.prisma.topic.upsert({
      where: { courseId_slug: { courseId: course.id, slug: slugify(row.topic) } },
      update: {},
      create: { courseId: course.id, slug: slugify(row.topic), name: row.topic },
    });

    const data = {
      topicId: topic.id,
      fieldId: field.id,
      qType: row.qType,
      stem: row.stem,
      codeBlock: row.codeBlock,
      explanation: row.explanation,
      timeLimitSec: row.timeLimitSec,
      sourceRef: row.sourceRef,
      year: row.year,
      importFlags: row.flags,
      // T-054: not negotiable, and not conditional on what the file claimed.
      status: 'DRAFT' as const,
    };

    const before = await this.prisma.question.findUnique({
      where: { stableId: row.stableId },
      select: { id: true },
    });

    const question = await this.prisma.question.upsert({
      where: { stableId: row.stableId },
      update: data,
      create: { stableId: row.stableId, ...data },
    });

    // Options are replaced, not merged: the CSV is the source of truth for them,
    // and a merge would leave a deleted distractor in place forever.
    await this.prisma.option.deleteMany({ where: { questionId: question.id } });
    await this.prisma.option.createMany({
      data: row.options.map((o) => ({ questionId: question.id, ...o })),
    });

    return {
      stableId: row.stableId,
      action: before ? 'updated' : 'created',
      messages: row.notes,
    };
  }
}

/**
 * Shared with the seed so both derive the same slug. `&` becomes `and` because
 * "Accounting & Finance" and "Accounting and Finance" must not be two fields.
 */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
