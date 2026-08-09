/**
 * The web's view of the wire contract cannot drift from the API's (T-199c).
 *
 * **The decision: keep the mirror, guard all of it.** A shared types package was
 * the alternative, and it is the wrong shape here — the API's types are built
 * from Prisma models and Nest exceptions, so importing them into a Next.js
 * client would make a Prisma migration a client-side compile error and let the
 * server's internal shape leak into the browser bundle. The boundary between
 * "what the server stores" and "what goes over the wire" is worth keeping, and a
 * hand-written mirror *is* that boundary written down.
 *
 * What the mirror costs is drift, and drift is what this closes. `AnswerViewData`
 * has had a guard since T-113; the other eleven contracts had none, which meant
 * the rule was enforced on a twelfth of the surface. Every one is checked here.
 *
 * The comparison is **field names only**, deliberately. Types differ across the
 * boundary for real reasons — `Date` becomes an ISO string, a Prisma `Decimal`
 * becomes a number — and a checker that demanded identical types would be
 * satisfied only by the shared package this decision rejects.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '../..');
const API = join(REPO, 'apps/api/src');

const clientSource = readFileSync(join(WEB, 'lib/api.ts'), 'utf8');

/** Every API source file, so a base interface can be found wherever it lives. */
function apiSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return apiSources(full);
    return name.endsWith('.ts') && !name.includes('.test') ? [readFileSync(full, 'utf8')] : [];
  });
}

const API_SOURCES = apiSources(API);

/**
 * The field names of one exported interface, **including inherited ones**.
 *
 * Following `extends` is not optional: the first run of this guard reported
 * `ReadinessView` and `SittingPoint` as drifted when both were correct — each
 * declares three own fields and inherits the rest from a base in another file.
 * A checker that reads only the declaration would have to be silenced or the
 * types flattened, and both of those are worse than the drift it exists to
 * catch.
 *
 * Nested object literals are skipped rather than flattened: a nested shape is
 * checked by whichever contract owns it, and flattening would report a
 * difference in `topics[].topicId` as a difference in `topics`.
 */
function fields(sources: string[], name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return []; // `A extends B extends A` should not hang.
  seen.add(name);

  const pattern = new RegExp(`export interface ${name}\\b([^{]*)\\{([\\s\\S]*?)\\n\\}`);
  const match = sources.map((source) => pattern.exec(source)).find(Boolean);
  if (!match) return [];

  const inherited = (match[1] ?? '')
    .replace(/^\s*extends\s+/, '')
    .split(',')
    .map((base) => base.trim())
    .filter(Boolean)
    .flatMap((base) => fields(sources, base, seen));

  const body = match[2] ?? '';
  const names: string[] = [];
  let depth = 0;

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) continue;

    // Only count a field when we are at the top level of this interface.
    if (depth === 0) {
      const field = /^([A-Za-z_][\w]*)\??\s*:/.exec(line);
      if (field?.[1]) names.push(field[1]);
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }

  return [...new Set([...inherited, ...names])].sort();
}

/** Every contract the web mirrors, and where the API declares it. */
const CONTRACTS: { web: string; api: string; file: string }[] = [
  { web: 'ServedQuestion', api: 'ServedQuestion', file: 'practice/question-view.ts' },
  { web: 'AttemptResult', api: 'AttemptResult', file: 'practice/practice.service.ts' },
  { web: 'SittingResult', api: 'SittingResultView', file: 'exams/exams.service.ts' },
  { web: 'PracticeSummary', api: 'PracticeSummary', file: 'practice/summary.ts' },
  { web: 'EffectiveWeight', api: 'EffectiveWeight', file: 'taxonomy/weights.service.ts' },
  { web: 'BlastRadius', api: 'BlastRadius', file: 'questions/questions.service.ts' },
  { web: 'Readiness', api: 'ReadinessView', file: 'progress/progress.service.ts' },
  { web: 'TrendPoint', api: 'SittingPoint', file: 'progress/trend.ts' },
  { web: 'SittingClock', api: 'SittingClock', file: 'exams/sitting-clock.ts' },
  { web: 'SittingStart', api: 'StartResult', file: 'exams/exams.service.ts' },
  { web: 'SittingManifest', api: 'SittingManifest', file: 'exams/exam-view.ts' },
  { web: 'SittingItem', api: 'SittingItem', file: 'exams/exam-view.ts' },
  { web: 'PlanOffer', api: 'PlanOffer', file: 'payments/plan.ts' },
  { web: 'StartedPayment', api: 'StartedPayment', file: 'payments/chapa.service.ts' },
  { web: 'PaymentStatus', api: 'PaymentStatusView', file: 'payments/chapa.service.ts' },
];

describe('cross-workspace contracts (T-199c)', () => {
  it('covers every interface the client mirrors', () => {
    /*
     * The assertion that makes this task finished rather than half-done: the
     * guard must cover *every* mirrored contract, not the one somebody
     * remembered. A new interface in `api.ts` fails here until it is listed.
     */
    const declared = [...clientSource.matchAll(/export interface (\w+)/g)]
      .map((m) => m[1]!)
      // Not wire contracts: the error class and the request bodies the client
      // builds, which have no server-side counterpart to drift from.
      .filter((name) => !['ApiError', 'AnswerViewData'].includes(name));

    const guarded = new Set(CONTRACTS.map((c) => c.web));
    const unguarded = declared.filter((name) => !guarded.has(name));
    expect(unguarded, `add these to CONTRACTS: ${unguarded.join(', ')}`).toEqual([]);
  });

  it.each(CONTRACTS)('$web matches the API’s $api', ({ web, api, file }) => {
    const apiPath = join(API, file);
    expect(existsSync(apiPath), `${file} is missing`).toBe(true);

    const apiFields = fields(API_SOURCES, api);
    const webFields = fields([clientSource], web);

    expect(apiFields.length, `no fields found for ${api} in ${file}`).toBeGreaterThan(0);
    expect(webFields.length, `no fields found for ${web} in lib/api.ts`).toBeGreaterThan(0);
    expect(webFields, `${web} has drifted from ${api}`).toEqual(apiFields);
  });

  /**
   * The decision itself, written where somebody about to build the shared
   * package will read it.
   */
  it('records why there is no shared types package', () => {
    const source = readFileSync(join(WEB, 'lib/contracts.test.ts'), 'utf8');
    expect(source).toContain('shared types package');
    expect(source).toContain('Prisma');
  });
});
