/**
 * The web's answer type must not drift from the API's (T-113).
 *
 * `apps/web` and `apps/api` are separate TypeScript projects with no shared
 * package, so `AnswerViewData` here is a hand-written mirror of `AnswerView`
 * there. A mirror nobody checks is a mirror that goes stale, and the failure
 * mode is silent: a field the API starts sending that the UI never renders, or
 * one the UI reads that stopped arriving.
 *
 * This reads the API's own declaration and compares the field lists.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const apiSource = readFileSync(resolve(ROOT, 'apps/api/src/questions/answer-view.ts'), 'utf8');
const webSource = readFileSync(resolve(ROOT, 'apps/web/components/AnswerView.tsx'), 'utf8');

/** The API declares its contract as a runtime array, which is the honest source. */
function apiFields(): string[] {
  const match = /export const ANSWER_VIEW_FIELDS = \[([\s\S]*?)\] as const;/.exec(apiSource);
  expect(match, 'ANSWER_VIEW_FIELDS not found in the API').toBeTruthy();
  return [...match![1]!.matchAll(/'([\w]+)'/g)].map((m) => m[1]!);
}

/** The web mirrors it as an interface. */
function webFields(): string[] {
  const match = /export interface AnswerViewData \{([\s\S]*?)\n\}/.exec(webSource);
  expect(match, 'AnswerViewData not found in the web app').toBeTruthy();
  return [...match![1]!.matchAll(/^\s{2}(\w+)[?]?:/gm)].map((m) => m[1]!);
}

describe('the answer contract', () => {
  it('reads both declarations', () => {
    // Guards the regexes: two empty lists would compare equal forever.
    expect(apiFields().length).toBeGreaterThan(8);
    expect(webFields().length).toBeGreaterThan(5);
  });

  /**
   * The web deliberately does NOT mirror these. They identify the question
   * rather than explain it, and the answer view has no use for them — listing
   * them here is what keeps the omission a decision rather than an oversight.
   */
  const NOT_RENDERED = new Set(['questionId', 'stableId']);

  it('renders every field the API sends, except the ones it deliberately ignores', () => {
    const missing = apiFields().filter((f) => !NOT_RENDERED.has(f) && !webFields().includes(f));
    expect(missing, `the API sends these and the UI ignores them: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('reads no field the API does not send', () => {
    const invented = webFields().filter((f) => !apiFields().includes(f));
    expect(
      invented,
      `the UI expects these and the API never sends them: ${invented.join(', ')}`,
    ).toEqual([]);
  });
});
