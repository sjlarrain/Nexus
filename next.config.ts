import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,

  // `next dev` otherwise appends its own block to CLAUDE.md on every run. That file
  // is the owner's working agreement (CLAUDE.md section 1) and should not be written
  // to by a build tool; its useful content is restated in section 3 instead.
  agentRules: false,
};

export default nextConfig;
