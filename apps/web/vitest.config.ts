import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // See test/next-font-stub.ts: `next/font` is a build-time macro and is not
      // callable outside a Next build.
      'next/font/local': resolve(__dirname, 'test/next-font-stub.ts'),
    },
  },
});
