import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MemoryEntry } from "../src/core/schema.js";
import { renderMemorySection, upsertMemorySection } from "../src/generators/agentsFile.js";

function makeEntry(overrides: Partial<MemoryEntry["frontmatter"]> = {}, body = "Why we did it."): MemoryEntry {
  return {
    frontmatter: {
      id: "mem_test1",
      title: "Chose Postgres over Mongo",
      date: "2026-09-19",
      author: "kishore.k@dataflo.ai",
      tags: ["architecture"],
      refs: ["src/billing.ts"],
      supersedes: null,
      status: "active",
      commit: "abc123",
      fingerprint: {},
      last_checked: null,
      ...overrides,
    },
    body,
    filePath: "/tmp/whatever.md",
  };
}

describe("renderMemorySection", () => {
  it("renders a placeholder when there are no entries", () => {
    const section = renderMemorySection([]);
    expect(section).toContain("No memory entries yet");
    expect(section).toContain("<!-- whyanchor:start -->");
    expect(section).toContain("<!-- whyanchor:end -->");
  });

  it("groups entries by tag and includes title/refs", () => {
    const section = renderMemorySection([makeEntry()]);
    expect(section).toContain("### architecture");
    expect(section).toContain("Chose Postgres over Mongo");
    expect(section).toContain("src/billing.ts");
  });

  it("excludes superseded entries", () => {
    const section = renderMemorySection([makeEntry({ status: "superseded" })]);
    expect(section).toContain("No memory entries yet");
  });
});

describe("upsertMemorySection", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "whyanchor-test-"));
    filePath = path.join(dir, "CLAUDE.md");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates the file when it does not exist", async () => {
    const result = await upsertMemorySection(filePath, "<!-- whyanchor:start -->\nhi\n<!-- whyanchor:end -->");
    expect(result).toBe("created");
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("hi");
  });

  it("appends a marked section to an existing file without markers", async () => {
    await writeFile(filePath, "# My existing instructions\n\nDo the thing.\n", "utf8");
    const result = await upsertMemorySection(filePath, "<!-- whyanchor:start -->\nnew section\n<!-- whyanchor:end -->");
    expect(result).toBe("updated");
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("My existing instructions");
    expect(content).toContain("new section");
  });

  it("replaces only the content between existing markers, preserving the rest", async () => {
    await writeFile(
      filePath,
      "# Header\n\n<!-- whyanchor:start -->\nold section\n<!-- whyanchor:end -->\n\n# Footer\n",
      "utf8"
    );
    await upsertMemorySection(filePath, "<!-- whyanchor:start -->\nnew section\n<!-- whyanchor:end -->");
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("# Header");
    expect(content).toContain("# Footer");
    expect(content).toContain("new section");
    expect(content).not.toContain("old section");
  });

  it("ignores marker-like text inline in a body line and still finds the real end marker", async () => {
    // Regression: an entry whose body literally mentions "<!-- whyanchor:end -->" (e.g. one
    // documenting the marker scheme itself) must not be mistaken for the real closing marker.
    await writeFile(
      filePath,
      [
        "# Header",
        "<!-- whyanchor:start -->",
        "- explains the marker: text between <!-- whyanchor:start --> and <!-- whyanchor:end -->, ignored",
        "<!-- whyanchor:end -->",
        "# Footer",
        "",
      ].join("\n"),
      "utf8"
    );
    await upsertMemorySection(filePath, "<!-- whyanchor:start -->\nnew section\n<!-- whyanchor:end -->");
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("# Header");
    expect(content).toContain("# Footer");
    expect(content).toContain("new section");
    expect(content).not.toContain("explains the marker");
    expect(content.match(/<!-- whyanchor:end -->/g)?.length).toBe(1);
  });
});
