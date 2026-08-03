import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CodeBlock } from './CodeBlock';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, 'CodeBlock.tsx'), 'utf8');
const answerView = readFileSync(resolve(HERE, 'AnswerView.tsx'), 'utf8');

describe('CodeBlock (T-116)', () => {
  it('renders', () => {
    expect(() => CodeBlock({ code: 'nav ul { margin: 0; }' })).not.toThrow();
  });

  // The page must never scroll sideways on a phone; the well scrolls instead.
  it('scrolls itself horizontally rather than the page', () => {
    expect(source).toContain('overflow-x-auto');
  });

  // Wrapping code changes what it says: an indented block that rewraps mid-line
  // is a different program to a student reading it.
  it('does not wrap', () => {
    expect(source).toContain('whitespace-pre');
    expect(source).not.toContain('whitespace-pre-wrap');
  });

  // A scrollable region that cannot be focused is unreachable without a mouse.
  it('is reachable by keyboard and named for a screen reader', () => {
    expect(source).toMatch(/tabIndex=\{0\}/);
    expect(source).toContain('aria-label');
    expect(source).toContain('role="region"');
  });

  it('sits in its own well, not inline with prose', () => {
    expect(source).toContain('bg-surface-2');
    expect(source).toContain('font-mono');
  });

  it('is rendered by the answer view when a question carries code', () => {
    expect(answerView).toContain('<CodeBlock');
    expect(answerView).toMatch(/answer\.codeBlock &&/);
  });
});

describe('the entrance animation (T-117)', () => {
  // The spring is the answer moment. Anything else moving at the same time
  // competes with it, and a page where four things animate reads as slow.
  it('is applied to the verdict and to nothing else', () => {
    const occurrences = [...answerView.matchAll(/animate-pop/g)].length;
    expect(occurrences).toBe(1);

    const verdictBlock = answerView.slice(
      answerView.indexOf('data-section="verdict"'),
      answerView.indexOf('data-section="concept"'),
    );
    expect(verdictBlock).toContain('animate-pop');
  });

  it('uses no other entrance animation anywhere in the view', () => {
    for (const other of ['animate-rise', 'animate-draw', 'animate-bounce', 'animate-pulse']) {
      expect(answerView).not.toContain(other);
    }
  });

  it('is defined as a single spring pass in the theme', () => {
    const theme = readFileSync(resolve(HERE, '../../../design-system/tailwind-theme.css'), 'utf8');
    expect(theme).toMatch(/--animate-pop:\s*pop\s+0\.26s\s+var\(--ease-spring\)\s+both/);
    expect(theme).toMatch(/--ease-spring:\s*cubic-bezier\(0\.34,\s*1\.4,\s*0\.64,\s*1\)/);
  });
});
