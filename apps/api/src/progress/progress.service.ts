import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WeightsService } from '../taxonomy/weights.service';
import { buildReadiness, type AnsweredQuestion, type Readiness } from './readiness';
import { labelSittings, type SittingPoint } from './trend';

export interface ReadinessView extends Readiness {
  fieldId: string;
  fieldName: string;
  /**
   * The topic to practise next, or `null` when there is nothing to say.
   *
   * Lifted out of `focus` so a client does not have to know the ordering rule to
   * build the CTA every analytics view ends with (T-139).
   */
  practiceNext: { topicId: string; topicName: string } | null;
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weights: WeightsService,
  ) {}

  /**
   * A student's readiness in a field (T-135, T-136, T-137).
   *
   * Evidence is **every answer they have given in the field**, practice and mock
   * alike, reduced to one row per question at its most recent answer. Practice
   * and exam answers count the same because the question is the same question —
   * splitting them would mean two readiness figures that disagree, and a student
   * asking which one is real.
   */
  async readiness(userId: string, fieldId: string): Promise<ReadinessView> {
    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
      select: { id: true, name: true },
    });
    if (!field) throw new NotFoundException('No such programme.');

    // Effective weights, not derived ones: a reviewer's override is the weight
    // as far as everything downstream is concerned (T-134a).
    const topics = await this.weights.effective(fieldId);

    const [attempts, mocks] = await Promise.all([
      this.prisma.attempt.findMany({
        where: { userId, fieldId },
        select: { questionId: true, topicId: true, isCorrect: true, createdAt: true },
      }),
      this.prisma.sittingResult.findMany({
        where: { sitting: { userId, fieldId } },
        select: {
          questionId: true,
          topicId: true,
          isCorrect: true,
          chosenLabel: true,
          createdAt: true,
        },
      }),
    ]);

    // A mock question with no `chosenLabel` was never answered. It is graded
    // wrong for the mock score — the paper was not finished — but it says
    // nothing about whether the student knows the topic, so it is counted and
    // reported rather than folded into a score.
    const answeredMocks = mocks.filter((m) => m.chosenLabel !== null);
    const unansweredInMocks = mocks.length - answeredMocks.length;

    // Merged into one chronological sequence before reducing, because "most
    // recent answer" has to mean most recent *overall*. Sorting each table
    // separately and concatenating would let a practice attempt from March
    // overwrite a mock answer from June purely because of which query ran last.
    const answers: AnsweredQuestion[] = [...attempts, ...answeredMocks]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((row) => ({
        questionId: row.questionId,
        topicId: row.topicId,
        isCorrect: row.isCorrect,
      }));

    const readiness = buildReadiness(
      topics.map((t) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        weightPct: t.weightPct,
        weightSource: t.weightSource,
      })),
      answers,
      unansweredInMocks,
    );

    const next = readiness.focus[0] ?? null;
    return {
      ...readiness,
      fieldId: field.id,
      fieldName: field.name,
      practiceNext: next ? { topicId: next.topicId, topicName: next.topicName } : null,
    };
  }

  /**
   * Score across mock sittings, oldest first (T-138).
   *
   * Only closed sittings: an open one has no score, and a paper someone is
   * halfway through is not a data point about anything.
   */
  async trend(userId: string, fieldId: string): Promise<SittingPoint[]> {
    const sittings = await this.prisma.sitting.findMany({
      where: { userId, fieldId, closedAt: { not: null } },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        startedAt: true,
        closedAt: true,
        closeReason: true,
        scoreCorrect: true,
        answeredCount: true,
      },
    });

    const counts = await this.prisma.examQuestion.groupBy({
      by: ['examId'],
      _count: { _all: true },
      where: { exam: { sittings: { some: { userId, fieldId } } } },
    });
    const byExam = new Map(counts.map((c) => [c.examId, c._count._all]));

    const withTotals = await this.prisma.sitting.findMany({
      where: { id: { in: sittings.map((s) => s.id) } },
      select: { id: true, examId: true },
    });
    const examOf = new Map(withTotals.map((s) => [s.id, s.examId]));

    return labelSittings(
      sittings.map((s) => ({
        sittingId: s.id,
        startedAt: s.startedAt.toISOString(),
        scoreCorrect: s.scoreCorrect ?? 0,
        totalQuestions: byExam.get(examOf.get(s.id) ?? '') ?? 0,
        answeredCount: s.answeredCount ?? 0,
        ranOutOfTime: s.closeReason === 'EXPIRED',
      })),
    );
  }
}
