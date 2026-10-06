/**
 * Account (redesign step 10). Read as source text, like the other screen
 * guards here.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const screen = stripComments(readFileSync(resolve(here, 'AccountScreen.tsx'), 'utf8'));
const checkout = stripComments(readFileSync(resolve(here, '../checkout/page.tsx'), 'utf8'));

describe('Account', () => {
  it('still has code left after the comments are stripped', () => {
    expect(screen).toContain('api.devices(');
    expect(screen).toContain('api.mySubscription(');
  });

  /** English only, by decision; identity checks were dropped. */
  it('builds neither the language toggle nor the Fayda line', () => {
    expect(screen).not.toMatch(/አማርኛ|amharic/i);
    expect(screen).not.toMatch(/fayda/i);
  });

  /**
   * The display name saves through PATCH /me, and a refusal shows every
   * reason the server gave rather than a generic failure.
   */
  it('saves the display name and shows every reason it was refused', () => {
    expect(screen).toContain('api.updateDisplayName(value)');
    expect(screen).toContain("reasons.join(' ')");
    expect(screen).not.toContain('DISPLAY_NAME_EDITABLE');
  });

  /** "Log out" on the other devices; this one signs out at the foot. */
  it('offers to log out every device but this one', () => {
    const branch = screen.slice(screen.indexOf('{device.isCurrent ? ('));
    expect(branch.indexOf('thisDevice')).toBeGreaterThan(-1);
    expect(branch.indexOf('logOutDevice')).toBeGreaterThan(branch.indexOf('thisDevice'));
    expect(screen).toContain('<SignOutButton variant="danger" />');
  });

  it('shows the staff console only to staff', () => {
    expect(screen).toContain('me?.staffRole ?');
  });

  /** The device list moved here; checkout is about buying access now. */
  it('took the device list off checkout', () => {
    expect(checkout).not.toContain('AccountPanel');
  });
});
