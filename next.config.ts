import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit out of webpack bundles so font files resolve correctly if using default entry.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
