import { getRepoRoot } from "../core/git.js";
import { listEntries, storeExists } from "../core/store.js";

export interface ListOptions {
  tag?: string;
  json?: boolean;
}

export async function runList(cwd: string, opts: ListOptions): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `memory init` first.");
    process.exitCode = 1;
    return;
  }

  let entries = await listEntries(repoRoot);
  if (opts.tag) {
    entries = entries.filter((e) => e.frontmatter.tags.includes(opts.tag!));
  }

  if (opts.json) {
    console.log(JSON.stringify(entries.map((e) => e.frontmatter), null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log("No memory entries yet. Run `memory capture` to add one.");
    return;
  }

  for (const e of entries) {
    const f = e.frontmatter;
    const tags = f.tags.length ? ` [${f.tags.join(", ")}]` : "";
    const status = f.status !== "active" ? ` (${f.status})` : "";
    console.log(`${f.date}  ${f.id}  ${f.title}${tags}${status}`);
    if (f.refs.length) console.log(`           refs: ${f.refs.join(", ")}`);
  }
  console.log(`\n${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
}
