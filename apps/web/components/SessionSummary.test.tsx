import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SessionSummary, type SessionSummaryData } from './SessionSummary';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, 'SessionSummary.tsx'), 'utf8');

const summary = (over: Partial<SessionSummaryData> = {}): SessionSummaryData => ({
  answered: 10,
  correct: 6,
  scorePct: 60,
  topics: [
    { topicId: 'id-VAT', topic: 'VAT', answered: 4, correct: 1, scorePct: 25, weightPct: 20 },
    { topicId: 'id-Audit', topic: 'Audit', answered: 6, correct: 5, scorePct: 83.3, weightPct: 50 },
  ],
  weakestTopic: 'VAT',
  weakestTopicId: 'id-VAT',
  ...over,
});

describe('SessionSummary (T-118)', () => {
  it('renders a summary', () => {
    expect(() => SessionSummary({ summary: summary() })).not.toThrow();
  });

  it('renders the empty case rather than a zero score', () => {
    expect(() =>
      SessionSummary({
        summary: summary({ answered: 0, correct: 0, topics: [], weakestTopic: null }),
      }),
    ).not.toThrow();
    expect(source).toContain('Nothing answered yet');
  });

  // A proportion of questions answered is not a column that sums, so it takes
  // the stated treatment and never a total bar (T-096).
  it('uses StatedFigure, not TotalBar', () => {
    expect(source).toContain('<StatedFigure');
    expect(source).not.toContain('TotalBar');
  });

  // A study order, not a scoreboard: the thing to do next is at the top, and it
  // is labelled as an action rather than as a failure.
  it('marks the weakest topic as what to practise next', () => {
    expect(source).toContain('Practise next');
    expect(source).toContain('topic.topic === summary.weakestTopic');
  });

  // T-097a: never "% of exam".
  it('captions weights as share of past papers', () => {
    expect(source).toContain('share of past papers');
    expect(source).not.toMatch(/%\s*of\s*(the\s*)?exam/i);
  });

  it('omits the caption for an unweighted topic rather than printing null', () => {
    expect(source).toContain('topic.weightPct !== null &&');
    expect(() =>
      SessionSummary({
        summary: summary({
          topics: [
            {
              topicId: 'id-New',
              topic: 'New',
              answered: 1,
              correct: 0,
              scorePct: 0,
              weightPct: null,
            },
          ],
          weakestTopic: 'New',
          weakestTopicId: 'id-New',
        }),
      }),
    ).not.toThrow();
  });
});
