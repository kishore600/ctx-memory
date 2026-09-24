import { describe, expect, it } from "vitest";
import { rankEntries } from "../src/core/search.js";
import type { MemoryEntry } from "../src/core/schema.js";

function makeEntry(id: string, title: string, body: string, tags: string[] = [], refs: string[] = []): MemoryEntry {
  return {
    frontmatter: {
      id,
      title,
      date: "2026-01-01",
      author: "a",
      tags,
      refs,
      supersedes: null,
      status: "active",
      commit: null,
      fingerprint: {},
      last_checked: null,
    },
    body,
    filePath: `/tmp/${id}.md`,
  };
}

describe("rankEntries", () => {
  it("scores a title match higher than the same term only in the body", () => {
    const titleMatch = makeEntry("mem_a", "Postgres over Mongo", "We needed transactions.");
    const bodyMatch = makeEntry("mem_b", "Unrelated decision", "We compared postgres against alternatives.");

    const ranked = rankEntries([titleMatch, bodyMatch], "postgres");
    expect(ranked[0].entry.frontmatter.id).toBe("mem_a");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("gives entries with no matching term a score of 0", () => {
    const entry = makeEntry("mem_a", "Enterprise discount", "Legal requires 30%.");
    const ranked = rankEntries([entry], "kubernetes");
    expect(ranked[0].score).toBe(0);
  });

  it("matches a longer query term as a prefix of a token", () => {
    const entry = makeEntry("mem_a", "Uses PostgreSQL", "Chosen for JSONB support.");
    const ranked = rankEntries([entry], "postgres");
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("does not prefix-match very short query terms", () => {
    const entry = makeEntry("mem_a", "Cats and caps", "Unrelated.");
    const ranked = rankEntries([entry], "ca");
    expect(ranked[0].score).toBe(0);
  });

  it("returns all entries with score 0 for an empty query", () => {
    const entry = makeEntry("mem_a", "Anything", "Body.");
    const ranked = rankEntries([entry], "   ");
    expect(ranked).toEqual([{ entry, score: 0 }]);
  });

  it("boosts a term that also appears in tags or refs", () => {
    const tagged = makeEntry("mem_a", "Some decision", "General text.", ["billing"]);
    const untagged = makeEntry("mem_b", "Another decision", "Mentions billing once in passing.");

    const ranked = rankEntries([tagged, untagged], "billing");
    expect(ranked[0].entry.frontmatter.id).toBe("mem_a");
  });
});
