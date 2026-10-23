import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind CSS v4 chạy qua Turbopack (bundler mặc định của Next.js 16)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
