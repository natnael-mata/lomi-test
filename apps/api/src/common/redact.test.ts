import { describe, expect, it } from 'vitest';

import { PII_KEYS, REDACTED, formatLine, isSensitiveKey, redact, redactText } from './redact';

/** The seeded values the sweep below hunts for. */
const PHONE = '+251911223344';
const LOCAL_PHONE = '0911223344';
const FIN = '123456789012';
const LEGAL_NAME = 'Abebe Bekele';

describe('keeping personal data out of the logs (T-207)', () => {
  describe('by key', () => {
    it('catches the fields whose value is personal whatever it looks like', () => {
      for (const key of PII_KEYS) {
        expect(isSensitiveKey(key), key).toBe(true);
      }
    });

    /**
     * A legal name is unmatchable by pattern — "Abebe Bekele" is
     * indistinguishable from a topic title. Only the key knows what it holds,
     * which is why the key pass exists at all.
     */
    it('redacts a name it could never have recognised by value', () => {
      const out = redact({ name: LEGAL_NAME, topic: 'Financial Accounting' }) as Record<
        string,
        unknown
      >;
      expect(out.name).toBe(REDACTED);
      // And leaves the ordinary field alone: a logger that redacts everything
      // is one people turn off.
      expect(out.topic).toBe('Financial Accounting');
    });

    it('follows a key through nesting and casing', () => {
      expect(isSensitiveKey('legalName')).toBe(true);
      expect(isSensitiveKey('user.phone')).toBe(true);
      expect(isSensitiveKey('legal_name')).toBe(true);
      expect(isSensitiveKey('PHONE')).toBe(true);
    });

    it('leaves ordinary keys alone', () => {
      for (const key of ['topic', 'scorePct', 'questionId', 'attempts', 'fieldId']) {
        expect(isSensitiveKey(key), key).toBe(false);
      }
    });

    /**
     * Answer content, for a different reason than privacy: the bank is the asset
     * (T-205), and a log printing the key beside a question id is a copy of it
     * accumulating somewhere nobody is guarding.
     */
    it('redacts answer content and secrets too', () => {
      const out = redact({
        correctLabel: 'A',
        whyWrong: 'Because inventory is current.',
        token: 'ey.jwt.here',
      }) as Record<string, unknown>;
      expect(Object.values(out)).toEqual([REDACTED, REDACTED, REDACTED]);
    });
  });

  describe('by value', () => {
    /**
     * A phone pasted into a free-text message has no key at all. `Failed for
     * +251911223344` is a log line somebody will write.
     */
    it('catches a phone number inside prose', () => {
      expect(redactText(`Failed for ${PHONE}`)).not.toContain(PHONE);
      expect(redactText(`Failed for ${PHONE}`)).toContain(REDACTED);
    });

    it('catches both forms students actually type', () => {
      expect(redactText(LOCAL_PHONE)).toBe(REDACTED);
      expect(redactText('+251 91 122 3344')).toContain(REDACTED);
    });

    it('catches a long digit run, which is what an identity number looks like', () => {
      expect(redactText(`fin=${FIN}`)).not.toContain(FIN);
    });

    /**
     * Deliberately few patterns: every one risks mangling a useful log line.
     * Scores, counts and ids are the ordinary content of a log and must survive.
     */
    it('leaves short numbers alone', () => {
      for (const safe of ['scored 42', 'position 7', '3 sittings', '100%', 'Br 500']) {
        expect(redactText(safe), safe).toBe(safe);
      }
    });

    it('leaves a cuid alone', () => {
      const id = 'ckt0p1c1d0000abcd1234efgh';
      expect(redactText(id)).toBe(id);
    });
  });

  describe('redacting a whole value', () => {
    it('reaches into nested objects and arrays', () => {
      const out = redact({
        users: [{ phone: PHONE, displayName: 'BlueLion1234' }],
        note: `called ${PHONE}`,
      }) as { users: { phone: string; displayName: string }[]; note: string };
      expect(out.users[0]!.phone).toBe(REDACTED);
      expect(out.users[0]!.displayName).toBe('BlueLion1234');
      expect(out.note).not.toContain(PHONE);
    });

    /**
     * Replaced, not deleted. `phone: [redacted]` still tells an engineer a phone
     * was involved; a field silently missing looks like a bug in the code that
     * wrote it.
     */
    it('replaces rather than removing the field', () => {
      const out = redact({ phone: PHONE }) as Record<string, unknown>;
      expect(Object.keys(out)).toEqual(['phone']);
      expect(out.phone).toBe(REDACTED);
    });

    it('redacts the message of an Error, where a phone ends up', () => {
      const out = redact(new Error(`no user for ${PHONE}`)) as { message: string };
      expect(out.message).not.toContain(PHONE);
    });

    /**
     * A request object references itself. Throwing here would mean a logger that
     * crashes the thing it is logging — the worst possible failure for a
     * component whose whole job is to report failures.
     */
    it('survives a cycle', () => {
      const cyclic: Record<string, unknown> = { phone: PHONE };
      cyclic.self = cyclic;
      expect(() => redact(cyclic)).not.toThrow();
      const out = redact(cyclic) as Record<string, unknown>;
      expect(out.phone).toBe(REDACTED);
      expect(out.self).toBe('[circular]');
    });

    it('passes through primitives untouched', () => {
      expect(redact(42)).toBe(42);
      expect(redact(true)).toBe(true);
      expect(redact(null)).toBeNull();
      expect(redact(undefined)).toBeUndefined();
    });
  });

  describe('the log line itself', () => {
    it('is JSON, so it can be queried rather than grepped', () => {
      const line = JSON.parse(formatLine('info', 'signed in', { userId: 'u1' })) as {
        level: string;
        message: string;
        context: { userId: string };
      };
      expect(line.level).toBe('info');
      expect(line.message).toBe('signed in');
      expect(line.context.userId).toBe('u1');
    });

    /** T-207's stated test, as a unit: seed every PII value, find none of them. */
    it('carries no seeded PII through, in the message or the context', () => {
      const line = formatLine('error', `sign-in failed for ${PHONE}`, {
        phone: LOCAL_PHONE,
        name: LEGAL_NAME,
        fin: FIN,
        nested: { user: { legalName: LEGAL_NAME } },
      });
      for (const secret of [PHONE, LOCAL_PHONE, FIN, LEGAL_NAME]) {
        expect(line, `${secret} reached the log`).not.toContain(secret);
      }
    });

    it('omits the context key entirely when there is none', () => {
      expect(JSON.parse(formatLine('info', 'started'))).toEqual({
        level: 'info',
        message: 'started',
      });
    });
  });
});
