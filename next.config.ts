import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // libSQL loads a native module; keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  images: {
    loader: "custom",
    loaderFile: "./lib/cloudinary/loader.ts",
  },
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
