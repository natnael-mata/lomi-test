import { Injectable } from '@nestjs/common';
import type { OptionLabel, QStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { mapRow, type MappedRow } from './map-row';
import { parseImportCsv, type ParsedRow } from './parse-csv';

interface ExistingOption {
  label: OptionLabel;
  text: string;
  isCorrect: boolean;
  whyWrong: string | null;
}

/** The fields of an existing question an import needs in order to decide safely. */
interface ExistingQuestion {
  id: string;
  status: QStatus;
  stem: string;
  explanation: string | null;
  codeBlock: string | null;
  options: ExistingOption[];
}

export interface RowOutcome {
  stableId: string;
  /** The line of the source file this came from — how a person finds it again. */
  line: number;
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

  async importRows(rows: ParsedRow[]): Promise<ImportReport> {
    const report: ImportReport = {
      read: rows.length,
      created: 0,
      updated: 0,
      rejected: 0,
      rows: [],
    };

    for (const { row: raw, line } of rows) {
      const mapped = mapRow(raw);
      if (!mapped.ok) {
        report.rejected++;
        report.rows.push({
          stableId: mapped.stableId,
          line,
          action: 'rejected',
          messages: mapped.reasons,
        });
        continue;
      }
      const outcome = await this.writeRow(mapped.row, line);
      report[outcome.action === 'created' ? 'created' : 'updated']++;
      report.rows.push(outcome);
    }

    return report;
  }

  private async writeRow(row: MappedRow, line: number): Promise<RowOutcome> {
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
      difficulty: row.difficulty,
      sourceRef: row.sourceRef,
      year: row.year,
      importFlags: row.flags,
    };

    // `timeLimitSec` is set on CREATE only, deliberately.
    //
    // It is inferred from the question type here, but a reviewer may deliberately
    // change it (15..600) — and it used to be in `data`, so every re-import
    // silently reverted their judgement. That is the same class of destruction
    // `syncOptions` goes out of its way to avoid with `whyWrong`, and it matters
    // more once papers exist: a frozen exam's budget would change between import
    // runs with nobody touching the exam.
    const timeLimitOnCreate = { timeLimitSec: row.timeLimitSec };

    const before = await this.prisma.question.findUnique({
      where: { stableId: row.stableId },
      select: {
        id: true,
        status: true,
        stem: true,
        explanation: true,
        codeBlock: true,
        options: { select: { label: true, text: true, isCorrect: true, whyWrong: true } },
      },
    });

    const messages = [...row.notes];
    const question = await this.prisma.question.upsert({
      where: { stableId: row.stableId },
      // On update, `status` is absent — see `nextStatus`.
      update: { ...data, ...this.nextStatus(before, row, messages) },
      // T-054: a new row is always a DRAFT, whatever the file claimed.
      create: { stableId: row.stableId, ...data, ...timeLimitOnCreate, status: 'DRAFT' },
    });

    await this.syncOptions(question.id, row, before?.options ?? [], messages);

    return {
      stableId: row.stableId,
      line,
      action: before ? 'updated' : 'created',
      messages,
    };
  }

  /**
   * Brings a question's options in line with the file — without throwing away
   * what a reviewer added.
   *
   * Delete-all-and-recreate is the obvious implementation and it is destructive:
   * `whyWrong` is authored in the review queue, exists in no CSV column, and is
   * required by the publish gate. Wiping it on every re-import means a reviewed
   * question quietly becomes unpublishable again, and the person who wrote those
   * lines has to write them a second time.
   *
   * So each option is matched by label and its `whyWrong` kept — unless the
   * option's own text changed, in which case the old reasoning is about a
   * different sentence and keeping it would be worse than losing it.
   */
  private async syncOptions(
    questionId: string,
    row: MappedRow,
    existing: readonly ExistingOption[],
    messages: string[],
  ): Promise<void> {
    const byLabel = new Map(existing.map((o) => [o.label, o]));
    const incoming = new Set(row.options.map((o) => o.label));

    for (const option of row.options) {
      const prev = byLabel.get(option.label);
      const staleReasoning = prev != null && prev.whyWrong != null && prev.text !== option.text;
      if (staleReasoning) {
        messages.push(`option ${option.label} was reworded — its why-wrong note was cleared`);
      }

      await this.prisma.option.upsert({
        where: { questionId_label: { questionId, label: option.label } },
        update: {
          text: option.text,
          isCorrect: option.isCorrect,
          ...(staleReasoning ? { whyWrong: null } : {}),
        },
        create: { questionId, ...option },
      });
    }

    // A distractor dropped from the file is dropped here too — otherwise a
    // removed wrong answer would keep being shown forever.
    const removed = existing.filter((o) => !incoming.has(o.label)).map((o) => o.label);
    if (removed.length > 0) {
      await this.prisma.option.deleteMany({ where: { questionId, label: { in: removed } } });
      messages.push(`option(s) ${removed.join(', ')} no longer in the file — removed`);
    }
  }

  /**
   * What an import may do to a question's lifecycle: as little as possible.
   *
   * The importer does not decide what students see — that is the publish gate's
   * job and a reviewer's action (T-054). Two failures follow from forgetting it,
   * and the obvious implementation (`status: 'DRAFT'` on both branches) commits
   * the second one:
   *
   * - **Promotion.** A file saying `ready` must never become PUBLISHED.
   * - **Demotion.** Re-running an import must not knock a reviewed, published
   *   question back to DRAFT. That silently withdraws working content, and it
   *   happens on the most routine action there is — re-importing a corrected file.
   *
   * The exception is real content change. If the source file now says something
   * different, what is published no longer matches what was reviewed, so the
   * question goes to IN_REVIEW: it stops being served, and it lands in the queue
   * with the reason attached, rather than a student reading an unreviewed edit.
   */
  private nextStatus(
    before: ExistingQuestion | null,
    row: MappedRow,
    messages: string[],
  ): { status?: QStatus } {
    if (!before) return {};

    const changed =
      before.stem !== row.stem ||
      before.explanation !== row.explanation ||
      before.codeBlock !== row.codeBlock ||
      // Options count as the question changing. A published question whose
      // answer key moved is the worst version of this: it would go on being
      // served while marking students wrong for the answer it used to accept.
      optionsDiffer(before.options, row.options);

    if (before.status === 'PUBLISHED' && changed) {
      messages.push('published question changed by the import — sent back to review');
      return { status: 'IN_REVIEW' };
    }

    // Unchanged, or not published: leave the lifecycle exactly where the humans
    // left it. Notably a RETIRED question stays retired — an import is not an
    // argument for bringing a withdrawn question back.
    return {};
  }
}

/** Whether the file's options say anything different from the stored ones. */
function optionsDiffer(
  stored: readonly ExistingOption[],
  incoming: readonly MappedRow['options'][number][],
): boolean {
  if (stored.length !== incoming.length) return true;
  const byLabel = new Map(stored.map((o) => [o.label, o]));
  return incoming.some((o) => {
    const prev = byLabel.get(o.label);
    return prev == null || prev.text !== o.text || prev.isCorrect !== o.isCorrect;
  });
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
