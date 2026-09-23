import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getVersion } from "../src/core/version.js";

describe("getVersion", () => {
  it("matches the version in package.json, not a hardcoded string", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(getVersion()).toBe(pkg.version);
  });
});
