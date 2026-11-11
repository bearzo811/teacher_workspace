import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Separate application root: never load the legacy app's routes or env files.
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname),
};
export default config;
