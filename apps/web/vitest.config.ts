import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The automatic JSX runtime, so a component can be called or rendered in a
  // test without `import React`. The classic runtime compiles JSX to
  // `React.createElement` and fails with "React is not defined" — which reads
  // like a missing import in the component rather than a test-config choice.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      // See test/next-font-stub.ts: `next/font` is a build-time macro and is not
      // callable outside a Next build.
      'next/font/local': resolve(__dirname, 'test/next-font-stub.ts'),
    },
  },
});
