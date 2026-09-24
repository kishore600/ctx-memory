import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app is launched by `whyanchor viewgraph` from an arbitrary installed location
  // (global install, npx cache, or a linked clone) and reads compiled files from the sibling
  // ../dist directory — outside this app's own folder — so file-tracing needs to look one
  // level up to find them.
  outputFileTracingRoot: path.join(appDir, ".."),
};

export default nextConfig;
