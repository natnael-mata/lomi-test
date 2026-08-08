/**
 * Keeping personal data out of the logs (T-207).
 *
 * Logs are the leak nobody plans. They go to a third-party aggregator, they are
 * read by whoever is on call, they are pasted into a chat when somebody asks for
 * help, and they outlive the incident by months. This product holds a phone
 * number, a legal name and — once Phase 8 lands — a Fayda FIN, which is a
 * national identity number. None of those may reach a log line.
 *
 * **Two passes, because either alone is insufficient.**
 *
 * 1. **By key.** A field called `name` holds a legal name, and nothing about the
 *    value says so — "Abebe Bekele" is indistinguishable from a topic title.
 *    Only the key knows.
 * 2. **By value.** A phone number pasted into a free-text error message has no
 *    key at all. `Failed for +251911223344` is a log line somebody will write.
 *
 * Redaction replaces rather than deletes. A line reading `phone: [redacted]`
 * still says a phone was involved, which is what an engineer needs; a line with
 * the field silently missing looks like a bug in the code that wrote it.
 */

/**
 * Keys whose value is personal whatever it looks like.
 *
 * Matched case-insensitively against the whole key, and against the tail after a
 * dot or underscore, so `user.phone` and `legal_name` are caught too.
 */
export const PII_KEYS = [
  'phone',
  'phonenumber',
  'name',
  'legalname',
  'fullname',
  'firstname',
  'lastname',
  'fin',
  'faydafin',
  'finhash',
  'nationalid',
  'email',
  'telegramusername',
] as const;

/**
 * Keys that carry answer content.
 *
 * Not personal, but the same rule applies for a different reason: the bank is
 * the asset (T-205), and a log that prints the key alongside the question id is
 * a copy of it accumulating somewhere nobody is guarding.
 */
export const SECRET_KEYS = [
  'correctlabel',
  'whywrong',
  'explanation',
  'conceptline',
  'pollsecret',
  'pollsecrethash',
  'token',
  'authorization',
  'initdata',
  'jwtsecret',
  'botsharedsecret',
] as const;

export const REDACTED = '[redacted]';

const BANNED = new Set<string>([...PII_KEYS, ...SECRET_KEYS]);

/** Whether a key's value must never be logged. */
export function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z]/g, '');
  if (BANNED.has(normalised)) return true;
  // `user_phone`, `student.legalName` — the tail is what names the thing.
  const tail = key.toLowerCase().split(/[._-]/).pop() ?? '';
  return BANNED.has(tail.replace(/[^a-z]/g, ''));
}

/**
 * Value patterns that are personal wherever they appear.
 *
 * Deliberately few. Every pattern here risks a false positive that mangles a log
 * line, so this covers only the shapes that are unambiguous in this product:
 *
 * - Ethiopian phone numbers, in the two forms students actually type.
 * - Long unbroken digit runs, which is what a national identity number looks
 *   like. **Not** applied to short numbers, because scores, counts and ids are
 *   the ordinary content of a useful log.
 */
const VALUE_PATTERNS: [RegExp, string][] = [
  // +251 9xx xxx xxx and 09xx xxx xxx, with or without separators.
  [/\+251[\s-]?\d[\d\s-]{7,12}\d/g, REDACTED],
  [/\b0[79]\d{8}\b/g, REDACTED],
  // 10+ consecutive digits: a FIN, never a score.
  [/\b\d{10,}\b/g, REDACTED],
];

/** Replaces personal-looking substrings inside free text. */
export function redactText(text: string): string {
  return VALUE_PATTERNS.reduce((acc, [pattern, with_]) => acc.replace(pattern, with_), text);
}

/**
 * Redacts a value of any shape, recursively.
 *
 * Cycles are handled with a seen-set rather than a depth limit: a request object
 * references itself, and the alternative — throwing — would mean a logger that
 * crashes the thing it is logging.
 */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  // Errors are not plain objects; their message is where a phone number ends up.
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(item, seen);
  }
  return out;
}

/** One log line, as JSON, with everything personal already gone. */
export function formatLine(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: unknown,
): string {
  const line: Record<string, unknown> = {
    level,
    message: redactText(message),
  };
  if (context !== undefined) line.context = redact(context);
  return JSON.stringify(line);
}
