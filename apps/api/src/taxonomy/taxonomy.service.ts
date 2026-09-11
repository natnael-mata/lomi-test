import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertWeightsSumTo100 } from './weights';

/**
 * How far ahead a sitting may be set.
 *
 * Not a rule about exams so much as a guard against a typo: `2027` typed where
 * `2026` was meant produces a countdown that quietly divides the whole bank
 * over four hundred days and tells every student in the programme to answer one
 * question a day. Five years is far past any real sitting and still catches the
 * mistakes that matter.
 */
const MAX_YEARS_AHEAD = 5;

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Sets — or clears — the date a programme's exam is sat (T-269).
   *
   * **Nothing could write this column.** `Field.examDate` has existed since the
   * schema was written, `daysUntil` computes from it, `planFor` turns it into
   * "answer this many a day", and the landing page sells that as step three of
   * four: "the app works out how many a day you need to reach 80% before your
   * exam, and recalculates it every morning". With no way to set the date, that
   * promise resolved to `/progress` saying "No exam date is set yet, so there
   * is no daily target to work out" — forever, for every programme.
   *
   * It belongs to the field rather than the student because it is the national
   * sitting: one date for everybody in the programme, and not a thing a student
   * should be able to move.
   *
   * `null` clears it, which has to stay possible — a date entered against the
   * wrong programme is worse than no date, since the daily target it produces
   * looks authoritative.
   */
  async setExamDate(
    fieldId: string,
    raw: unknown,
    actorId: string,
    now: Date = new Date(),
  ): Promise<{ examDate: string | null }> {
    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: { id: true, name: true },
    });
    if (!field) throw new NotFoundException('No such programme.');

    let examDate: Date | null = null;
    if (raw !== null && raw !== '') {
      if (typeof raw !== 'string') {
        throw new BadRequestException({
          error: 'BAD_DATE',
          message: 'Send the exam date as YYYY-MM-DD, or null to clear it.',
        });
      }
      // Parsed as a plain calendar day at UTC midnight. A sitting is a date,
      // not an instant, and letting a timezone shift it is how a countdown ends
      // up a day out for half the country.
      const parsed = new Date(`${raw.slice(0, 10)}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException({
          error: 'BAD_DATE',
          message: 'That is not a date we can read. Use YYYY-MM-DD.',
        });
      }
      const ceiling = new Date(now);
      ceiling.setUTCFullYear(ceiling.getUTCFullYear() + MAX_YEARS_AHEAD);
      if (parsed.getTime() > ceiling.getTime()) {
        throw new BadRequestException({
          error: 'BAD_DATE',
          message: `That date is more than ${MAX_YEARS_AHEAD} years away. Check the year.`,
        });
      }
      examDate = parsed;
    }

    await this.prisma.field.update({ where: { id: fieldId }, data: { examDate } });

    // The actor comes from the session, never the body — the same rule the
    // weights overrides follow, and for the same reason: a record that lets a
    // client name its own actor is worthless when somebody asks who set this.
    await this.audit.recordAction({
      actorId,
      action: 'EXAM_DATE_SET',
      entity: 'field',
      entityId: fieldId,
      reference: field.name,
      detail: examDate === null ? 'cleared' : examDate.toISOString().slice(0, 10),
    });

    return { examDate: examDate === null ? null : examDate.toISOString() };
  }

  /**
   * Throws unless every topic in the field is weighted and the weights sum to
   * exactly 100.00%. Called before a field may be published — an unweighted or
   * mis-weighted field would make readiness and exam sampling silently wrong.
   */
  async assertFieldWeightsSumTo100(fieldId: string): Promise<void> {
    const topics = await this.prisma.topic.findMany({
      where: { course: { fieldId } },
      select: { name: true, weightPct: true },
    });

    assertWeightsSumTo100(
      // Prisma returns Decimal; toNumber() is safe at numeric(5,2), and the
      // assertion re-quantises to integer hundredths anyway.
      topics.map((t) => ({ name: t.name, weightPct: t.weightPct?.toNumber() ?? null })),
    );
  }
}
