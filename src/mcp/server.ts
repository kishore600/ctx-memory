import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { computeFingerprints } from "../core/fingerprint.js";
import { getCurrentCommit, getGitAuthor, getRepoRoot } from "../core/git.js";
import { checkEntries } from "../core/staleness.js";
import { listEntries, writeEntry } from "../core/store.js";
import type { MemoryEntry } from "../core/schema.js";

function summarize(entry: MemoryEntry): Record<string, unknown> {
  const { id, title, date, author, tags, refs, status } = entry.frontmatter;
  const firstLine = entry.body.split("\n").find((l) => l.trim().length > 0) ?? "";
  return { id, title, date, author, tags, refs, status, summary: firstLine };
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export async function startMcpServer(cwd: string): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  const server = new McpServer({ name: "ctx-memory", version: "0.1.0" });

  server.tool(
    "search_memory",
    "Search captured project memory (decisions, context, gotchas) by keyword and/or tag. " +
      "Use this before making an architectural decision or touching an unfamiliar area of the repo.",
    {
      query: z.string().optional().describe("Free-text search over titles and body"),
      tag: z.string().optional().describe("Filter to entries with this tag"),
    },
    async ({ query, tag }) => {
      let entries = await listEntries(repoRoot);
      entries = entries.filter((e) => e.frontmatter.status !== "superseded");
      if (tag) entries = entries.filter((e) => e.frontmatter.tags.includes(tag));
      if (query) {
        const q = query.toLowerCase();
        entries = entries.filter(
          (e) => e.frontmatter.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)
        );
      }
      return textResult(entries.map(summarize));
    }
  );

  server.tool(
    "get_memory_for_file",
    "Retrieve memory entries anchored to a specific file (or file#symbol). Call this when opening or " +
      "editing a file to surface prior decisions and context about it before making changes.",
    { path: z.string().describe("Repo-relative file path, e.g. src/billing.ts") },
    async ({ path: filePath }) => {
      const entries = await listEntries(repoRoot);
      const matches = entries.filter(
        (e) => e.frontmatter.status !== "superseded" && e.frontmatter.refs.some((r) => r.split("#")[0] === filePath)
      );
      return textResult(matches.map((e) => ({ ...summarize(e), body: e.body })));
    }
  );

  server.tool(
    "get_memory_entry",
    "Fetch the full content of one memory entry by id.",
    { id: z.string() },
    async ({ id }) => {
      const entries = await listEntries(repoRoot);
      const entry = entries.find((e) => e.frontmatter.id === id);
      if (!entry) return textResult({ error: `No entry with id ${id}` });
      return textResult({ ...summarize(entry), body: entry.body });
    }
  );

  server.tool(
    "list_stale_memory",
    "Run the fast-tier staleness check and return entries whose referenced code has likely drifted. " +
      "Use this to sanity-check whether memory you're about to rely on is still trustworthy.",
    {},
    async () => {
      const entries = await listEntries(repoRoot);
      const active = entries.filter((e) => e.frontmatter.status !== "superseded");
      const results = await checkEntries(repoRoot, active);
      const flagged = results.filter((r) => r.level === "high" || r.level === "missing");
      return textResult(
        flagged.map((r) => ({
          ...summarize(r.entry),
          level: r.level,
          refs: r.refs.filter((ref) => ref.level !== "fresh"),
        }))
      );
    }
  );

  server.tool(
    "capture_memory",
    "Record a new memory entry: a decision, gotcha, or piece of context worth remembering about this repo. " +
      "The entry is written as a git-tracked markdown file for the developer to review at commit time — it is " +
      "never committed automatically. Use this when you and the user land on a non-obvious decision, or the " +
      "user tells you something explicitly worth remembering.",
    {
      title: z.string().describe("One-line summary"),
      body: z.string().describe("A few sentences of context — the why, not just the what"),
      refs: z.array(z.string()).default([]).describe("Anchoring refs, e.g. ['src/billing.ts#calculateTax']"),
      tags: z.array(z.string()).default([]),
    },
    async ({ title, body, refs, tags }) => {
      const [author, commit, fingerprint] = await Promise.all([
        getGitAuthor(repoRoot),
        getCurrentCommit(repoRoot),
        computeFingerprints(repoRoot, refs),
      ]);
      const entry = await writeEntry(
        repoRoot,
        { title, author: `${author} (via agent)`, tags, refs, supersedes: null, status: "active", commit, fingerprint, last_checked: null },
        body
      );
      return textResult({ created: entry.frontmatter.id, filePath: entry.filePath });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
