import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectCodex, connectJsonAgent, writeUsageInstructions } from "../src/generators/agentConfig.js";

const SERVER = { command: "node", args: ["/abs/path/cli.js", "mcp"] };

describe("connectJsonAgent", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ctx-memory-connect-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates .mcp.json when none exists", async () => {
    const result = await connectJsonAgent(dir, "claude", SERVER);
    expect(result.action).toBe("created");
    const config = JSON.parse(await readFile(path.join(dir, ".mcp.json"), "utf8"));
    expect(config.mcpServers["ctx-memory"]).toEqual(SERVER);
  });

  it("preserves other servers already configured", async () => {
    await writeFile(
      path.join(dir, ".mcp.json"),
      JSON.stringify({ mcpServers: { "existing-server": { command: "node", args: ["other.js"] } } }, null, 2),
      "utf8"
    );

    const result = await connectJsonAgent(dir, "claude", SERVER);
    expect(result.action).toBe("updated");

    const config = JSON.parse(await readFile(path.join(dir, ".mcp.json"), "utf8"));
    expect(config.mcpServers["existing-server"]).toEqual({ command: "node", args: ["other.js"] });
    expect(config.mcpServers["ctx-memory"]).toEqual(SERVER);
  });

  it("preserves unrelated top-level keys", async () => {
    await writeFile(path.join(dir, ".mcp.json"), JSON.stringify({ someOtherKey: { a: 1 } }, null, 2), "utf8");
    await connectJsonAgent(dir, "claude", SERVER);
    const config = JSON.parse(await readFile(path.join(dir, ".mcp.json"), "utf8"));
    expect(config.someOtherKey).toEqual({ a: 1 });
  });

  it("is idempotent — re-running reports unchanged", async () => {
    await connectJsonAgent(dir, "claude", SERVER);
    const second = await connectJsonAgent(dir, "claude", SERVER);
    expect(second.action).toBe("unchanged");
  });

  it("refuses to overwrite a malformed config rather than clobbering it", async () => {
    await writeFile(path.join(dir, ".mcp.json"), "{ not valid json", "utf8");
    await expect(connectJsonAgent(dir, "claude", SERVER)).rejects.toThrow(/not valid JSON/);
    expect(await readFile(path.join(dir, ".mcp.json"), "utf8")).toBe("{ not valid json");
  });

  it("writes Cursor config to .cursor/mcp.json", async () => {
    await connectJsonAgent(dir, "cursor", SERVER);
    const config = JSON.parse(await readFile(path.join(dir, ".cursor", "mcp.json"), "utf8"));
    expect(config.mcpServers["ctx-memory"]).toEqual(SERVER);
  });
});

describe("connectCodex", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ctx-memory-codex-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates a TOML table when no config exists", async () => {
    const result = await connectCodex(dir, SERVER);
    expect(result.action).toBe("created");
    const toml = await readFile(path.join(dir, ".codex", "config.toml"), "utf8");
    expect(toml).toContain("[mcp_servers.ctx-memory]");
    expect(toml).toContain('command = "node"');
    expect(toml).toContain('args = ["/abs/path/cli.js", "mcp"]');
  });

  it("appends without disturbing other tables", async () => {
    await mkdir(path.join(dir, ".codex"), { recursive: true });
    await writeFile(
      path.join(dir, ".codex", "config.toml"),
      'model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "node"\nargs = ["other.js"]\n',
      "utf8"
    );

    await connectCodex(dir, SERVER);
    const toml = await readFile(path.join(dir, ".codex", "config.toml"), "utf8");
    expect(toml).toContain('model = "gpt-5"');
    expect(toml).toContain("[mcp_servers.other]");
    expect(toml).toContain("[mcp_servers.ctx-memory]");
  });

  it("replaces an existing ctx-memory table instead of duplicating it", async () => {
    await connectCodex(dir, SERVER);
    await connectCodex(dir, { command: "memory", args: ["mcp"] });
    const toml = await readFile(path.join(dir, ".codex", "config.toml"), "utf8");
    expect(toml.match(/\[mcp_servers\.ctx-memory\]/g)?.length).toBe(1);
    expect(toml).toContain('command = "memory"');
    expect(toml).not.toContain("/abs/path/cli.js");
  });
});

describe("writeUsageInstructions", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ctx-memory-usage-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("inserts above an existing generated memory block, preserving hand-written content", async () => {
    await writeFile(
      path.join(dir, "CLAUDE.md"),
      "# My Project\n\nHand-written rules.\n\n<!-- ctx-memory:start -->\n## Project Memory\n<!-- ctx-memory:end -->\n",
      "utf8"
    );

    await writeUsageInstructions(dir, "CLAUDE.md");
    const content = await readFile(path.join(dir, "CLAUDE.md"), "utf8");

    expect(content).toContain("Hand-written rules.");
    expect(content).toContain("## Project Memory");
    expect(content.indexOf("ctx-memory:usage:start")).toBeLessThan(content.indexOf("ctx-memory:start"));
  });

  it("is idempotent — re-running does not duplicate the section", async () => {
    await writeUsageInstructions(dir, "CLAUDE.md");
    await writeUsageInstructions(dir, "CLAUDE.md");
    const content = await readFile(path.join(dir, "CLAUDE.md"), "utf8");
    expect(content.match(/ctx-memory:usage:start/g)?.length).toBe(1);
  });
});
