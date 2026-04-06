import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@agent-monitor/types'],
};

export default nextConfig;
