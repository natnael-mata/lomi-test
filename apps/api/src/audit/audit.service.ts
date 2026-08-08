import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * The permanent record of what an operator did.
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

  /**
   * Records a mutation to any entity (T-167).
   *
   * `entity` and `entityId` are required because an audit row that does not say
   * what it acted on is not a record of anything — the database enforces it too.
   * `reference` is the human-readable form, copied in so the log stays legible
   * after the row it points at is gone.
   */
  async recordAction(
    entry: {
      actorId: string;
      action: AuditAction;
      entity: 'question' | 'topic' | 'field' | 'exam' | 'user';
      entityId: string;
      reference?: string | null;
      detail?: string | null;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        reference: entry.reference ?? null,
        // Kept in step for question actions, so the existing per-question
        // queries and every test written against them still resolve.
        questionId: entry.entity === 'question' ? entry.entityId : null,
        stableId: entry.entity === 'question' ? (entry.reference ?? null) : null,
        detail: entry.detail ?? null,
      },
    });
  }

  /**
   * The question form, kept because it is what most call sites mean.
   *
   * A thin wrapper rather than an overload: the question path is the one with a
   * `stableId`, and spelling it out at the call site is what keeps somebody from
   * quietly passing a topic id into a question audit.
   */
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
    await this.recordAction(
      {
        actorId: entry.actorId,
        action: entry.action,
        entity: 'question',
        entityId: entry.questionId,
        reference: entry.stableId,
        detail: entry.detail ?? null,
      },
      tx,
    );
  }

  /** A question's history, oldest first — the order somebody reads it in. */
  async forQuestion(questionId: string) {
    return this.prisma.auditLog.findMany({
      where: { questionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
