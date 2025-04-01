import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    output: 'export',
    basePath: '/app',
    distDir: 'dist'
};

export default nextConfig;
