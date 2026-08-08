import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { gateBlockers, type DraftQuestion } from './publish-gate';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Publishes a question, or refuses with the list of reasons.
   *
   * The gate runs HERE, on the server, on every publish — not only when a draft
   * is saved and not only in the browser. The creator form mirrors the same
   * rules for live feedback, but that copy is advisory: anything that can reach
   * this endpoint (a script, a stale tab, a future admin tool) still has to pass.
   */
  async publish(id: string, reviewerId: string): Promise<{ id: string; status: string }> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      // Ordered, not incidental. Without this the blockers come back in
      // Postgres heap order, which an UPDATE reshuffles — so the same
      // unpublishable question hands a reviewer the same complaints in a
      // different order each time they press the button. Caught by a test that
      // had been passing for days, after a re-import moved one option's row.
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
        topic: true,
      },
    });
    if (!q) throw new NotFoundException(`No question ${id}`);

    const draft: DraftQuestion = {
      qType: q.qType,
      stem: q.stem,
      conceptLine: q.conceptLine,
      explanation: q.explanation,
      timeLimitSec: q.timeLimitSec,
      authorId: q.authorId,
      // The reviewer is whoever is publishing right now, not whatever is stored:
      // that is what makes self-review detectable at the moment it is attempted.
      reviewerId,
      topic: { name: q.topic.name, weightPct: q.topic.weightPct?.toNumber() ?? null },
      steps: q.steps.map((s) => ({ stepNo: s.stepNo, text: s.text, formula: s.formula })),
      options: q.options.map((o) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect,
        whyWrong: o.whyWrong,
      })),
    };

    const blockers = gateBlockers(draft);
    if (blockers.length > 0) {
      // 422: the request is well-formed, the content is not publishable.
      throw new UnprocessableEntityException({ error: 'GATE_BLOCKED', blockers });
    }

    // One transaction: an audit row that survives a rolled-back publish is a lie
    // about what happened, and a publish with no audit row is worse.
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.question.update({
        where: { id },
        data: { status: 'PUBLISHED', reviewerId },
      });
      await this.audit.record(
        {
          actorId: reviewerId,
          action: 'PUBLISHED',
          questionId: row.id,
          stableId: row.stableId,
        },
        tx,
      );
      return row;
    });
    return { id: updated.id, status: updated.status };
  }

  /**
   * Withdraws a question from service.
   *
   * `RETIRED`, never deleted: prior attempts reference the question, and a
   * student's history that points at nothing is a worse artefact than a bad
   * question nobody is served any more.
   *
   * Idempotent — retiring an already-retired question is not an error, it is
   * somebody making sure. It writes no second audit row either, so the log
   * records the withdrawal once.
   */
  async retire(id: string, actorId: string, reason?: string): Promise<RetireResult> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      select: { id: true, stableId: true, status: true },
    });
    if (!q) throw new NotFoundException(`No question ${id}`);

    if (q.status === 'RETIRED') {
      // Still measured. Somebody re-running a retirement is usually somebody
      // checking what it cost, and answering "unknown" to that is unhelpful in
      // the one moment the number is being looked for.
      return {
        id: q.id,
        status: q.status,
        alreadyRetired: true,
        blastRadius: await this.blastRadius(q.id),
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.question.update({ where: { id }, data: { status: 'RETIRED' } });
      await this.audit.record(
        {
          actorId,
          action: 'RETIRED',
          questionId: row.id,
          stableId: row.stableId,
          detail: reason?.trim() || null,
        },
        tx,
      );
      return row;
    });

    return {
      id: updated.id,
      status: updated.status,
      alreadyRetired: false,
      // Measured AFTER the status change, deliberately. Retiring stops the
      // question being sampled into new papers, so counting first would include
      // sittings that can no longer start — the number a reviewer needs is what
      // is disturbed now, not what was disturbed a moment ago.
      blastRadius: await this.blastRadius(updated.id),
    };
  }

  /**
   * How much withdrawing this question disturbs (T-070).
   *
   * DESIGN.md requires this **itemised, never summarised**: "this affects many
   * students" is a sentence an operator skims past, and a number they can check
   * is what makes them stop and read. So the two counts are separate and neither
   * is folded into a total — they are different kinds of harm. An attempt is
   * history that stays correct whatever happens next; a live sitting is a
   * student in a timed exam right now, with this question on their paper.
   */
  async blastRadius(questionId: string): Promise<BlastRadius> {
    const [attempts, liveSittings, attemptStudents, sittingStudents] = await Promise.all([
      this.prisma.attempt.count({ where: { questionId } }),
      // Live means started and not yet closed. A closed sitting has already
      // been graded against the key as it stood, and nothing about retiring the
      // question now reaches back into it.
      this.prisma.sitting.count({
        where: {
          closedAt: null,
          exam: { questions: { some: { questionId } } },
        },
      }),
      // Distinct students, from both places an answer can live. Grouped rather
      // than counted, because the same person answering three times is one
      // readiness figure, not three.
      this.prisma.attempt.groupBy({ by: ['userId'], where: { questionId } }),
      this.prisma.sittingResult.groupBy({
        by: ['sittingId'],
        where: { questionId, chosenLabel: { not: null } },
      }),
    ]);

    // Readiness rests on one row per question at its most recent answer
    // (T-135), so anybody who has answered this question has a readiness figure
    // partly built on it. That is what an operator is actually deciding about:
    // a wrong answer key does not just withdraw a question, it means every one
    // of these students was graded against something that turned out to be
    // false.
    const sittingUsers = await this.prisma.sitting.groupBy({
      by: ['userId'],
      where: { id: { in: sittingStudents.map((s) => s.sittingId) } },
    });
    const affected = new Set([
      ...attemptStudents.map((a) => a.userId),
      ...sittingUsers.map((s) => s.userId),
    ]);

    return {
      attempts,
      liveSittings,
      studentsAffected: affected.size,
      measurable: true,
    };
  }
}

export interface RetireResult {
  id: string;
  status: string;
  alreadyRetired: boolean;
  blastRadius: BlastRadius;
}

/**
 * How much a retirement disturbs — how many attempts referenced the question,
 * and how many exam sittings are in progress with it on the paper.
 *
 * `null` means **not yet measurable**, not zero. `Attempt` and `Sitting` land in
 * Phase 4; reporting 0 before those tables exist would tell a reviewer that
 * retiring a question disturbs nobody, which is a claim this code cannot make.
 * T-070 stays open for exactly this half.
 */
export interface BlastRadius {
  attempts: number | null;
  liveSittings: number | null;
  /**
   * Distinct students whose readiness figure rests partly on this question
   * (T-165). Counted from both attempts and answered mock questions, deduped —
   * one person answering three times is one readiness figure, not three.
   */
  studentsAffected: number | null;
  measurable: boolean;
}

export const BLAST_RADIUS_UNKNOWN: BlastRadius = {
  attempts: null,
  liveSittings: null,
  studentsAffected: null,
  measurable: false,
};
