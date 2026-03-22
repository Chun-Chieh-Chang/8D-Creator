import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  basePath: "/8D-Creator",
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
