import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { toServedQuestion, type ServedQuestion } from './question-view';

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The next question for this student to practise.
   *
   * Only `PUBLISHED`, only in their field. Both filters are on the row, not on
   * anything the caller sends — a field id in the request would let any student
   * read any programme's bank.
   *
   * Selection is **random among the eligible**, not "oldest first": a
   * deterministic order means every student in a field sees the same sequence,
   * which turns the bank into a shareable answer list. Randomness here is a
   * mild anti-sharing measure, not a pedagogy claim.
   */
  async next(userId: string): Promise<ServedQuestion> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    // The field gate (T-085) runs before this, so a null field means the guard
    // was not wired up — fail rather than serve from an arbitrary programme.
    if (!user?.fieldId) throw new NotFoundException('No programme chosen.');

    const eligible = await this.prisma.question.findMany({
      where: {
        fieldId: user.fieldId,
        status: 'PUBLISHED',
        // T-110: not one they have already got right today.
        NOT: {
          attempts: { some: { userId, isCorrect: true, createdAt: { gte: startOfToday() } } },
        },
      },
      select: { id: true },
    });

    if (eligible.length === 0) {
      throw new NotFoundException('Nothing left to practise in this programme today.');
    }

    const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: pick.id },
      // Selected explicitly. `include: { options: true }` would carry
      // `isCorrect` and `whyWrong` out of the database, and the only thing
      // standing between that and the wire would be the mapper remembering.
      select: {
        id: true,
        stableId: true,
        qType: true,
        stem: true,
        codeBlock: true,
        timeLimitSec: true,
        topic: { select: { name: true } },
        options: { select: { label: true, text: true }, orderBy: { label: 'asc' } },
      },
    });

    return toServedQuestion(question);
  }
}

/**
 * Midnight local time.
 *
 * "The same day" is the student's day, not UTC's. Ethiopia is UTC+3, so a UTC
 * boundary would reset a student's practice at 3am — mid-revision for exactly
 * the people cramming the night before.
 */
export function startOfToday(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}
