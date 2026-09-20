#!/usr/bin/env node
import { Command } from "commander";
import { runCapture } from "./commands/capture.js";
import { runCheck } from "./commands/check.js";
import { runConnect } from "./commands/connect.js";
import { runGenerate } from "./commands/generate.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { startMcpServer } from "./mcp/server.js";

const program = new Command();

program.name("memory").description("Local-first, git-backed memory layer for AI coding agents.").version("0.1.0");

program
  .command("init")
  .description("Initialize a memory store (.memory/) in the current git repo")
  .action(async () => {
    await runInit(process.cwd());
  });

program
  .command("connect")
  .description("Register the MCP server with your AI agents and write agent usage instructions")
  .option("--agent <agents>", "claude | cursor | codex | all (comma-separated)", "all")
  .option("--command <command>", 'Override the spawn command, e.g. "memory mcp"')
  .option("--no-instructions", "Skip writing the usage section into CLAUDE.md / AGENTS.md")
  .action(async (options) => {
    await runConnect(process.cwd(), {
      agent: options.agent,
      command: options.command,
      noInstructions: options.instructions === false,
    });
  });

program
  .command("capture")
  .description("Capture a decision or piece of context as a new memory entry")
  .option("-t, --title <title>", "One-line title")
  .option("-m, --message <message>", "Body text (the why, not just the what)")
  .option("-r, --refs <refs...>", "Anchoring refs, e.g. src/billing.ts#calculateTax (comma or space separated)")
  .option("--tags <tags...>", "Tags (comma or space separated)")
  .option("--supersedes <id>", "Id of a prior entry this one replaces")
  .action(async (options) => {
    await runCapture(process.cwd(), options);
  });

program
  .command("check")
  .description("Check captured entries for staleness against the current working tree")
  .option("--json", "Output machine-readable JSON")
  .option("--fail-on-stale", "Exit with code 1 if any entry is flagged stale (for CI / pre-commit)")
  .option("--write", "Persist last_checked and status back into entry frontmatter")
  .action(async (options) => {
    await runCheck(process.cwd(), {
      json: options.json,
      failOnStale: options.failOnStale,
      write: options.write,
    });
  });

program
  .command("generate")
  .description("Write captured memory into CLAUDE.md and/or AGENTS.md")
  .option("--target <target>", "claude | agents | both", "both")
  .action(async (options) => {
    await runGenerate(process.cwd(), { target: options.target });
  });

program
  .command("list")
  .description("List captured memory entries")
  .option("--tag <tag>", "Filter by tag")
  .option("--json", "Output machine-readable JSON")
  .action(async (options) => {
    await runList(process.cwd(), options);
  });

program
  .command("mcp")
  .description("Run the MCP server over stdio (register this with Claude Code, Cursor, or Codex)")
  .action(async () => {
    await startMcpServer(process.cwd());
  });

await program.parseAsync(process.argv);
