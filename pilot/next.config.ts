import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Separate application root: never load the legacy app's routes or env files.
  poweredByHeader: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {serverActions: {bodySizeLimit: "4mb"}},
};
export default config;
