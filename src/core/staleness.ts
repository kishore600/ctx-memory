import { computeFingerprint } from "./fingerprint.js";
import { countCommitsSince } from "./git.js";
import type { MemoryEntry } from "./schema.js";

export type StalenessLevel = "fresh" | "low" | "high" | "missing";

export interface RefStaleness {
  ref: string;
  level: StalenessLevel;
  commitsSince: number;
  reason: string;
}

export interface EntryStaleness {
  entry: MemoryEntry;
  refs: RefStaleness[];
  level: StalenessLevel;
}

const LEVEL_RANK: Record<StalenessLevel, number> = { fresh: 0, low: 1, missing: 2, high: 3 };

function worse(a: StalenessLevel, b: StalenessLevel): StalenessLevel {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;
}

export async function checkRef(
  repoRoot: string,
  ref: string,
  capturedCommit: string | null,
  capturedHash: string
): Promise<RefStaleness> {
  const current = await computeFingerprint(repoRoot, ref);

  if (current.kind === "missing") {
    return {
      ref,
      level: "missing",
      commitsSince: 0,
      reason: "referenced file or symbol no longer found",
    };
  }

  const commitsSince = await countCommitsSince(repoRoot, capturedCommit, ref.split("#")[0]);

  if (current.hash !== capturedHash) {
    return {
      ref,
      level: "high",
      commitsSince,
      reason: `content changed since capture (${commitsSince} commit${commitsSince === 1 ? "" : "s"} touched the file)`,
    };
  }

  if (commitsSince > 0) {
    return {
      ref,
      level: "low",
      commitsSince,
      reason: `${commitsSince} commit${commitsSince === 1 ? "" : "s"} touched the file since capture, but the referenced content is unchanged`,
    };
  }

  return { ref, level: "fresh", commitsSince: 0, reason: "unchanged" };
}

export async function checkEntry(repoRoot: string, entry: MemoryEntry): Promise<EntryStaleness> {
  const refs: RefStaleness[] = [];
  for (const ref of entry.frontmatter.refs) {
    const captured = entry.frontmatter.fingerprint[ref];
    if (!captured) {
      refs.push({ ref, level: "missing", commitsSince: 0, reason: "no fingerprint recorded at capture time" });
      continue;
    }
    refs.push(await checkRef(repoRoot, ref, entry.frontmatter.commit, captured.hash));
  }

  let level: StalenessLevel = "fresh";
  for (const r of refs) level = worse(level, r.level);
  if (refs.length === 0) level = "fresh";

  return { entry, refs, level };
}

export async function checkEntries(repoRoot: string, entries: MemoryEntry[]): Promise<EntryStaleness[]> {
  return Promise.all(entries.map((e) => checkEntry(repoRoot, e)));
}
