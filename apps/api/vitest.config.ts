import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest transforms with esbuild by default, which honours
 * `experimentalDecorators` but **not** `emitDecoratorMetadata`. NestJS resolves
 * constructor dependencies from that metadata at runtime, so without it every
 * injected service arrives `undefined` and any DI-backed test fails with
 * "Cannot read properties of undefined".
 *
 * SWC emits the metadata, so the container behaves in tests exactly as it does
 * under `tsc` in production.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share one Postgres database; running files in parallel
    // lets one suite's cleanup delete another's fixtures mid-run.
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
