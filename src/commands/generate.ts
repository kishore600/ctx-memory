import path from "node:path";
import { getRepoRoot } from "../core/git.js";
import { listEntries, storeExists } from "../core/store.js";
import { CURSOR_RULE_PATH, ensureCursorRuleFile } from "../generators/agentConfig.js";
import { renderMemorySection, upsertMemorySection } from "../generators/agentsFile.js";

export type GenerateTarget = "claude" | "agents" | "cursor" | "all";

export interface GenerateOptions {
  target?: GenerateTarget;
}

export const GENERATE_TARGETS: GenerateTarget[] = ["claude", "agents", "cursor", "all"];

const ROOT_FILES: Record<"claude" | "agents", string> = {
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

  const target = opts.target ?? "all";
  if (!GENERATE_TARGETS.includes(target)) {
    console.error(`✖ Unknown target "${target}". Use one of: ${GENERATE_TARGETS.join(", ")}.`);
    process.exitCode = 1;
    return;
  }

  const entries = await listEntries(repoRoot);
  const section = renderMemorySection(entries);

  const targets: Exclude<GenerateTarget, "all">[] =
    target === "all" ? ["claude", "agents", "cursor"] : [target];

  for (const t of targets) {
    const filePath = t === "cursor" ? await ensureCursorRuleFile(repoRoot) : path.join(repoRoot, ROOT_FILES[t]);
    const result = await upsertMemorySection(filePath, section);
    const label = t === "cursor" ? CURSOR_RULE_PATH : ROOT_FILES[t];
    console.log(`✔ ${result === "created" ? "Created" : "Updated"} ${label}`);
  }
}
