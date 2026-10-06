/**
 * No dashes in anything a person reads from the API or the bot (owner,
 * 2026-10-04; CLAUDE.md, Voice).
 *
 * The web app has enforced this since redesign step 12 in
 * `apps/web/components/voice.test.ts`, but the server's own sentences reach the
 * same people: refusals a student sees, the publish gate's blockers a reviewer
 * sees, import notes, provider health text, audit details, and every message
 * the bot sends. Em dash, en dash, minus sign and hyphenated words alike. The
 * product's name, Lomi-Exams, is the one exception, because it is a name.
 *
 * **Reads string literals through the TypeScript parser**, so comments are never
 * mistaken for copy (the files explain their rules at length, often with
 * dashes) and identifiers, routes and header names are skipped because they
 * contain no space. Only sentences are checked: a literal with whitespace in it.
 *
 * **Log lines are out of scope**, as the hand-off said: anything passed to a
 * Logger or console method, and a bare `new Error(...)`, which Nest turns into
 * a 500 whose text nobody outside the server reads. A custom error such as
 * `CsvError` is in scope, because its message is returned to the caller.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { ALL_RULES } from '../engagement/points';
import { gateBlockers } from '../questions/publish-gate';

const APPS = resolve(__dirname, '../../..');
const ROOTS = [join(APPS, 'api/src'), join(APPS, 'bot/src')];

/** The rule itself, shared by every check below. */
const DASH = /[—–−]|\b\w+-\w+\b/;
const hasDash = (text: string): boolean => DASH.test(text.replaceAll('Lomi-Exams', ''));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.ts$/.test(name) && !/\.test(-helper)?\.ts$/.test(name) ? [full] : [];
  });
}

/** A call whose arguments are a log line rather than a message to a person. */
const LOG_CALL = /(?:^|\.|\))(?:log|info|warn|error|debug|verbose|fatal)$/;

function isLogArgument(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression.getText(sf);
      return LOG_CALL.test(callee) && /console|log|Logger/i.test(callee);
    }
    if (ts.isNewExpression(p)) return p.expression.getText(sf) === 'Error';
    // A statement boundary: the literal is not an argument of anything.
    if (ts.isStatement(p)) return false;
  }
  return false;
}

interface Copy {
  where: string;
  text: string;
}

function sentencesIn(file: string): Copy[] {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: Copy[] = [];
  const visit = (node: ts.Node): void => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateExpression(node)) {
      // Placeholders become a word, so `${a}–${b}` is still seen as a range.
      text = node.head.text + node.templateSpans.map((s) => `x${s.literal.text}`).join('');
    }
    if (text !== null) {
      if (
        /\s/.test(text.trim()) &&
        !ts.isImportDeclaration(node.parent) &&
        !isLogArgument(node, sf)
      ) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        found.push({ where: `${relative(APPS, file)}:${line}`, text });
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const COPY: Copy[] = ROOTS.flatMap(sources).flatMap(sentencesIn);

describe('no dashes in what the API and bot say', () => {
  it('found sentences to check', () => {
    // A lint over zero strings passes forever.
    expect(COPY.length).toBeGreaterThan(100);
    expect(COPY.some((c) => c.where.startsWith('bot/'))).toBe(true);
  });

  it('uses no em dash, en dash, minus sign or hyphenated word', () => {
    const offenders = COPY.filter(({ text }) => hasDash(text)).map(
      ({ where, text }) => `${where}: "${text}"`,
    );
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /** The two places QA quoted, checked through the code that produces them. */
  it('holds for the publish gate blockers and the points ledger', () => {
    const blockers = [
      // Everything wrong at once: no answer, a two sentence concept line, no
      // steps, an unweighted topic, and the author reviewing their own work.
      ...gateBlockers({
        qType: 'CALCULATION',
        stem: 'What is the total?',
        options: [
          { label: 'A', text: '1', isCorrect: false, whyWrong: null },
          { label: 'B', text: '2', isCorrect: false, whyWrong: null },
        ],
        conceptLine: 'One. Two.',
        steps: [],
        authorId: 'u1',
        reviewerId: 'u1',
        topic: { name: 'Taxation', weightPct: null },
      }),
      // An answer, but a final step that never names it.
      ...gateBlockers({
        qType: 'CALCULATION',
        stem: 'What is the total?',
        options: [
          { label: 'A', text: '1', isCorrect: true },
          { label: 'B', text: '2', isCorrect: false, whyWrong: 'Because.' },
        ],
        conceptLine: 'One sentence.',
        steps: [{ stepNo: 1, text: 'Add them up.' }],
      }),
    ];
    expect(blockers.length).toBeGreaterThanOrEqual(6);
    const reasons = ALL_RULES.flatMap((rule) => [rule.reason(), rule.reason({ count: 3 })]);
    const offenders = [...blockers, ...reasons].filter(hasDash);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  // The guard on the guard: the rule must still catch the forms it bans.
  it('would reject a dash and leave the name alone', () => {
    for (const text of [
      'No correct option marked — a reviewer must confirm it.',
      'Grades 11–12',
      'It is −3',
      'Enter the six-digit code.',
    ]) {
      expect(hasDash(text), text).toBe(true);
    }
    for (const text of ['Open Lomi-Exams to answer it.', 'Enter the six digit code.']) {
      expect(hasDash(text), text).toBe(false);
    }
  });
});
