import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/core/fingerprint.js";
import { getCurrentCommit } from "../src/core/git.js";
import { checkEntry } from "../src/core/staleness.js";
import { initStore, writeEntry } from "../src/core/store.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]) {
  await execFileAsync("git", args, { cwd });
}

describe("staleness check (integration, real git repo)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "whyanchor-stale-"));
    await git(dir, ["init"]);
    await git(dir, ["config", "user.email", "test@example.com"]);
    await git(dir, ["config", "user.name", "Test"]);
    await initStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reports fresh when the referenced file has not changed since capture", async () => {
    const filePath = path.join(dir, "billing.ts");
    await writeFile(filePath, "function calculateTax(a) {\n  return a * 0.2;\n}\n", "utf8");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "add billing"]);

    const commit = await getCurrentCommit(dir);
    const fp = await computeFingerprint(dir, "billing.ts#calculateTax");
    const entry = await writeEntry(
      dir,
      {
        title: "Tax rate is 20%",
        author: "test",
        tags: [],
        refs: ["billing.ts#calculateTax"],
        supersedes: null,
        status: "active",
        commit,
        fingerprint: { "billing.ts#calculateTax": fp },
        last_checked: null,
      },
      "Flat 20% tax rate for now."
    );

    const result = await checkEntry(dir, entry);
    expect(result.level).toBe("fresh");
  });

  it("flags high when the referenced symbol's content changes", async () => {
    const filePath = path.join(dir, "billing.ts");
    await writeFile(filePath, "function calculateTax(a) {\n  return a * 0.2;\n}\n", "utf8");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "add billing"]);

    const commit = await getCurrentCommit(dir);
    const fp = await computeFingerprint(dir, "billing.ts#calculateTax");
    const entry = await writeEntry(
      dir,
      {
        title: "Tax rate is 20%",
        author: "test",
        tags: [],
        refs: ["billing.ts#calculateTax"],
        supersedes: null,
        status: "active",
        commit,
        fingerprint: { "billing.ts#calculateTax": fp },
        last_checked: null,
      },
      "Flat 20% tax rate for now."
    );

    await writeFile(filePath, "function calculateTax(a) {\n  return a * 0.25;\n}\n", "utf8");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "bump tax rate"]);

    const result = await checkEntry(dir, entry);
    expect(result.level).toBe("high");
    expect(result.refs[0].level).toBe("high");
  });

  it("flags low when the file was touched but the referenced symbol is unchanged", async () => {
    const filePath = path.join(dir, "billing.ts");
    await writeFile(
      filePath,
      "function calculateTax(a) {\n  return a * 0.2;\n}\n\nfunction other() {\n  return 1;\n}\n",
      "utf8"
    );
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "add billing"]);

    const commit = await getCurrentCommit(dir);
    const fp = await computeFingerprint(dir, "billing.ts#calculateTax");
    const entry = await writeEntry(
      dir,
      {
        title: "Tax rate is 20%",
        author: "test",
        tags: [],
        refs: ["billing.ts#calculateTax"],
        supersedes: null,
        status: "active",
        commit,
        fingerprint: { "billing.ts#calculateTax": fp },
        last_checked: null,
      },
      "Flat 20% tax rate for now."
    );

    await writeFile(
      filePath,
      "function calculateTax(a) {\n  return a * 0.2;\n}\n\nfunction other() {\n  return 2;\n}\n",
      "utf8"
    );
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "change unrelated function"]);

    const result = await checkEntry(dir, entry);
    expect(result.level).toBe("low");
  });

  it("flags missing when the referenced symbol is removed", async () => {
    const filePath = path.join(dir, "billing.ts");
    await writeFile(filePath, "function calculateTax(a) {\n  return a * 0.2;\n}\n", "utf8");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "add billing"]);

    const commit = await getCurrentCommit(dir);
    const fp = await computeFingerprint(dir, "billing.ts#calculateTax");
    const entry = await writeEntry(
      dir,
      {
        title: "Tax rate is 20%",
        author: "test",
        tags: [],
        refs: ["billing.ts#calculateTax"],
        supersedes: null,
        status: "active",
        commit,
        fingerprint: { "billing.ts#calculateTax": fp },
        last_checked: null,
      },
      "Flat 20% tax rate for now."
    );

    await writeFile(filePath, "function computeTax(a) {\n  return a * 0.2;\n}\n", "utf8");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "rename function"]);

    const result = await checkEntry(dir, entry);
    expect(result.level).toBe("missing");
  });
});
