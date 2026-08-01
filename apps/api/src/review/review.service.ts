import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/** A question waiting for review, with everything needed to judge it. */
export interface ReviewItem {
  id: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  conceptLine: string | null;
  explanation: string | null;
  timeLimitSec: number;
  authorId: string | null;
  importFlags: string[];
  field: string;
  course: string;
  topic: string;
  options: {
    label: string;
    text: string;
    isCorrect: boolean;
    whyWrong: string | null;
  }[];
  steps: { stepNo: number; text: string; formula: string | null }[];
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The next question for this reviewer to look at, or `null` when the queue is
   * empty for them.
   *
   * **Oldest first**, by `updatedAt`. A queue that hands out the newest item
   * leaves the awkward questions at the bottom forever, and the awkward ones are
   * exactly the ones a student eventually reads.
   *
   * **Never your own question.** The publish gate already refuses a self-review
   * (T-044), but refusing at the end of the process wastes the reviewer's read;
   * skipping it here means it is never offered in the first place. The two are
   * not redundant — this is the queue being polite, the gate is the rule.
   */
  async next(reviewerId: string): Promise<ReviewItem | null> {
    const question = await this.prisma.question.findFirst({
      where: {
        status: 'IN_REVIEW',
        // Spelled out as an OR rather than `NOT: { authorId: reviewerId }`.
        // That form compiles to `NOT (authorId = $1)`, which is NULL — not true
        // — for an unattributed question, so every author-less row silently
        // vanished from every queue. An unattributed question is nobody's own
        // work; it belongs in everyone's.
        OR: [{ authorId: null }, { authorId: { not: reviewerId } }],
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
        topic: { include: { course: { include: { field: true } } } },
      },
    });
    if (!question) return null;

    return {
      id: question.id,
      stableId: question.stableId,
      qType: question.qType,
      stem: question.stem,
      codeBlock: question.codeBlock,
      conceptLine: question.conceptLine,
      explanation: question.explanation,
      timeLimitSec: question.timeLimitSec,
      authorId: question.authorId,
      importFlags: question.importFlags,
      field: question.topic.course.field.name,
      course: question.topic.course.name,
      topic: question.topic.name,
      options: question.options.map((o) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect,
        whyWrong: o.whyWrong,
      })),
      steps: question.steps.map((s) => ({
        stepNo: s.stepNo,
        text: s.text,
        formula: s.formula,
      })),
    };
  }
}
