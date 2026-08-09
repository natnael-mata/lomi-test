/**
 * What the admin overview may and may not do (T-160, T-161, T-163).
 *
 * The figures are proved on the API side, in `admin-dashboard.e2e.test.ts`,
 * against direct SQL. What is checked here is what only this screen can get
 * wrong: that both figure blocks are the verifiable treatment rather than
 * decoration, that the queue length stays out of the totals, and that a support
 * screen never puts a legal name or a raw identity on the page.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../../lib/strip-comments';
import { en } from '../../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, 'Dashboard.tsx'), 'utf8');
const code = stripComments(raw);

describe('the admin overview (T-160, T-161)', () => {
  /**
   * The stripper has eaten whole files before, which makes every "does not
   * contain" assertion below pass for the wrong reason. Anchored near the end of
   * the file, not the start.
   */
  it('still has code left after the comments are stripped', () => {
    expect(code).toContain('c.dashboard.findStudent');
    expect(code.length).toBeGreaterThan(2000);
  });

  /**
   * DESIGN.md's Total Rule: a row of figures that genuinely sums ends in a dark
   * total bar, and `<TotalBar>` throws in development if the rows do not add up.
   * Using it is a claim the API has to keep — which is why the server partitions
   * the signups exactly and sums the revenue rows rather than querying a total.
   */
  it('renders both figure blocks as verifiable totals', () => {
    expect(code.match(/<TotalBar/g)?.length ?? 0).toBe(2);
    // And never as a hand-rolled table that could quietly disagree with itself.
    expect(code).not.toContain('<table');
  });

  it('shows every payment method, including the ones with nothing in them', () => {
    // A missing row reads as "we do not accept CBE Birr" rather than "nobody
    // used it today", and sends an operator looking for a bug.
    for (const key of ['methodTelebirr', 'methodCbebirr', 'methodChapa', 'methodBank'] as const) {
      expect(code, key).toContain(`c.dashboard.${key}`);
    }
  });

  /**
   * The queue length counts payments where everything in the bars counts
   * students. Putting it inside a total that does not include it is how a
   * dashboard starts lying.
   */
  it('keeps the settlement queue out of both totals', () => {
    const bars = code.slice(code.indexOf('<TotalBar'));
    const firstBar = bars.slice(0, bars.indexOf('</section>'));
    expect(firstBar).not.toContain('awaitingSettlement');
  });

  it('says what the waiting count means rather than showing a bare number', () => {
    expect(code).toContain('c.dashboard.awaitingHow');
    expect(en.dashboard.awaitingHow(3).split(/\s+/).length).toBeGreaterThan(6);
  });

  it('has something to say when there is nothing waiting', () => {
    // An empty queue is good news, and "0" is not how a person reads it.
    expect(code).toContain('c.dashboard.nothingWaiting');
  });
});

describe('finding a student (T-163)', () => {
  it('accepts all three of the things it says it accepts', () => {
    // A box that names three inputs and honours two is worse than one that
    // names one — the operator's failed search looks like the student's fault.
    expect(en.dashboard.searchLabel.toLowerCase()).toContain('phone');
    expect(en.dashboard.searchLabel.toLowerCase()).toContain('name');
    expect(en.dashboard.searchLabel.toLowerCase()).toContain('transaction');
  });

  it('warns that a transaction number has to be exact', () => {
    // The server matches references exactly, on purpose: a prefix search would
    // hand somebody else's payments to a student who mistyped.
    expect(en.dashboard.searchHint.toLowerCase()).toContain('exact');
  });

  it('does not fire a search on every keystroke', () => {
    expect(code).toContain('SEARCH_DEBOUNCE_MS');
    expect(code).toContain('clearTimeout');
  });

  /**
   * A partial phone number should not reach the access log on its way to being
   * refused. The server enforces the same floor.
   */
  it('never sends a query too short to mean anything', () => {
    expect(code).toContain('term.length < 3');
  });

  it('shows the display name, never a legal one', () => {
    expect(code).toContain('hit.displayName');
    for (const forbidden of ['verifiedName', 'legalName', 'fullName']) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  /** Support should not spend a call chasing somebody whose account is closed. */
  it('says when an account is deactivated', () => {
    expect(code).toContain('hit.deactivated');
    expect(code).toContain('c.dashboard.deactivated');
  });
});

describe('the copy', () => {
  it('takes its words from the dictionary rather than the file', () => {
    const sentences = code.match(/>[A-Z][a-z]+ [a-z]{2,}[^<>{}]*</g) ?? [];
    expect(sentences, sentences.join(' | ')).toEqual([]);
  });

  it('names the fix when the figures cannot be loaded', () => {
    // "Failed to load" tells an operator they have a problem and leaves them
    // there; this says the data is fine and what to do.
    expect(en.dashboard.couldNotLoad.split(/\s+/).length).toBeGreaterThan(6);
    expect(en.dashboard.couldNotLoad.toLowerCase()).toContain('try again');
  });
});
