import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let cached: string | null = null;

/**
 * The package version, read from package.json at runtime rather than hardcoded — so `whyanchor
 * --version` and the MCP server's reported version can't drift from what actually got published.
 * Resolved relative to this compiled file (dist/core/version.js -> ../../package.json), which
 * holds regardless of install method: source checkout, `npm link`, `npm install -g`, or `npx`.
 */
export function getVersion(): string {
  if (cached) return cached;
  const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  cached = pkg.version ?? "0.0.0";
  return cached;
}
