import type { NextConfig } from "next";

// One static site: the portfolio at /, the Scrapbook at /blog, the publication
// at /how. A later backend phase only needs to drop `output`.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { globalNotFound: true },
};

export default nextConfig;
