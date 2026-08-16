/**
 * How a date reads on screen.
 *
 * One function, because the product had two formats side by side: the rail said
 * `8/17/2027` and the receipt beside it said `Aug 17, 2027`, for the same day.
 * A student comparing the two has to work out whether they are looking at one
 * date or two, and the answer they reach about a date on a *payment* screen is
 * the one that costs support a phone call.
 *
 * `2-digit` day and `short` month rather than the locale's numeric default:
 * `8/9/2027` is August in Addis and September in London, and neither the
 * browser nor the student is required to know which convention the page picked.
 * A named month cannot be read two ways.
 *
 * The locale is left to the browser deliberately — Amharic is a first-class
 * language here (T-101), and `am-ET` renders its own month names through the
 * same call.
 */
export function day(iso: string | Date): string {
  const at = typeof iso === 'string' ? new Date(iso) : iso;
  return at.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Date and time, where two entries minutes apart are two different events. */
export function dayAndTime(iso: string | Date): string {
  const at = typeof iso === 'string' ? new Date(iso) : iso;
  return `${at.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${at.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}
