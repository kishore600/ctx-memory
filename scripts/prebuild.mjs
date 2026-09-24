import { rmSync } from "node:fs";

// tsc only adds/updates outputs for source files that still exist — it never deletes dist/
// output for a .ts file that's since been removed (e.g. src/generators/graphHtml.ts, dropped
// when viewgraph moved to the Next.js app). Clearing dist/ first guarantees no stale compiled
// files survive into a fresh build or a published tarball.
rmSync("dist", { recursive: true, force: true });
