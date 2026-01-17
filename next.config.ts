import type { NextConfig } from "next";
// Only run > npm run build -> then place the contents of the out folder into the app folder

const nextConfig: NextConfig = {
    trailingSlash: true,
    output: 'export'
};

export default nextConfig;
