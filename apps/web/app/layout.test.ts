import { describe, expect, it } from 'vitest';

import { metadata, viewport } from './layout';

describe('root layout', () => {
  it('carries the product name and a mobile viewport', () => {
    expect(metadata.title).toBe('Lomi-Test');
    // The real device is a low-end phone; a missing viewport makes every page
    // render at desktop width and shrink to unreadable.
    expect(viewport.width).toBe('device-width');
    expect(viewport.initialScale).toBe(1);
  });
});
