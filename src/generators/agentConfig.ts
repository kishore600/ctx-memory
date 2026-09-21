import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { upsertMarkedSection } from "./agentsFile.js";

export const SERVER_NAME = "ctx-memory";

export const USAGE_START = "<!-- ctx-memory:usage:start -->";
export const USAGE_END = "<!-- ctx-memory:usage:end -->";
const MEMORY_START = "<!-- ctx-memory:start -->";

export interface ServerCommand {
  command: string;
  args: string[];
}

export type Agent = "claude" | "cursor" | "codex";

export interface ConnectResult {
  agent: Agent;
  filePath: string;
  action: "created" | "updated" | "unchanged";
}

/**
 * The command a spawned MCP client should run. Defaults to the absolute path of the
 * currently-executing CLI, which works regardless of how ctx-memory was installed
 * (linked globally, cloned from source, or referenced by path from another repo).
 */
export function defaultServerCommand(cliPath: string): ServerCommand {
  return { command: "node", args: [cliPath, "mcp"] };
}

function mcpJsonPath(repoRoot: string, agent: "claude" | "cursor"): string {
  return agent === "claude" ? path.join(repoRoot, ".mcp.json") : path.join(repoRoot, ".cursor", "mcp.json");
}

/** Merges the server into a JSON MCP config, preserving every other server already configured. */
export async function connectJsonAgent(
  repoRoot: string,
  agent: "claude" | "cursor",
  server: ServerCommand
): Promise<ConnectResult> {
  const filePath = mcpJsonPath(repoRoot, agent);

  let config: Record<string, unknown> = {};
  let existed = false;
  try {
    const raw = await readFile(filePath, "utf8");
    existed = true;
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    if (existed) {
      // The file is there but unparseable — refuse rather than overwrite someone's config.
      throw new Error(`${filePath} exists but is not valid JSON. Fix or remove it, then re-run.`);
    }
  }

  const rawServers = config.mcpServers;
  const servers = (
    rawServers && typeof rawServers === "object" && !Array.isArray(rawServers) ? rawServers : {}
  ) as Record<string, ServerCommand>;
  const current = servers[SERVER_NAME];
  if (current && current.command === server.command && JSON.stringify(current.args) === JSON.stringify(server.args)) {
    return { agent, filePath, action: "unchanged" };
  }

  servers[SERVER_NAME] = server;
  config.mcpServers = servers;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return { agent, filePath, action: existed ? "updated" : "created" };
}

function tomlTable(server: ServerCommand): string {
  const args = server.args.map((a) => JSON.stringify(a)).join(", ");
  return [`[mcp_servers.${SERVER_NAME}]`, `command = ${JSON.stringify(server.command)}`, `args = [${args}]`].join("\n");
}

/**
 * Codex uses TOML, not the JSON shape Claude Code and Cursor share. A new `[table]` header
 * always opens a fresh scope, so appending is safe; an existing ctx-memory table is replaced
 * in place so re-running stays idempotent.
 */
export async function connectCodex(repoRoot: string, server: ServerCommand): Promise<ConnectResult> {
  const filePath = path.join(repoRoot, ".codex", "config.toml");
  const table = tomlTable(server);

  let existing = "";
  let existed = false;
  try {
    existing = await readFile(filePath, "utf8");
    existed = true;
  } catch {
    existed = false;
  }

  if (!existed) {
    const header = [
      "# Project-scoped MCP config for Codex CLI. Codex only reads this for projects you've",
      "# marked as trusted — run `codex trust` on this directory once.",
      "",
    ].join("\n");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, header + table + "\n", "utf8");
    return { agent: "codex", filePath, action: "created" };
  }

  // Find the table by exact header line and run to the next table header — not by regex over
  // the raw text, because an `args = [...]` value contains '[' and would end the match early.
  const lines = existing.split("\n");
  const header = `[mcp_servers.${SERVER_NAME}]`;
  const startLine = lines.findIndex((l) => l.trim() === header);

  let next: string;
  if (startLine !== -1) {
    let endLine = lines.length;
    for (let i = startLine + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith("[")) {
        endLine = i;
        break;
      }
    }
    const before = lines.slice(0, startLine).join("\n");
    const after = lines.slice(endLine).join("\n");
    const replaced = (before ? before + "\n" : "") + table + "\n" + (after ? "\n" + after.replace(/^\n+/, "") : "");
    if (replaced.trim() === existing.trim()) return { agent: "codex", filePath, action: "unchanged" };
    next = replaced;
  } else {
    next = existing.trimEnd() + "\n\n" + table + "\n";
  }

  await writeFile(filePath, next, "utf8");
  return { agent: "codex", filePath, action: "updated" };
}

export const CURSOR_RULE_PATH = path.join(".cursor", "rules", "ctx-memory.mdc");

/** Claude Code reads a project CLAUDE.md from either the repo root or `.claude/`. */
export const CLAUDE_FILE_PATH = path.join(".claude", "CLAUDE.md");
export const CLAUDE_LEGACY_ROOT_PATH = "CLAUDE.md";

/** Codex, Copilot, Gemini CLI, Windsurf and Zed all read this one, and it must sit at the repo root. */
export const AGENTS_FILE_PATH = "AGENTS.md";

/**
 * Cursor's own rules system needs a `.mdc` file with YAML frontmatter — a plain `.md` file in
 * `.cursor/rules/` is ignored outright. Only written on creation, so any `globs` or description
 * the user tunes afterwards survives regeneration.
 */
function cursorFrontmatter(): string {
  return [
    "---",
    "description: Project memory — decisions and the reasoning behind them, captured with ctx-memory",
    "alwaysApply: true",
    "---",
    "",
  ].join("\n");
}

/** Ensures the Cursor rules file exists with frontmatter, and returns its absolute path. */
export async function ensureCursorRuleFile(repoRoot: string): Promise<string> {
  const filePath = path.join(repoRoot, CURSOR_RULE_PATH);
  try {
    await readFile(filePath, "utf8");
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, cursorFrontmatter(), "utf8");
  }
  return filePath;
}

export function renderUsageSection(): string {
  return [
    USAGE_START,
    "## Working with project memory (ctx-memory)",
    "",
    "This repo has the `ctx-memory` MCP server registered. Use its tools proactively, don't wait",
    "to be asked:",
    "",
    "- **Before editing a file**, call `get_memory_for_file` with its path. Prior decisions about",
    "  that file surface there, not just in the generated snapshot below (which can lag).",
    "- **Before an architectural or otherwise non-obvious choice**, call `search_memory` first —",
    "  someone (human or a prior agent session) may have already decided this and written down why.",
    "- **When you and the user land on a decision worth remembering** — a rejected approach, a",
    "  non-obvious constraint, a \"why we didn't just do X\" — call `capture_memory`. It writes a",
    "  git-tracked markdown file; it never commits on its own, so the user reviews it like any",
    "  other change before it lands.",
    "- **Before relying on an entry for something risky**, call `list_stale_memory` to check whether",
    "  the code it references has drifted since it was written.",
    "",
    "Command-line equivalents, for when MCP isn't available: `memory capture`, `memory check`,",
    "`memory list`.",
    "",
    "Generated by `memory connect` — edit freely, it is only rewritten if you re-run that command.",
    USAGE_END,
  ].join("\n");
}

/** Writes the agent usage instructions above the generated memory block, if one exists. */
export async function writeUsageInstructions(repoRoot: string, fileName: string): Promise<"created" | "updated"> {
  const filePath = path.join(repoRoot, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  return upsertMarkedSection(filePath, renderUsageSection(), {
    startMarker: USAGE_START,
    endMarker: USAGE_END,
    insertBefore: MEMORY_START,
  });
}

/**
 * Claude Code loads BOTH `./CLAUDE.md` and `./.claude/CLAUDE.md` when both exist, so a leftover
 * root file would inject every note twice. Returns true when one is present and ours.
 */
export async function hasLegacyRootClaudeFile(repoRoot: string): Promise<boolean> {
  try {
    const content = await readFile(path.join(repoRoot, CLAUDE_LEGACY_ROOT_PATH), "utf8");
    return content.includes(MEMORY_START) || content.includes(USAGE_START);
  } catch {
    return false;
  }
}
