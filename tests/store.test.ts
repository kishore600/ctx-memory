import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findEntryById, initStore, listEntries, readEntryFile, updateEntryFrontmatter, writeEntry } from "../src/core/store.js";

describe("memory store", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "whyanchor-store-"));
    await initStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips an entry through write and read", async () => {
    const written = await writeEntry(
      dir,
      {
        title: "Chose Postgres over Mongo",
        author: "kishore.k@dataflo.ai",
        tags: ["architecture", "billing"],
        refs: ["src/billing.ts#calculateTax"],
        supersedes: null,
        status: "active",
        commit: "abc123",
        fingerprint: { "src/billing.ts#calculateTax": { hash: "deadbeef", kind: "symbol" } },
        last_checked: null,
      },
      "We needed multi-document transactions for tax reconciliation."
    );

    const read = await readEntryFile(written.filePath);
    expect(read.frontmatter.title).toBe("Chose Postgres over Mongo");
    expect(read.frontmatter.tags).toEqual(["architecture", "billing"]);
    expect(read.frontmatter.refs).toEqual(["src/billing.ts#calculateTax"]);
    expect(read.frontmatter.fingerprint["src/billing.ts#calculateTax"].hash).toBe("deadbeef");
    expect(read.body).toContain("multi-document transactions");
  });

  it("lists entries newest-first and finds by id", async () => {
    const first = await writeEntry(
      dir,
      {
        title: "First",
        author: "a",
        tags: [],
        refs: [],
        supersedes: null,
        status: "active",
        commit: null,
        fingerprint: {},
        last_checked: null,
        date: "2026-01-01",
      },
      "first body"
    );
    const second = await writeEntry(
      dir,
      {
        title: "Second",
        author: "a",
        tags: [],
        refs: [],
        supersedes: null,
        status: "active",
        commit: null,
        fingerprint: {},
        last_checked: null,
        date: "2026-06-01",
      },
      "second body"
    );

    const entries = await listEntries(dir);
    expect(entries.map((e) => e.frontmatter.id)).toEqual([second.frontmatter.id, first.frontmatter.id]);

    const found = await findEntryById(dir, first.frontmatter.id);
    expect(found?.frontmatter.title).toBe("First");
  });

  it("updates frontmatter in place, preserving the body", async () => {
    const entry = await writeEntry(
      dir,
      {
        title: "Mutable",
        author: "a",
        tags: [],
        refs: [],
        supersedes: null,
        status: "active",
        commit: null,
        fingerprint: {},
        last_checked: null,
      },
      "body text"
    );

    const updated = await updateEntryFrontmatter(entry, { status: "superseded" });
    expect(updated.frontmatter.status).toBe("superseded");

    const reread = await readEntryFile(entry.filePath);
    expect(reread.frontmatter.status).toBe("superseded");
    expect(reread.body).toBe("body text");
  });
});
