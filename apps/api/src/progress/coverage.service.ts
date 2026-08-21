/**
 * Coverage: of the questions in your track, how many have you beaten (T-256).
 *
 * **The headline figure of the product**, replacing the weighted mean. The
 * arithmetic lives in `coverage.ts`; this is the part that has to talk to the
 * database, and the only interesting decisions here are about what gets
 * counted.
 *
 * Two of them are load-bearing.
 *
 * **Beaten means correct AND the reason named** (T-255). A count of correct
 * answers would be a count that includes guesses, and the Ethiopian exam is
 * drawn from a bank — a student who memorises the letter passes the app and
 * fails the paper. Telling somebody they are 80% ready when they are not is the
 * most damaging thing this product could do, so the definition is enforced in
 * the query rather than left to a caller.
 *
 * **Only published questions are in the denominator.** A draft is not something
 * a student can be asked, so counting it would make coverage fall whenever
 * content is uploaded — the student would watch their progress drop for reasons
 * that have nothing to do with them.
 */
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { COVERAGE_TARGET_PCT, coveragePct, daysUntil, planFor } from './coverage';

/** One row of a breakdown. Absent from the list is different from zero. */
export interface CoverageSlice {
  key: string;
  label: string;
  total: number;
  beaten: number;
  pct: number;
}

export interface CoverageView {
  fieldId: string;
  fieldName: string;
  total: number;
  beaten: number;
  pct: number;
  targetPct: number;
  targetCount: number;
  toTarget: number;
  /** Null when no exam date is set — rendered as unavailable, never as zero. */
  daysToExam: number | null;
  perDay: number | null;
  /**
   * The school years this track draws on, or null for a university exit exam.
   *
   * Sent so the client does not hard-code four columns: it is 4 for Grade 12,
   * 2 for Grade 8 and 3 for Grade 6, and a fixed grid is wrong on three of the
   * four school tracks.
   */
  years: { min: number; max: number } | null;
  bySubject: CoverageSlice[];
  byGrade: CoverageSlice[];
}

@Injectable()
export class CoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async forField(userId: string, fieldId: string, now: Date = new Date()): Promise<CoverageView> {
    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: { id: true, name: true, examDate: true, minGrade: true, maxGrade: true },
    });
    if (!field) throw new NotFoundException('No such programme.');

    /*
     * Every published question in the track, with the two things a breakdown
     * groups by. One read rather than three grouped queries: the totals and
     * both breakdowns have to agree with each other, and three queries against
     * a table being written to can disagree.
     */
    const questions = await this.prisma.question.findMany({
      where: { fieldId, status: 'PUBLISHED' },
      select: {
        id: true,
        sourceGrade: true,
        topic: { select: { course: { select: { id: true, name: true } } } },
      },
    });

    const beatenRows = await this.prisma.attempt.findMany({
      where: { userId, fieldId, isCorrect: true, reasonCorrect: true },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    const beatenIds = new Set(beatenRows.map((a) => a.questionId));

    const bySubject = new Map<string, CoverageSlice>();
    const byGrade = new Map<string, CoverageSlice>();

    for (const q of questions) {
      const course = q.topic.course;
      const subject = bySubject.get(course.id) ?? {
        key: course.id,
        label: course.name,
        total: 0,
        beaten: 0,
        pct: 0,
      };
      subject.total++;
      if (beatenIds.has(q.id)) subject.beaten++;
      bySubject.set(course.id, subject);

      /*
       * Questions with no grade are counted in the total and left out of the
       * per-year breakdown.
       *
       * They are real questions in the track and a student will be asked them,
       * so removing them from the denominator would flatter the headline. But
       * they belong to no year, and inventing one — or bucketing them as
       * "unknown" beside Grade 9 — would put a row on the diagnostic that names
       * no textbook, which is the whole point of the diagnostic.
       */
      if (q.sourceGrade === null) continue;
      const key = String(q.sourceGrade);
      const grade = byGrade.get(key) ?? {
        key,
        label: `Grade ${q.sourceGrade}`,
        total: 0,
        beaten: 0,
        pct: 0,
      };
      grade.total++;
      if (beatenIds.has(q.id)) grade.beaten++;
      byGrade.set(key, grade);
    }

    const total = questions.length;
    // `beatenIds` can hold questions that have since been retired or moved, so
    // the headline counts the intersection rather than the set's size.
    const beaten = questions.filter((q) => beatenIds.has(q.id)).length;
    const daysToExam = daysUntil(field.examDate, now);
    const plan = planFor(total, beaten, daysToExam);

    const withPct = (slices: CoverageSlice[]): CoverageSlice[] =>
      slices.map((s) => ({ ...s, pct: coveragePct(s.total, s.beaten) }));

    return {
      fieldId: field.id,
      fieldName: field.name,
      total,
      beaten,
      pct: coveragePct(total, beaten),
      targetPct: COVERAGE_TARGET_PCT,
      targetCount: plan.targetCount,
      toTarget: plan.toTarget,
      daysToExam,
      perDay: plan.perDay,
      years:
        field.minGrade !== null && field.maxGrade !== null
          ? { min: field.minGrade, max: field.maxGrade }
          : null,
      // Weakest first: this list is read to decide what to do next, and the
      // thing to do next is at the top.
      bySubject: withPct([...bySubject.values()]).sort((a, b) => a.pct - b.pct),
      // By year, ascending. This one is a diagnostic, not a to-do list — the
      // question it answers is "which year is holding me back", and years out of
      // order make that harder to see.
      byGrade: withPct([...byGrade.values()]).sort((a, b) => Number(a.key) - Number(b.key)),
    };
  }
}
