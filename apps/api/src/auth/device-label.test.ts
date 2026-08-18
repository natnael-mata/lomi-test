/**
 * What a device may be called (T-230).
 *
 * This became a boundary rather than a formatting nicety the moment the
 * provider's activity feed existed: `deviceLabel` is supplied by the client and
 * shown to somebody who is not its author, so it is untrusted text on an
 * oversight screen. The e2e case that plants an address in the column is what
 * found it; these are the rules that fix it, tested without a database.
 */
import { describe, expect, it } from 'vitest';

import { MAX_DEVICE_LABEL, safeDeviceLabel } from './device-label';

describe('safeDeviceLabel', () => {
  it('keeps the labels the product actually sends', () => {
    for (const label of [
      'Chrome on Android',
      'Safari on iOS',
      'Firefox on Linux',
      'Edge on Windows',
      'Web',
    ]) {
      expect(safeDeviceLabel(label)).toBe(label);
    }
  });

  /**
   * The case that prompted the whole file.
   *
   * Checked **before** cleaning, not after: stripping the punctuation out of
   * `203.0.113.44` first would leave `203011344`, which is still the address and
   * would still be stored.
   */
  it('refuses anything that reads as an address', () => {
    for (const address of [
      '203.0.113.44',
      '10.0.0.1',
      '192.168.1.7',
      '203.0.113.44:8080',
      'Chrome on 203.0.113.44',
      '2001:db8::1',
      'fe80::1ff:fe23:4567',
    ]) {
      expect(safeDeviceLabel(address), address).toBeNull();
    }
  });

  it('drops characters a device name has no use for', () => {
    // Angle brackets, quotes and braces: the punctuation that shows up when
    // somebody is trying to put markup or JSON somewhere it does not belong.
    // Parentheses survive — "Chrome (Beta)" is a real browser name — so what
    // is left is legible nonsense rather than markup.
    expect(safeDeviceLabel('<script>alert(1)</script>')).toBe('scriptalert(1)script');
    expect(safeDeviceLabel('Chrome "on" {Android}')).toBe('Chrome on Android');
  });

  it('caps the length', () => {
    const long = 'A'.repeat(500);
    expect(safeDeviceLabel(long)?.length).toBe(MAX_DEVICE_LABEL);
  });

  it('collapses whitespace rather than storing a shape', () => {
    expect(safeDeviceLabel('Chrome    on\n\nAndroid')).toBe('Chrome on Android');
  });

  /**
   * Null rather than a placeholder.
   *
   * A session with no label shows as an unnamed device, which is honest.
   * "Unknown device" would put a name on the student's device list that nobody
   * chose and that means nothing.
   */
  it('returns null rather than inventing a name', () => {
    expect(safeDeviceLabel(null)).toBeNull();
    expect(safeDeviceLabel(undefined)).toBeNull();
    expect(safeDeviceLabel('')).toBeNull();
    expect(safeDeviceLabel('   ')).toBeNull();
    // Nothing legible survives the filter, so there is nothing to call it.
    expect(safeDeviceLabel('<<>>')).toBeNull();
  });

  it('takes a non-string without throwing', () => {
    // The value arrives from a request body, so it is `unknown` however it is
    // typed. A guard that throws here turns a malformed sign-in into a 500.
    expect(safeDeviceLabel(42 as unknown as string)).toBeNull();
    expect(safeDeviceLabel({} as unknown as string)).toBeNull();
  });
});
