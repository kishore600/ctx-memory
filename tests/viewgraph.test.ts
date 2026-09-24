import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runViewgraph } from "../src/commands/viewgraph.js";

describe("runViewgraph", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "whyanchor-viewgraph-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses to start the graph server when no memory store exists", async () => {
    await runViewgraph(dir, { open: false });
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
