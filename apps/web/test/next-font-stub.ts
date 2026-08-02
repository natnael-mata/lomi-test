/**
 * Stub for `next/font/local` under Vitest.
 *
 * `next/font` is a build-time macro: Next's SWC plugin rewrites the call, reads
 * the font file and emits the `@font-face`. Outside a Next build the import is
 * not a callable function at all, so anything importing `layout.tsx` — including
 * a test that only reads `metadata` — throws.
 *
 * The stub returns the same shape with recognisable values, so a test asserting
 * on a real font's metrics would fail loudly rather than pass against a fake.
 * What the real thing does is verified in the browser instead (T-091), where it
 * is the only place it can be.
 */
export default function localFont(options: { variable?: string }): {
  className: string;
  variable: string;
  style: { fontFamily: string };
} {
  const variable = options.variable ?? '--font-stub';
  return {
    className: `stub-${variable.replace(/^--/, '')}`,
    variable: `stub-${variable.replace(/^--/, '')}`,
    style: { fontFamily: 'stub-font-not-loaded-under-vitest' },
  };
}
