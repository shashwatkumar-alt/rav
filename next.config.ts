import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['jspdf', 'fflate'],
  turbopack: {
    resolveAlias: {
      // Prevent Turbopack from trying to resolve fflate's Node.js Worker during SSR
      './node.cjs': './browser.cjs',
    },
  },
};

export default nextConfig;
