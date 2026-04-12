import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["172.28.0.1"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
