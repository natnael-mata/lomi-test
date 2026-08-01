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
}
