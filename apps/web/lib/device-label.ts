/**
 * A name for this device, for the account's list of signed in devices.
 *
 * Every row there read "Unknown device": neither door sent a label, and the
 * server only stores what it is given. Browser and system, worked out from the
 * user agent, is enough for a student to tell their phone from a lab computer.
 * Nothing finer: a model number is a fingerprint, and this list is for
 * recognising, not identifying. The server cleans it again either way.
 */
export function deviceLabel(
  ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  const system = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iPhone'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? '';
}
