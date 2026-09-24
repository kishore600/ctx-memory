import { rmSync } from "node:fs";

// next build's webpack/turbopack cache (tens of MB) speeds up subsequent local builds but is
// never read by `next start` — it has no business in the published tarball. npm's "files"
// allowlist doesn't reliably honor .npmignore for files under a listed directory, so deleting
// it outright (rather than trying to pattern-exclude it) is the only reliable way to keep it
// out of what gets published.
rmSync("graph-app/.next/cache", { recursive: true, force: true });
