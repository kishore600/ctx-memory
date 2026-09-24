import { NextResponse } from "next/server";
// Imported from the compiled CLI output, not ../../../src — this app ships prebuilt inside the
// published whyanchor package, and importing already-compiled JS sidesteps any question of
// whether Next's bundler understands the CLI's NodeNext-style ".js"-suffixed TS imports.
// `whyanchor viewgraph` always runs `tsc` before `next build`, so dist/ is guaranteed to exist.
import { buildGraph } from "../../../../dist/core/graph.js";
import { listEntries, storeExists } from "../../../../dist/core/store.js";

export async function GET(request: Request): Promise<NextResponse> {
  const repoRoot = process.env.WHYANCHOR_REPO_ROOT;
  if (!repoRoot) {
    return NextResponse.json({ error: "WHYANCHOR_REPO_ROOT is not set" }, { status: 500 });
  }
  if (!(await storeExists(repoRoot))) {
    return NextResponse.json({ error: `No memory store found at ${repoRoot}` }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");

  let entries = await listEntries(repoRoot);
  if (tag) entries = entries.filter((e) => e.frontmatter.tags.includes(tag));

  const graph = buildGraph(entries);
  return NextResponse.json(graph);
}
