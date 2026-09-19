import { describe, expect, it } from "vitest";
import { extractSymbolBlock, hashContent, parseRef } from "../src/core/fingerprint.js";

describe("parseRef", () => {
  it("splits file and symbol on #", () => {
    expect(parseRef("src/billing.ts#calculateTax")).toEqual({ file: "src/billing.ts", symbol: "calculateTax" });
  });

  it("returns null symbol when there is no #", () => {
    expect(parseRef("src/billing.ts")).toEqual({ file: "src/billing.ts", symbol: null });
  });
});

describe("hashContent", () => {
  it("is deterministic and sensitive to content changes", () => {
    const a = hashContent("hello world");
    const b = hashContent("hello world");
    const c = hashContent("hello world!");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("extractSymbolBlock", () => {
  it("extracts a JS function declaration", () => {
    const src = [
      "export function unrelated() {",
      "  return 1;",
      "}",
      "",
      "function calculateTax(amount) {",
      "  return amount * 0.2;",
      "}",
    ].join("\n");
    const block = extractSymbolBlock(src, "calculateTax");
    expect(block).toContain("function calculateTax(amount)");
    expect(block).toContain("return amount * 0.2;");
    expect(block).not.toContain("unrelated");
  });

  it("extracts a TS const arrow function", () => {
    const src = ["const foo = 1;", "", "const calculateTax = (amount: number) => {", "  return amount * 0.2;", "};"].join(
      "\n"
    );
    const block = extractSymbolBlock(src, "calculateTax");
    expect(block).toContain("calculateTax");
    expect(block).toContain("return amount * 0.2;");
  });

  it("extracts a Python function by indentation", () => {
    const src = [
      "def unrelated():",
      "    return 1",
      "",
      "def calculate_tax(amount):",
      "    total = amount * 0.2",
      "    return total",
      "",
      "def after():",
      "    pass",
    ].join("\n");
    const block = extractSymbolBlock(src, "calculate_tax");
    expect(block).toContain("def calculate_tax(amount):");
    expect(block).toContain("return total");
    expect(block).not.toContain("def after");
  });

  it("returns null when the symbol cannot be found", () => {
    expect(extractSymbolBlock("const a = 1;", "doesNotExist")).toBeNull();
  });

  it("changes hash when the extracted block body changes", () => {
    const before = extractSymbolBlock("function calculateTax(a) {\n  return a * 0.2;\n}", "calculateTax")!;
    const after = extractSymbolBlock("function calculateTax(a) {\n  return a * 0.25;\n}", "calculateTax")!;
    expect(hashContent(before)).not.toBe(hashContent(after));
  });
});
