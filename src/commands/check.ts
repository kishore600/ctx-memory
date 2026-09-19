import { getRepoRoot } from "../core/git.js";
import { checkEntries, type EntryStaleness, type StalenessLevel } from "../core/staleness.js";
import { listEntries, storeExists, updateEntryFrontmatter } from "../core/store.js";

export interface CheckOptions {
  json?: boolean;
  failOnStale?: boolean;
  write?: boolean;
}

const ICON: Record<StalenessLevel, string> = {
  fresh: "[ok]",
  low: "[low]",
  missing: "[missing]",
  high: "[STALE]",
};

export async function runCheck(cwd: string, opts: CheckOptions): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `memory init` first.");
    process.exitCode = 1;
    return;
  }

  const entries = await listEntries(repoRoot);
  const active = entries.filter((e) => e.frontmatter.status !== "superseded");
  const results = await checkEntries(repoRoot, active);

  if (opts.write) {
    const now = new Date().toISOString();
    for (const r of results) {
      const status = r.level === "high" || r.level === "missing" ? "stale" : "active";
      await updateEntryFrontmatter(r.entry, { last_checked: now, status });
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        results.map((r) => ({
          id: r.entry.frontmatter.id,
          title: r.entry.frontmatter.title,
          file: r.entry.filePath,
          level: r.level,
          refs: r.refs,
        })),
        null,
        2
      )
    );
  } else {
    printReport(results);
  }

  const staleCount = results.filter((r) => r.level === "high" || r.level === "missing").length;
  if (opts.failOnStale && staleCount > 0) {
    process.exitCode = 1;
  }
}

function printReport(results: EntryStaleness[]): void {
  if (results.length === 0) {
    console.log("No memory entries to check. Run `memory capture` to add one.");
    return;
  }

  for (const r of results) {
    console.log(`${ICON[r.level]} ${r.entry.frontmatter.title}  [${r.entry.frontmatter.id}]`);
    for (const ref of r.refs) {
      if (ref.level === "fresh") continue;
      console.log(`   ${ICON[ref.level]} ${ref.ref} — ${ref.reason}`);
    }
  }

  const counts = results.reduce<Record<StalenessLevel, number>>(
    (acc, r) => {
      acc[r.level]++;
      return acc;
    },
    { fresh: 0, low: 0, missing: 0, high: 0 }
  );

  console.log("");
  console.log(
    `${results.length} entries — ${counts.fresh} fresh, ${counts.low} low-confidence, ${counts.high} flagged, ${counts.missing} missing refs`
  );
}
