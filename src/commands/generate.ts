import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "../core/git.js";
import { listEntries, storeExists } from "../core/store.js";
import {
  AGENTS_FILE_PATH,
  CLAUDE_FILE_PATH,
  CLAUDE_LEGACY_ROOT_PATH,
  CURSOR_RULE_PATH,
  ensureCursorRuleFile,
  hasLegacyRootClaudeFile,
} from "../generators/agentConfig.js";
import { renderMemorySection, upsertMemorySection } from "../generators/agentsFile.js";

export type GenerateTarget = "claude" | "agents" | "cursor" | "all";

export interface GenerateOptions {
  target?: GenerateTarget;
}

export const GENERATE_TARGETS: GenerateTarget[] = ["claude", "agents", "cursor", "all"];

const TARGET_PATHS: Record<Exclude<GenerateTarget, "all">, string> = {
  claude: CLAUDE_FILE_PATH,
  agents: AGENTS_FILE_PATH,
  cursor: CURSOR_RULE_PATH,
};

export async function runGenerate(cwd: string, opts: GenerateOptions): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `whyanchor init` first.");
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
    const relPath = TARGET_PATHS[t];
    const filePath = path.join(repoRoot, relPath);
    if (t === "cursor") {
      await ensureCursorRuleFile(repoRoot);
    } else {
      await mkdir(path.dirname(filePath), { recursive: true });
    }
    const result = await upsertMemorySection(filePath, section);
    console.log(`✔ ${result === "created" ? "Created" : "Updated"} ${relPath}`);
  }

  if (targets.includes("claude") && (await hasLegacyRootClaudeFile(repoRoot))) {
    console.warn(
      `⚠ ${CLAUDE_LEGACY_ROOT_PATH} still exists at the repo root. Claude Code loads it ` +
        `alongside ${CLAUDE_FILE_PATH}, so your notes will be injected twice — delete the root one.`
    );
  }
}
