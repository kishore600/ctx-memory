import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRepoRoot, isGitRepo } from "../core/git.js";
import { storeExists } from "../core/store.js";
import {
  AGENTS_FILE_PATH,
  CLAUDE_FILE_PATH,
  connectCodex,
  connectJsonAgent,
  defaultServerCommand,
  writeUsageInstructions,
  type Agent,
  type ConnectResult,
  type ServerCommand,
} from "../generators/agentConfig.js";

export interface ConnectOptions {
  agent?: string;
  command?: string;
  noInstructions?: boolean;
}

const ALL_AGENTS: Agent[] = ["claude", "cursor", "codex"];

function resolveCliPath(): string {
  // The absolute path of the CLI that is running right now — works whether ctx-memory was
  // globally linked, cloned from source, or referenced by path from another repo.
  return path.resolve(fileURLToPath(new URL("../cli.js", import.meta.url)));
}

function parseAgents(input?: string): Agent[] | null {
  if (!input || input === "all") return ALL_AGENTS;
  const requested = input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const invalid = requested.filter((a) => !ALL_AGENTS.includes(a as Agent));
  if (invalid.length) return null;
  return requested as Agent[];
}

function parseCommand(input: string): ServerCommand {
  const parts = input.split(" ").filter(Boolean);
  return { command: parts[0], args: parts.slice(1) };
}

export async function runConnect(cwd: string, opts: ConnectOptions): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    console.error("✖ Not a git repository. ctx-memory is git-backed — run `git init` first.");
    process.exitCode = 1;
    return;
  }

  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `memory init` first.");
    process.exitCode = 1;
    return;
  }

  const agents = parseAgents(opts.agent);
  if (!agents) {
    console.error(`✖ Unknown agent. Use one or more of: ${ALL_AGENTS.join(", ")} (or "all").`);
    process.exitCode = 1;
    return;
  }

  const server = opts.command ? parseCommand(opts.command) : defaultServerCommand(resolveCliPath());

  const results: ConnectResult[] = [];
  for (const agent of agents) {
    if (agent === "codex") {
      results.push(await connectCodex(repoRoot, server));
    } else {
      results.push(await connectJsonAgent(repoRoot, agent, server));
    }
  }

  for (const r of results) {
    const rel = path.relative(repoRoot, r.filePath);
    console.log(`✔ ${r.agent.padEnd(6)} ${r.action.padEnd(9)} ${rel}`);
  }

  if (!opts.noInstructions) {
    for (const fileName of [CLAUDE_FILE_PATH, AGENTS_FILE_PATH]) {
      const action = await writeUsageInstructions(repoRoot, fileName);
      console.log(`✔ ${"docs".padEnd(6)} ${action.padEnd(9)} ${fileName}`);
    }
  }

  console.log("");
  console.log(`Registered as "${server.command} ${server.args.join(" ")}".`);
  console.log("Restart your agent (or reopen the project) to pick up the new MCP server.");
  if (agents.includes("codex")) {
    console.log("Codex only reads project config for trusted projects — run `codex trust` here once.");
  }
}
