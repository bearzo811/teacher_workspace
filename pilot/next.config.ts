import type { NextConfig } from "next";

const config: NextConfig = {
  // Separate application root: never load the legacy app's routes or env files.
  poweredByHeader: false,
};
export default config;
