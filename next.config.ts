import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["astraworld.localhost"],
  turbopack: { root: process.cwd() },
};
export default config;
