import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * The permanent record of what was done to a question.
 *
 * Every write goes through here rather than being inlined at each call site, so
 * "did this action get logged" is one thing to check rather than three, and so
 * the log can never be written with a different shape from one route than
 * another.
 *
 * Writes are made **inside the caller's transaction** where one exists. An audit
 * row that survives a rolled-back publish is a lie about what happened, and one
 * that vanishes while the publish stands is worse.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    entry: {
      actorId: string;
      action: AuditAction;
      questionId: string;
      stableId: string;
      detail?: string | null;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        questionId: entry.questionId,
        stableId: entry.stableId,
        detail: entry.detail ?? null,
      },
    });
  }

  /** A question's history, oldest first — the order somebody reads it in. */
  async forQuestion(questionId: string) {
    return this.prisma.auditLog.findMany({
      where: { questionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
