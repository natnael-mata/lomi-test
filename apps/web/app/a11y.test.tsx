/**
 * Axe accessibility scan over every student surface (T-200).
 *
 * **Rendered, not fetched.** The alternative was to start the dev server and
 * scan real pages, which sounds more honest and is worse: it needs a live API, a
 * session, and a database, so it would run nowhere except a developer's machine
 * on a good day — and a scan that does not run in CI is a scan that stops being
 * true. Rendering the components to static markup covers what a student's
 * browser paints before any data arrives, which is the state most a11y defects
 * live in and the one nobody looks at.
 *
 * What that does **not** cover is stated plainly, because a green scan invites
 * the wrong conclusion: it misses everything that only exists after data loads,
 * anything focus-dependent (`:focus-visible` needs a real browser — T-199a), and
 * contrast, which is audited separately against the tokens in `contrast.test.ts`
 * because axe cannot resolve a CSS custom property in jsdom.
 *
 * Critical and serious violations fail. Moderate and minor are reported and do
 * not, deliberately: axe's minor rules include advice that contradicts DESIGN.md
 * in places, and a scan that fails on advice is one somebody switches off.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';

import { AnswerOptionGroup } from '../components/AnswerOptionGroup';
import { AnswerView } from '../components/AnswerView';
import { Card } from '../components/Card';
import { CodeBlock } from '../components/CodeBlock';
import { ExamSummary } from '../components/ExamSummary';
import { ExamTimer } from '../components/ExamTimer';
import { JumpGrid } from '../components/JumpGrid';
import { PracticeCta } from '../components/PracticeCta';
import { ReadinessStatement } from '../components/ReadinessStatement';
import { RetireConfirmation } from '../components/RetireConfirmation';
import { ScoreTrend } from '../components/ScoreTrend';
import { SessionSummary } from '../components/SessionSummary';
import { WeightSumIndicator } from '../components/WeightSumIndicator';

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
}

/**
 * Runs axe over one rendered tree.
 *
 * `axe-core` is required inside the window rather than imported at module scope:
 * it binds to the `document` it finds when it loads, so a single import shared
 * across jsdom instances audits whichever page happened to be created first.
 */
/**
 * Axe's own source, read as **text**.
 *
 * `require('axe-core')` returns the module's exports — an axe bound to whatever
 * `document` existed when Node loaded it, which in a test runner is none. The
 * source has to be read off disk and evaluated inside each jsdom window so it
 * binds to the page actually being audited.
 */
const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

async function scan(element: ReactElement): Promise<Violation[]> {
  const dom = new JSDOM(
    /*
     * The wrapper is scaffolding, and it has to be a *valid* page or axe reports
     * the scaffolding rather than the component. `lang` and `<title>` are both
     * real in the app — set on `<html>` in the root layout and by the metadata
     * T-201 defines — and `layout.test.ts` asserts them. Leaving them out here
     * would report one document-title violation on every surface and drown the
     * findings that are actually about the components.
     */
    `<!doctype html><html lang="en"><head><title>Lomi-Test</title></head>` +
      `<body><main>${renderToStaticMarkup(element)}</main></body></html>`,
    // `runScripts` is required: jsdom does not execute injected scripts by
    // default, so `window.axe` is simply never defined and every scan reports a
    // clean page. Silent, and exactly the failure this test exists to avoid.
    { pretendToBeVisual: true, runScripts: 'dangerously' },
  );

  const { window } = dom;
  const script = window.document.createElement('script');
  script.textContent = AXE_SOURCE;
  window.document.head.appendChild(script);

  const axe = (
    window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<unknown> } }
  ).axe;

  const results = (await axe.run(window.document, {
    // Colour is audited against the tokens in `contrast.test.ts`; axe cannot
    // resolve a CSS custom property with no stylesheet loaded, so leaving it on
    // would produce confident nonsense.
    rules: { 'color-contrast': { enabled: false } },
  })) as { violations: { id: string; impact: string | null; help: string; nodes: unknown[] }[] };

  dom.window.close();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
  }));
}

const BLOCKING = new Set(['critical', 'serious']);

/** Every surface a student meets, in the state their browser paints first. */
const SURFACES: [name: string, element: ReactElement][] = [
  [
    'a question with its options',
    <>
      <p data-stem="">Which of these is a current asset?</p>
      <AnswerOptionGroup
        ariaLabel="Which of these is a current asset?"
        choices={[
          { label: 'A', text: 'Goodwill', state: 'default' },
          { label: 'B', text: 'Inventory', state: 'selected' },
          { label: 'C', text: 'Land', state: 'default' },
          { label: 'D', text: 'Patents', state: 'default' },
        ]}
        onSelect={() => undefined}
      />
    </>,
  ],
  [
    'the explanation',
    <AnswerView
      isCorrect={false}
      answer={{
        qType: 'CONCEPT',
        stem: 'Which of these is a current asset?',
        codeBlock: null,
        timeLimitSec: 60,
        chosenLabel: 'A',
        correctLabel: 'B',
        conceptLine: 'A current asset is realised within a year.',
        explanation: 'Inventory turns over inside the operating cycle.',
        steps: [],
        options: [
          { label: 'A', text: 'Goodwill', isCorrect: false, whyWrong: 'Goodwill is intangible.' },
          { label: 'B', text: 'Inventory', isCorrect: true, whyWrong: null },
          { label: 'C', text: 'Land', isCorrect: false, whyWrong: 'Land is not realised.' },
          { label: 'D', text: 'Patents', isCorrect: false, whyWrong: 'Patents are intangible.' },
        ],
      }}
    />,
  ],
  ['a code block', <CodeBlock code={'SELECT *\nFROM ledger;'} />],
  ['the exam timer', <ExamTimer remainingSec={240} durationSec={10800} />],
  [
    'the jump grid',
    <JumpGrid
      currentPosition={3}
      onJump={() => undefined}
      slots={[
        { position: 1, answered: true, flagged: false },
        { position: 2, answered: false, flagged: false },
        { position: 3, answered: false, flagged: false },
        { position: 4, answered: false, flagged: true },
      ]}
    />,
  ],
  [
    'the post-exam summary',
    <ExamSummary
      summary={{
        scoreCorrect: 4,
        answeredCount: 7,
        totalQuestions: 8,
        scorePct: 50,
        weakestTopic: 'Algorithms',
        weakestTopicId: 'id-a',
        topics: [
          {
            topicId: 'id-a',
            topic: 'Algorithms',
            asked: 4,
            correct: 3,
            scorePct: 75,
            weightPct: 40,
            weightedGapPct: 10,
          },
        ],
      }}
    />,
  ],
  [
    "today's practice",
    <SessionSummary
      summary={{
        answered: 8,
        correct: 5,
        scorePct: 62.5,
        weakestTopic: 'Tax',
        weakestTopicId: 'id-tax',
        topics: [
          {
            topicId: 'id-tax',
            topic: 'Tax',
            answered: 4,
            correct: 1,
            scorePct: 25,
            weightPct: 30,
          },
        ],
      }}
    />,
  ],
  [
    'the readiness statement',
    <ReadinessStatement
      statement={{
        rows: [{ topic: 'Algorithms', scorePct: 72, weightPct: 40 }],
        elided: { label: 'other topics', weightPct: 60, topicCount: 4 },
        headlinePct: 72,
        focus: [],
      }}
      practiceNext={{ topicId: 'id-a', topicName: 'Algorithms' }}
    />,
  ],
  [
    'the mock trend',
    <ScoreTrend
      points={[
        {
          sittingId: 's1',
          label: 'Mock 1',
          scorePct: 41,
          scoreCorrect: 41,
          totalQuestions: 100,
          unanswered: 0,
          ranOutOfTime: false,
        },
      ]}
    />,
  ],
  ['the practice call to action', <PracticeCta topicId="id-a" topicName="Algorithms" />],
  [
    'a card of plain text',
    <Card>
      <h1 className="text-title">Mock exam</h1>
      <p className="text-body">100 questions in 3 hours.</p>
    </Card>,
  ],
  [
    'the weight sum indicator',
    <WeightSumIndicator
      rows={[
        { topicId: 'a', topicName: 'A', weightPct: 34 },
        { topicId: 'b', topicName: 'B', weightPct: 33 },
      ]}
    />,
  ],
  [
    'the retire confirmation',
    <RetireConfirmation
      stableId="ACC-0142"
      radius={{ attempts: 1284, liveSittings: 3, studentsAffected: 340, measurable: true }}
      reason="Option B is also correct."
      onReasonChange={() => undefined}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />,
  ],
];

describe('accessibility (T-200)', () => {
  it('has surfaces to scan', () => {
    // Guards the list: a scan over nothing exits 0 and proves nothing.
    expect(SURFACES.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * The guard on the guard.
   *
   * Every surface passes, which is either because the components are sound or
   * because the scan is not looking. This is a real violation axe must still
   * catch — a button whose only content is an icon, with nothing to announce.
   */
  it('would catch a real violation', async () => {
    const broken = await scan(
      <button type="button">
        <span aria-hidden="true">x</span>
      </button>,
    );
    expect(broken.some((v) => BLOCKING.has(v.impact ?? ''))).toBe(true);
  });

  it.each(SURFACES)('%s has no critical or serious violations', async (_name, element) => {
    const violations = await scan(element);
    const blocking = violations.filter((v) => BLOCKING.has(v.impact ?? ''));
    const report = blocking.map((v) => `${v.impact} · ${v.id}: ${v.help} (${v.nodes})`).join('\n');
    expect(blocking, report).toEqual([]);
  });
});
