import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Telegram Mini App and the web PWA ship from this one build; the
  // surface is detected at runtime, not built separately.
};

export default nextConfig;
