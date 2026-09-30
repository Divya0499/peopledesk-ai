import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "top-right",
  },
  // Load pdf-parse from node_modules instead of bundling it,
  // so its PDF worker file can be found at runtime
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
