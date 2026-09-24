import { describe, expect, it } from "vitest";
import { buildGraph, findRelatedEntries, fileNodeId, memoryNodeId, tagNodeId } from "../src/core/graph.js";
import type { MemoryEntry } from "../src/core/schema.js";

function makeEntry(overrides: Partial<MemoryEntry["frontmatter"]> & { body?: string }): MemoryEntry {
  const { body, ...frontmatterOverrides } = overrides;
  return {
    frontmatter: {
      id: "mem_test",
      title: "Untitled",
      date: "2026-01-01",
      author: "a",
      tags: [],
      refs: [],
      supersedes: null,
      status: "active",
      commit: null,
      fingerprint: {},
      last_checked: null,
      ...frontmatterOverrides,
    },
    body: body ?? "body text",
    filePath: `/tmp/${frontmatterOverrides.id ?? "mem_test"}.md`,
  };
}

describe("buildGraph", () => {
  it("creates a memory node per entry, and shared file/tag nodes for shared refs/tags", () => {
    const a = makeEntry({ id: "mem_a", title: "Chose Postgres", tags: ["architecture"], refs: ["src/db.ts#connect"] });
    const b = makeEntry({ id: "mem_b", title: "Added retries", tags: ["architecture"], refs: ["src/db.ts#connect"] });

    const graph = buildGraph([a, b]);

    const nodeIds = graph.nodes.map((n) => n.id);
    expect(nodeIds).toContain(memoryNodeId("mem_a"));
    expect(nodeIds).toContain(memoryNodeId("mem_b"));
    expect(nodeIds).toContain(fileNodeId("src/db.ts"));
    expect(nodeIds).toContain(tagNodeId("architecture"));

    // The shared file and tag are represented once each, not duplicated per entry.
    expect(graph.nodes.filter((n) => n.id === fileNodeId("src/db.ts"))).toHaveLength(1);
    expect(graph.nodes.filter((n) => n.id === tagNodeId("architecture"))).toHaveLength(1);

    const refsEdges = graph.edges.filter((e) => e.type === "refs");
    expect(refsEdges).toHaveLength(2);
    expect(refsEdges.every((e) => e.target === fileNodeId("src/db.ts"))).toBe(true);
    expect(refsEdges.find((e) => e.source === memoryNodeId("mem_a"))?.label).toBe("connect");
  });

  it("adds a supersedes edge from the new entry to the one it replaces", () => {
    const old = makeEntry({ id: "mem_old", title: "Old decision" });
    const next = makeEntry({ id: "mem_new", title: "New decision", supersedes: "mem_old" });

    const graph = buildGraph([old, next]);
    expect(graph.edges).toContainEqual({ source: memoryNodeId("mem_new"), target: memoryNodeId("mem_old"), type: "supersedes" });
  });

  it("drops a supersedes edge that points at an entry no longer in the store", () => {
    const next = makeEntry({ id: "mem_new", title: "New decision", supersedes: "mem_missing" });
    const graph = buildGraph([next]);
    expect(graph.edges.filter((e) => e.type === "supersedes")).toHaveLength(0);
  });
});

describe("findRelatedEntries", () => {
  it("ranks a supersedes relationship above a shared-tag-only relationship", () => {
    const target = makeEntry({ id: "mem_target", title: "Target", tags: ["billing"], supersedes: "mem_old" });
    const superseded = makeEntry({ id: "mem_old", title: "Old" });
    const sharedTagOnly = makeEntry({ id: "mem_other", title: "Other", tags: ["billing"] });
    const unrelated = makeEntry({ id: "mem_unrelated", title: "Unrelated", tags: ["ui"] });

    const results = findRelatedEntries([target, superseded, sharedTagOnly, unrelated], "mem_target");

    expect(results.map((r) => r.entry.frontmatter.id)).toEqual(["mem_old", "mem_other"]);
    expect(results[0].reasons).toContain("supersedes chain");
    expect(results[1].reasons.some((r) => r.startsWith("shared tag"))).toBe(true);
  });

  it("weighs a shared file ref higher than a shared tag", () => {
    const target = makeEntry({ id: "mem_target", title: "Target", tags: ["a"], refs: ["src/x.ts"] });
    const sharedFile = makeEntry({ id: "mem_file", title: "Shares file", refs: ["src/x.ts"] });
    const sharedTag = makeEntry({ id: "mem_tag", title: "Shares tag", tags: ["a"] });

    const results = findRelatedEntries([target, sharedFile, sharedTag], "mem_target");
    expect(results[0].entry.frontmatter.id).toBe("mem_file");
    expect(results[1].entry.frontmatter.id).toBe("mem_tag");
  });

  it("returns an empty list for an unknown id", () => {
    const a = makeEntry({ id: "mem_a" });
    expect(findRelatedEntries([a], "mem_missing")).toEqual([]);
  });
});
