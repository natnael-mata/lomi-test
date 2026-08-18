/**
 * What a device may be called.
 *
 * **The schema says "Never an IP" and nothing enforced it.** `deviceLabel` is
 * supplied by the client — `POST /auth/login-link` and the Telegram sign-in both
 * take it straight from the request body — so it is whatever the caller sends.
 * The web app sends "Chrome on Android"; a caller that is not the web app can
 * send an address, a legal name, or a paragraph, and it would be stored.
 *
 * That was survivable while the only reader was the student's own device list.
 * The provider's activity feed made it a leak: text one person controls,
 * displayed to another, on the screen whose whole purpose is oversight. The
 * `provider.e2e.test.ts` case that plants an address in the column is what
 * caught it.
 *
 * So this constrains it **where it is written**, not where it is shown. A
 * display-side filter leaves the address in the database, findable by the next
 * thing that reads the column and by anyone with the backup.
 *
 * The rule is narrow on purpose: this is a label somebody reads to answer "is
 * that the laptop I am sitting at". It needs letters, digits, spaces and a
 * little punctuation. It does not need forty characters of anything else.
 */

/** Long enough for "Chrome on Windows", short enough that nothing hides in it. */
export const MAX_DEVICE_LABEL = 40;

/**
 * Anything that reads as a network address.
 *
 * Four dotted numbers, or a run of hex groups separated by colons. Deliberately
 * broad — `10.0.0.1`, `203.0.113.44:8080` and `2001:db8::1` all match, and a
 * false positive costs a device called something unusual, which is a device
 * called "Web" instead.
 */
const ADDRESS = /(\b\d{1,3}(\.\d{1,3}){3}\b)|(\b[0-9a-f]{1,4}(:[0-9a-f]{0,4}){2,}\b)/i;

/**
 * Everything a device name is allowed to contain.
 *
 * Parentheses stay — "Chrome (Beta)" is a real thing a browser calls itself.
 * The slash does not: nothing here needs one, and it is the character that
 * turns up in paths and in the raw user-agent strings this is meant to keep
 * out.
 */
const ALLOWED = /[^A-Za-z0-9 .()\-–—+]/g;

/**
 * The label to store, or `null` for "do not store one".
 *
 * `null` rather than a placeholder: a session with no label shows as an unnamed
 * device, which is honest. Substituting "Unknown device" would put a name on
 * the list that nobody chose and that means nothing.
 */
export function safeDeviceLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Checked before cleaning, not after: stripping the dots out of an address
  // first would turn `203.0.113.44` into `203011344` and store it.
  if (ADDRESS.test(trimmed)) return null;

  /*
   * Whitespace is normalised BEFORE the characters are stripped.
   *
   * The other order silently joins words: a newline is not in the allowed set,
   * so stripping first turns "Chrome on\nAndroid" into "Chrome onAndroid" — a
   * label that reads as a typo rather than as a sanitised string.
   */
  const cleaned = trimmed.replace(/\s+/g, ' ').replace(ALLOWED, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return null;

  return cleaned.slice(0, MAX_DEVICE_LABEL);
}
