import { describe, expect, it } from 'vitest';

import { pickWeakestTopic, summarise, type AttemptRow, type TopicSummary } from './summary';

const a = (topic: string, isCorrect: boolean, weightPct: number | null = 10): AttemptRow => ({
  topic,
  weightPct,
  isCorrect,
});

describe('summarise (T-118)', () => {
  it('counts the score across everything answered', () => {
    const s = summarise([a('VAT', true), a('VAT', false), a('Payroll', true), a('Payroll', true)]);
    expect(s).toMatchObject({ answered: 4, correct: 3, scorePct: 75 });
  });

  it('breaks the score down per topic', () => {
    const s = summarise([
      a('VAT', true),
      a('VAT', false),
      a('Payroll', true),
      a('Payroll', true),
      a('Payroll', true),
    ]);
    expect(s.topics).toEqual([
      { topic: 'VAT', answered: 2, correct: 1, scorePct: 50, weightPct: 10 },
      { topic: 'Payroll', answered: 3, correct: 3, scorePct: 100, weightPct: 10 },
    ]);
  });

  // The list is a study order, so what to do next is at the top rather than
  // buried under what already went well.
  it('lists the weakest topic first', () => {
    const s = summarise([
      a('Good', true),
      a('Bad', false),
      a('Middling', true),
      a('Middling', false),
    ]);
    expect(s.topics.map((t) => t.topic)).toEqual(['Bad', 'Middling', 'Good']);
  });

  it('reports one decimal place rather than a repeating fraction', () => {
    const s = summarise([a('T', true), a('T', false), a('T', false)]);
    expect(s.scorePct).toBe(33.3);
  });

  it('is empty and safe before anything is answered', () => {
    const s = summarise([]);
    expect(s).toEqual({ answered: 0, correct: 0, scorePct: 0, topics: [], weakestTopic: null });
  });

  it('picks up a topic weight from any attempt that carries it', () => {
    const s = summarise([a('VAT', true, null), a('VAT', false, 25)]);
    expect(s.topics[0]!.weightPct).toBe(25);
  });
});

describe('the task’s own test — ten answers', () => {
  // Three topics, ten answers: VAT 1/4, Payroll 2/3, Audit 3/3.
  const TEN: AttemptRow[] = [
    a('VAT', true, 20),
    a('VAT', false, 20),
    a('VAT', false, 20),
    a('VAT', false, 20),
    a('Payroll', true, 30),
    a('Payroll', true, 30),
    a('Payroll', false, 30),
    a('Audit', true, 50),
    a('Audit', true, 50),
    a('Audit', true, 50),
  ];

  it('names the topic with the lowest weighted score', () => {
    const s = summarise(TEN);
    expect(s.answered).toBe(10);
    expect(s.correct).toBe(6);
    expect(s.weakestTopic).toBe('VAT');
    expect(s.topics[0]!.topic).toBe('VAT');
    expect(s.topics[0]!.scorePct).toBe(25);
  });
});

describe('pickWeakestTopic', () => {
  const t = (topic: string, scorePct: number, weightPct: number | null): TopicSummary => ({
    topic,
    scorePct,
    weightPct,
    answered: 4,
    correct: Math.round((scorePct / 100) * 4),
  });

  it('is the lowest score', () => {
    expect(pickWeakestTopic([t('A', 80, 10), t('B', 20, 10), t('C', 50, 10)])).toBe('B');
  });

  // Two topics at 50% are not equally worth an hour if one is a fifth of the
  // paper and the other a fortieth.
  it('breaks a tie on exam weight', () => {
    expect(pickWeakestTopic([t('Small', 50, 5), t('Big', 50, 40)])).toBe('Big');
  });

  // "No weight yet" is missing information; treating it as important would send
  // a student to revise something nobody has established matters.
  it('sorts an unweighted topic last on the tiebreak, not first', () => {
    expect(pickWeakestTopic([t('Unweighted', 50, null), t('Weighted', 50, 5)])).toBe('Weighted');
  });

  it('is deterministic when score and weight both tie', () => {
    const topics = [t('Zeta', 50, 10), t('Alpha', 50, 10)];
    expect(pickWeakestTopic(topics)).toBe('Alpha');
    expect(pickWeakestTopic([...topics].reverse())).toBe('Alpha');
  });

  it('is null with nothing answered', () => {
    expect(pickWeakestTopic([])).toBeNull();
  });

  it('does not mutate its input', () => {
    const topics = [t('B', 20, 10), t('A', 80, 10)];
    pickWeakestTopic(topics);
    expect(topics.map((x) => x.topic)).toEqual(['B', 'A']);
  });
});
