import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Production builds write somewhere the dev server is not looking.
   *
   * `next build` and `next dev` both default to `.next`, so running the repo's
   * `npm run build` while a dev server is up **overwrites its chunk manifest**.
   * Every client chunk then 404s, the app renders server-side and never
   * hydrates, and it reads exactly like a broken component — it cost real time
   * twice before this line existed. `next build` sets NODE_ENV=production and
   * `next dev` sets development, so this separates them permanently.
   */
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  // The Telegram Mini App and the web PWA ship from this one build; the
  // surface is detected at runtime, not built separately.

  /**
   * The API is reached through this origin, never cross-origin.
   *
   * A rewrite rather than CORS on the Nest side. Same-origin means: no
   * preflight on every answer submission (a real cost on a slow Ethiopian
   * connection), no `Access-Control-Allow-Origin` list to keep in step with
   * every deploy environment, and the option of moving the session token to an
   * httpOnly cookie later without touching the client — which a cross-origin
   * setup makes awkward.
   */
  async rewrites() {
    const target = process.env.API_ORIGIN ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
};

export default nextConfig;
