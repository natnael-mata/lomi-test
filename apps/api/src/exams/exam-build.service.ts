import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import {
  budgetSum,
  DEFAULT_BLUEPRINT,
  questionCount,
  slackSec,
  type Blueprint,
  type PoolQuestion,
} from './exam-blueprint';
import { sampleBlueprint, type SampleReport, type TopicShare } from './sampling';

export interface BuildRequest {
  fieldId: string;
  slug?: string;
  name?: string;
  blueprint?: Partial<Blueprint>;
}

export interface BuiltExam {
  id: string;
  slug: string;
  name: string;
  durationSec: number;
  conceptCount: number;
  calculationCount: number;
  budgetSec: number;
  slackSec: number;
  topicPlan: SampleReport[];
}

export interface BankReadiness {
  fieldId: string;
  publishable: { CONCEPT: number; CALCULATION: number };
  required: { CONCEPT: number; CALCULATION: number };
  weightedTopics: number;
  unweightedTopics: number;
  blockers: string[];
  canBuild: boolean;
}

/**
 * Building a mock paper.
 *
 * **An admin action, not something a student's Start button triggers.** Sampling
 * at start time would put a 422 in front of a student who cannot act on it, and
 * that 422's body — "need 40 CALCULATION, have 10" — is an inventory of the
 * question bank handed to whoever asked. It also makes T-120's requirement that
 * two sittings of one exam get identical questions true by construction rather
 * than by a seeded random number generator.
 */
@Injectable()
export class ExamBuildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  /** What the bank can and cannot currently support. A dry run, changing nothing. */
  async readiness(
    fieldId: string,
    blueprint: Blueprint = DEFAULT_BLUEPRINT,
  ): Promise<BankReadiness> {
    const field = await this.prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('No such programme.');

    const pool = await this.loadPool(fieldId);
    const topics = await this.prisma.topic.findMany({
      where: { course: { fieldId } },
      select: { id: true, weightPct: true },
    });

    const publishable = {
      CONCEPT: pool.filter((q) => q.qType === 'CONCEPT').length,
      CALCULATION: pool.filter((q) => q.qType === 'CALCULATION').length,
    };
    const required = {
      CONCEPT: blueprint.conceptCount,
      CALCULATION: blueprint.calculationCount,
    };

    const blockers: string[] = [];
    for (const qType of ['CONCEPT', 'CALCULATION'] as const) {
      if (publishable[qType] < required[qType]) {
        blockers.push(
          `Need ${required[qType]} ${qType} questions, have ${publishable[qType]} — ` +
            `short ${required[qType] - publishable[qType]}.`,
        );
      }
    }

    const unweighted = topics.filter((t) => t.weightPct === null).length;
    if (unweighted > 0) {
      // Not fatal to sampling itself — the topic quota is soft — but it is why
      // the publish gate is refusing everything, which is the real reason the
      // pool is empty. Saying so turns a confusing "have 0" into an actionable
      // report.
      blockers.push(
        `${unweighted} of ${topics.length} topics have no weight, so the publish gate (T-046) ` +
          `refuses every question in them. Derive weights first (T-134).`,
      );
    }

    return {
      fieldId,
      publishable,
      required,
      weightedTopics: topics.length - unweighted,
      unweightedTopics: unweighted,
      blockers,
      canBuild: blockers.length === 0,
    };
  }

  /**
   * Samples a paper and freezes it.
   *
   * The field's weights must sum to 100 before this runs — that check has lived
   * unused in `TaxonomyService` since T-024 and this is the caller it was written
   * for. A paper drawn against weights that do not add up is a paper whose topic
   * distribution means nothing.
   */
  async build(request: BuildRequest, builtBy: string): Promise<BuiltExam> {
    const blueprint: Blueprint = { ...DEFAULT_BLUEPRINT, ...request.blueprint };

    const field = await this.prisma.field.findUnique({ where: { id: request.fieldId } });
    if (!field) throw new NotFoundException('No such programme.');

    const blockers: string[] = [];

    try {
      await this.taxonomy.assertFieldWeightsSumTo100(request.fieldId);
    } catch (e) {
      blockers.push(e instanceof Error ? e.message : 'Topic weights do not sum to 100.');
    }

    const pool = await this.loadPool(request.fieldId);
    const topics = await this.prisma.topic.findMany({
      where: { course: { fieldId: request.fieldId } },
      select: { id: true, name: true, weightPct: true },
    });
    const shares: TopicShare[] = topics
      .filter((t) => t.weightPct !== null)
      .map((t) => ({ topicId: t.id, topicName: t.name, weightPct: t.weightPct!.toNumber() }));

    const sampled = sampleBlueprint({ pool, blueprint, topics: shares });
    if (!sampled.ok) blockers.push(...sampled.blockers);

    if (blockers.length > 0 || !sampled.ok) {
      // Every reason at once, like the publish gate: whoever is building a paper
      // wants the whole shortfall, not the first thing that stopped it.
      throw new UnprocessableEntityException({ error: 'CANNOT_BUILD_EXAM', blockers });
    }

    const slug = request.slug ?? (await this.nextSlug(request.fieldId));
    const name = request.name ?? slugToName(slug);
    const builtAt = new Date();

    const exam = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          fieldId: request.fieldId,
          slug,
          name,
          durationSec: blueprint.durationSec,
          conceptCount: blueprint.conceptCount,
          calculationCount: blueprint.calculationCount,
          builtBy,
          builtAt,
          topicPlan: sampled.report as unknown as object,
        },
      });

      await tx.examQuestion.createMany({
        data: sampled.chosen.map((question, index) => ({
          examId: created.id,
          questionId: question.id,
          topicId: question.topicId,
          position: index + 1,
          qType: question.qType,
          // SNAPSHOT. A reviewer may change the question's budget afterwards and
          // a re-import used to revert it; the paper must keep summing to its
          // own sitting length for as long as anyone can read its history.
          timeLimitSec: question.timeLimitSec,
        })),
      });

      return created;
    });

    return {
      id: exam.id,
      slug: exam.slug,
      name: exam.name,
      durationSec: exam.durationSec,
      conceptCount: exam.conceptCount,
      calculationCount: exam.calculationCount,
      budgetSec: budgetSum(sampled.chosen),
      slackSec: slackSec(blueprint.durationSec, sampled.chosen),
      topicPlan: sampled.report,
    };
  }

  /**
   * Every question that may appear on a paper.
   *
   * `PUBLISHED` only, and selected explicitly — an `include` would carry the
   * answer key out of the database on the way to building a paper, which is
   * exactly the material a sitting must never see.
   */
  private async loadPool(fieldId: string): Promise<PoolQuestion[]> {
    return this.prisma.question.findMany({
      where: { fieldId, status: 'PUBLISHED' },
      select: { id: true, topicId: true, qType: true, timeLimitSec: true },
      orderBy: { stableId: 'asc' },
    });
  }

  /** "mock-1", "mock-2", … per field. */
  private async nextSlug(fieldId: string): Promise<string> {
    const count = await this.prisma.exam.count({ where: { fieldId } });
    return `mock-${count + 1}`;
  }
}

const slugToName = (slug: string): string =>
  slug
    .split('-')
    .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');

export { questionCount };
