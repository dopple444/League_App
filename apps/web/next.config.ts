import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    cpus: 2,
  },
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@league/ui-tokens'],
};

export default nextConfig;
