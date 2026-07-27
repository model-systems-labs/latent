import type { NextConfig } from "next";

const githubPagesBasePath = process.env.LATENT_GITHUB_PAGES_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = githubPagesBasePath
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
