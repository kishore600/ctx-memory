import path from "node:path";
import { getRepoRoot, isGitRepo } from "../core/git.js";
import { initStore, storeExists } from "../core/store.js";

export async function runInit(cwd: string): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    console.error("✖ Not a git repository. ctx-memory is git-backed — run `git init` first.");
    process.exitCode = 1;
    return;
  }

  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (await storeExists(repoRoot)) {
    console.log(`Memory store already exists at ${path.join(repoRoot, ".memory")}`);
    return;
  }

  await initStore(repoRoot);
  console.log(`✔ Initialized memory store at ${path.join(repoRoot, ".memory")}`);
  console.log("");
  console.log("Next steps:");
  console.log("  memory connect     wire the MCP server into Claude Code / Cursor / Codex");
  console.log("  memory capture     capture a decision or piece of context");
  console.log("  memory generate    write captured entries into CLAUDE.md / AGENTS.md");
  console.log("  memory check       check captured entries for staleness");
}
