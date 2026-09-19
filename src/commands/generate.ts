import path from "node:path";
import { getRepoRoot } from "../core/git.js";
import { listEntries, storeExists } from "../core/store.js";
import { renderMemorySection, upsertMemorySection } from "../generators/agentsFile.js";

export interface GenerateOptions {
  target?: "claude" | "agents" | "both";
}

const FILE_NAMES: Record<"claude" | "agents", string> = {
  claude: "CLAUDE.md",
  agents: "AGENTS.md",
};

export async function runGenerate(cwd: string, opts: GenerateOptions): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `memory init` first.");
    process.exitCode = 1;
    return;
  }

  const entries = await listEntries(repoRoot);
  const section = renderMemorySection(entries);

  const target = opts.target ?? "both";
  const targets: ("claude" | "agents")[] = target === "both" ? ["claude", "agents"] : [target];

  for (const t of targets) {
    const filePath = path.join(repoRoot, FILE_NAMES[t]);
    const result = await upsertMemorySection(filePath, section);
    console.log(`✔ ${result === "created" ? "Created" : "Updated"} ${FILE_NAMES[t]}`);
  }
}
