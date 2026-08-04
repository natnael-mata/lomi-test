/**
 * Choosing the questions for a paper.
 *
 * Pure: an RNG is injected, so a test can make sampling deterministic without
 * seeding a global. No Prisma here — the caller loads the pool and writes the
 * result.
 */
import {
  assertBudgetsFitDuration,
  questionCount,
  type Blueprint,
  type PoolQuestion,
} from './exam-blueprint';

/** Picks one index from `0..count-1`. Injected so tests are deterministic. */
export type Pick = (count: number) => number;

export const randomPick: Pick = (count) => Math.floor(Math.random() * count);

export interface TopicShare {
  topicId: string;
  topicName: string;
  /** Share of past papers, 0–100. */
  weightPct: number;
}

export interface TopicQuota extends TopicShare {
  /** How many questions this topic should contribute. */
  target: number;
}

/**
 * Splits `total` questions across topics by weight.
 *
 * **Largest remainder, over integer hundredths.** Rounding each topic
 * independently does not work: three topics at 33.33, 33.33, 33.34 percent of a
 * hundred-question paper round to 33 + 33 + 33 = 99, and the paper is short a
 * question with nothing in the code aware of it. Largest remainder allocates the
 * floor to everyone and then hands the leftovers to whoever was rounded down
 * hardest, so the parts always sum to the whole.
 *
 * Hundredths rather than floats for the same reason `weights.ts` uses them:
 * 0.1 + 0.2 is not 0.3, and a weight column that fails its own sum check is a
 * check that gets switched off.
 *
 * Ties break on topic name, so the same input always produces the same paper.
 */
export function allocateTopicQuotas(shares: readonly TopicShare[], total: number): TopicQuota[] {
  if (shares.length === 0 || total <= 0) return shares.map((s) => ({ ...s, target: 0 }));

  const hundredths = shares.map((s) => Math.round(s.weightPct * 100));
  const weightTotal = hundredths.reduce((a, b) => a + b, 0);
  if (weightTotal === 0) return shares.map((s) => ({ ...s, target: 0 }));

  const exact = hundredths.map((h) => (h * total) / weightTotal);
  const floors = exact.map((e) => Math.floor(e));
  let remaining = total - floors.reduce((a, b) => a + b, 0);

  const order = shares
    .map((share, index) => ({
      index,
      remainder: exact[index]! - floors[index]!,
      name: share.topicName,
    }))
    .sort((a, b) => b.remainder - a.remainder || a.name.localeCompare(b.name));

  const target = [...floors];
  for (const { index } of order) {
    if (remaining <= 0) break;
    target[index] = target[index]! + 1;
    remaining -= 1;
  }

  return shares.map((share, index) => ({ ...share, target: target[index]! }));
}

export interface SampleInput {
  pool: readonly PoolQuestion[];
  blueprint: Blueprint;
  topics: readonly TopicShare[];
  pick?: Pick;
}

export interface SampleReport {
  topicId: string;
  topicName: string;
  weightPct: number;
  target: number;
  achieved: number;
}

export type SampleResult =
  { ok: true; chosen: PoolQuestion[]; report: SampleReport[] } | { ok: false; blockers: string[] };

/**
 * Builds a paper, or explains every reason it cannot.
 *
 * The type mix is **hard**: missing it produces a paper that cannot be finished
 * in the time allowed, which is a broken exam rather than an imperfect one.
 *
 * The per-topic quota is **soft**: it is aimed at and then reported. D5 says the
 * weights are derived from past papers and explicitly are not an official
 * blueprint, so refusing to build a mock over an estimate the product itself
 * disclaims would withhold the main feature for a provisional number. What is
 * achieved versus what was aimed at is recorded on the paper instead.
 *
 * Every blocker is collected before returning — whoever is building a paper
 * wants the whole shortfall, not the first one.
 */
export function sampleBlueprint(input: SampleInput): SampleResult {
  const { pool, blueprint, topics } = input;
  const pick = input.pick ?? randomPick;
  const blockers: string[] = [];

  const wanted = { CONCEPT: blueprint.conceptCount, CALCULATION: blueprint.calculationCount };
  const byType = {
    CONCEPT: pool.filter((q) => q.qType === 'CONCEPT'),
    CALCULATION: pool.filter((q) => q.qType === 'CALCULATION'),
  };

  for (const qType of ['CONCEPT', 'CALCULATION'] as const) {
    const have = byType[qType].length;
    const need = wanted[qType];
    if (have < need) {
      blockers.push(`Need ${need} ${qType} questions, have ${have} — short ${need - have}.`);
    }
  }
  if (blockers.length > 0) return { ok: false, blockers };

  const total = questionCount(blueprint);
  const quotas = allocateTopicQuotas(topics, total);
  const quotaByTopic = new Map(quotas.map((q) => [q.topicId, q]));

  const chosen: PoolQuestion[] = [];
  const achieved = new Map<string, number>();

  for (const qType of ['CONCEPT', 'CALCULATION'] as const) {
    const remaining = [...byType[qType]];
    for (let taken = 0; taken < wanted[qType]; taken++) {
      // Prefer a topic still under its quota; fall back to anything left, which
      // is what makes the topic target soft rather than fatal.
      const under = remaining.filter((q) => {
        const quota = quotaByTopic.get(q.topicId);
        return quota ? (achieved.get(q.topicId) ?? 0) < quota.target : false;
      });
      const from = under.length > 0 ? under : remaining;
      const index = pick(from.length);
      const question = from[Math.min(Math.max(index, 0), from.length - 1)]!;
      chosen.push(question);
      achieved.set(question.topicId, (achieved.get(question.topicId) ?? 0) + 1);
      remaining.splice(remaining.indexOf(question), 1);
    }
  }

  // Computed from the rows actually drawn, never from the mix and two literals.
  blockers.push(...assertBudgetsFitDuration(blueprint.durationSec, chosen));
  if (blockers.length > 0) return { ok: false, blockers };

  return {
    ok: true,
    chosen,
    report: quotas.map((quota) => ({
      topicId: quota.topicId,
      topicName: quota.topicName,
      weightPct: quota.weightPct,
      target: quota.target,
      achieved: achieved.get(quota.topicId) ?? 0,
    })),
  };
}
