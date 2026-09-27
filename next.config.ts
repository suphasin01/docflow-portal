import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** ล็อกรากโปรเจกต์ที่ Beyond Doc เสมอ — อย่าใช้ process.cwd() เพราะ worker อาจได้ cwd = my-product */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const tailwindPkg = path.join(projectRoot, "node_modules/tailwindcss");

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: tailwindPkg,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: tailwindPkg,
    };
    return config;
  },
};

export default nextConfig;
