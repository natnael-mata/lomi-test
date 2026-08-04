import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WeightsError, applyOverrides, deriveWeights, type DerivedWeight } from './weights';

export interface EffectiveWeight {
  topicId: string;
  topicName: string;
  weightPct: number;
  /** What the bank alone says, before any reviewer's correction. */
  derivedPct: number;
  /** T-135's field: where this number actually came from. */
  weightSource: 'derived' | 'override';
  /** Only on an override, so a screen can say why the two disagree. */
  overrideReason: string | null;
  publishedCount: number;
}

/**
 * Deriving and overriding topic weights (T-134, T-134a).
 *
 * `Topic.weightPct` is the **effective** weight — what every other part of the
 * system reads, and the only thing the publish gate and the exam sampler ever
 * see. The `TopicWeightOverride` row alongside it records that a human disagreed
 * with the derivation and why. Keeping those apart is what makes re-deriving
 * safe: a fresh derivation recomputes the bank's opinion and then re-applies the
 * corrections on top, rather than quietly deleting somebody's judgement because
 * ten new questions were imported.
 */
@Injectable()
export class WeightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recomputes every topic weight in a field and writes the result.
   *
   * Idempotent: running it twice on an unchanged bank writes the same numbers.
   * Safe to run after any import or publish, which is the point — the weights
   * are a view of the bank and go stale the moment the bank moves.
   */
  async derive(fieldId: string): Promise<EffectiveWeight[]> {
    const topics = await this.loadTopics(fieldId);
    if (topics.length === 0) {
      throw new NotFoundException('No topics in this field yet.');
    }

    let derived: DerivedWeight[];
    try {
      derived = deriveWeights(
        topics.map((t) => ({
          topicId: t.id,
          name: t.name,
          publishedCount: t.publishedCount,
        })),
      );
    } catch (error) {
      throw asHttp(error);
    }

    const overrides = await this.prisma.topicWeightOverride.findMany({
      where: { topicId: { in: topics.map((t) => t.id) } },
    });
    const byTopic = new Map(overrides.map((o) => [o.topicId, o]));

    let effective: DerivedWeight[];
    try {
      effective = applyOverrides(derived, new Map(overrides.map((o) => [o.topicId, o.weightPct])));
    } catch (error) {
      throw asHttp(error);
    }

    const derivedByTopic = new Map(derived.map((d) => [d.topicId, d.weightPct]));

    await this.prisma.$transaction([
      ...effective.map((row) =>
        this.prisma.topic.update({
          where: { id: row.topicId },
          data: { weightPct: row.weightPct },
        }),
      ),
      // The stored `derivedPct` is refreshed too, so an override keeps showing
      // the size of the correction against what the bank says *now* rather than
      // against whatever it said the day somebody typed it.
      ...overrides.map((o) =>
        this.prisma.topicWeightOverride.update({
          where: { id: o.id },
          data: { derivedPct: derivedByTopic.get(o.topicId) ?? o.derivedPct },
        }),
      ),
    ]);

    const counts = new Map(topics.map((t) => [t.id, t.publishedCount]));
    return effective.map((row) => {
      const override = byTopic.get(row.topicId);
      return {
        topicId: row.topicId,
        topicName: row.name,
        weightPct: row.weightPct,
        derivedPct: derivedByTopic.get(row.topicId) ?? row.weightPct,
        weightSource: override ? ('override' as const) : ('derived' as const),
        overrideReason: override?.reason ?? null,
        publishedCount: counts.get(row.topicId) ?? 0,
      };
    });
  }

  /** The current effective weights, without recomputing anything. */
  async effective(fieldId: string): Promise<EffectiveWeight[]> {
    const topics = await this.loadTopics(fieldId);
    const overrides = await this.prisma.topicWeightOverride.findMany({
      where: { topicId: { in: topics.map((t) => t.id) } },
    });
    const byTopic = new Map(overrides.map((o) => [o.topicId, o]));

    return topics.map((topic) => {
      const override = byTopic.get(topic.id);
      return {
        topicId: topic.id,
        topicName: topic.name,
        weightPct: topic.weightPct?.toNumber() ?? 0,
        derivedPct: override?.derivedPct ?? topic.weightPct?.toNumber() ?? 0,
        weightSource: override ? ('override' as const) : ('derived' as const),
        overrideReason: override?.reason ?? null,
        publishedCount: topic.publishedCount,
      };
    });
  }

  /**
   * Records a reviewer's override, then re-derives the field around it (T-134a).
   *
   * The reason is required by the column and checked here too, so the error is a
   * 422 a person can read rather than a database constraint violation. An
   * override with no reason is indistinguishable from a typo six months later,
   * and the next reviewer has no way to know whether to keep it.
   */
  async override(
    topicId: string,
    weightPct: number,
    reason: string,
    actorId: string,
  ): Promise<EffectiveWeight[]> {
    if (!Number.isInteger(weightPct) || weightPct < 0 || weightPct > 100) {
      throw new UnprocessableEntityException({
        error: 'INVALID_WEIGHT',
        message: 'A weight is a whole number from 0 to 100.',
      });
    }
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new UnprocessableEntityException({
        error: 'REASON_REQUIRED',
        message: 'Say why this weight is being overridden.',
      });
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, weightPct: true, course: { select: { fieldId: true } } },
    });
    if (!topic) throw new NotFoundException('No such topic.');

    await this.prisma.topicWeightOverride.upsert({
      where: { topicId },
      update: { weightPct, reason: trimmed, setBy: actorId },
      create: {
        topicId,
        weightPct,
        derivedPct: topic.weightPct?.toNumber() ?? 0,
        reason: trimmed,
        setBy: actorId,
      },
    });

    return this.derive(topic.course.fieldId);
  }

  /** Removes an override; the topic goes back to whatever the bank says. */
  async clearOverride(topicId: string): Promise<EffectiveWeight[]> {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { course: { select: { fieldId: true } } },
    });
    if (!topic) throw new NotFoundException('No such topic.');

    await this.prisma.topicWeightOverride.deleteMany({ where: { topicId } });
    return this.derive(topic.course.fieldId);
  }

  /** Every topic in a field, with how many published questions it holds. */
  private async loadTopics(fieldId: string): Promise<
    {
      id: string;
      name: string;
      weightPct: { toNumber(): number } | null;
      publishedCount: number;
    }[]
  > {
    const topics = await this.prisma.topic.findMany({
      where: { course: { fieldId } },
      // Ordered by name so the derivation's alphabetical tie-break is applied to
      // a stable list rather than to Postgres heap order — the same bug T-068a
      // produced in the publish gate.
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        weightPct: true,
        _count: { select: { questions: { where: { status: 'PUBLISHED' } } } },
      },
    });

    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      weightPct: t.weightPct,
      publishedCount: t._count.questions,
    }));
  }
}

/** Turns a weights-arithmetic failure into something a client can act on. */
function asHttp(error: unknown): unknown {
  if (error instanceof WeightsError) {
    return new UnprocessableEntityException({ error: error.code, message: error.message });
  }
  return error;
}
