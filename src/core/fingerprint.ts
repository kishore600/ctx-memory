import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FingerprintEntry } from "./schema.js";

export interface ParsedRef {
  file: string;
  symbol: string | null;
}

/** Parses a ref like "src/billing.ts#calculateTax" into its file and optional symbol. */
export function parseRef(ref: string): ParsedRef {
  const hashIndex = ref.indexOf("#");
  if (hashIndex === -1) return { file: ref, symbol: null };
  return { file: ref.slice(0, hashIndex), symbol: ref.slice(hashIndex + 1) || null };
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Best-effort extraction of the source block for `symbol` out of `content`.
 * Supports brace-delimited languages (JS/TS/Go/Java/etc.) and indentation-delimited
 * ones (Python). Falls back to null when no declaration can be located, in which case
 * callers should fingerprint the whole file instead.
 */
export function extractSymbolBlock(content: string, symbol: string): string | null {
  const lines = content.split("\n");
  const declRe = new RegExp(
    `\\b(function\\s+${symbol}\\b|class\\s+${symbol}\\b|(const|let|var)\\s+${symbol}\\b|def\\s+${symbol}\\b|${symbol}\\s*[:=]\\s*(async\\s*)?\\(|${symbol}\\s*\\([^)]*\\)\\s*[:{])`
  );

  let declLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (declRe.test(lines[i])) {
      declLineIdx = i;
      break;
    }
  }
  if (declLineIdx === -1) return null;

  const declLine = lines[declLineIdx];

  // Python / indentation-delimited: declaration ends with ':' and has no '{' on it.
  if (/:\s*$/.test(declLine.trimEnd()) && !declLine.includes("{")) {
    const declIndent = declLine.match(/^(\s*)/)?.[1].length ?? 0;
    const blockLines = [declLine];
    for (let i = declLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        blockLines.push(line);
        continue;
      }
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent <= declIndent) break;
      blockLines.push(line);
    }
    return blockLines.join("\n").trimEnd();
  }

  // Brace-delimited: find the first '{' at/after the decl line and match braces.
  // Look far enough ahead to cover multi-line signatures (many params, generics, return
  // type annotations) before giving up and treating this as a brace-less one-liner.
  const BRACE_SEARCH_WINDOW = 50;
  let braceLine = -1;
  let braceCol = -1;
  outer: for (let i = declLineIdx; i < Math.min(lines.length, declLineIdx + BRACE_SEARCH_WINDOW); i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === "{") {
        braceLine = i;
        braceCol = c;
        break outer;
      }
    }
  }
  if (braceLine === -1) {
    // No braces found nearby (e.g. a type alias or one-liner) — treat the decl line alone as the block.
    return declLine;
  }

  let depth = 0;
  let endLine = -1;
  let endCol = -1;
  outer2: for (let i = braceLine; i < lines.length; i++) {
    const line = lines[i];
    const start = i === braceLine ? braceCol : 0;
    for (let c = start; c < line.length; c++) {
      if (line[c] === "{") depth++;
      else if (line[c] === "}") {
        depth--;
        if (depth === 0) {
          endLine = i;
          endCol = c;
          break outer2;
        }
      }
    }
  }
  if (endLine === -1) return null;

  const blockLines = lines.slice(declLineIdx, endLine + 1);
  return blockLines.join("\n").trimEnd();
}

export interface FingerprintResult extends FingerprintEntry {}

/** Computes a fingerprint for a single ref against the working tree rooted at `repoRoot`. */
export async function computeFingerprint(repoRoot: string, ref: string): Promise<FingerprintResult> {
  const { file, symbol } = parseRef(ref);
  const absPath = path.resolve(repoRoot, file);

  let content: string;
  try {
    content = await readFile(absPath, "utf8");
  } catch {
    return { hash: "", kind: "missing" };
  }

  if (symbol) {
    const block = extractSymbolBlock(content, symbol);
    if (block !== null) {
      return { hash: hashContent(block), kind: "symbol" };
    }
    // Symbol not found anymore: distinct from "missing file" but still worth flagging.
    return { hash: "", kind: "missing" };
  }

  return { hash: hashContent(content), kind: "file" };
}

export async function computeFingerprints(
  repoRoot: string,
  refs: string[]
): Promise<Record<string, FingerprintResult>> {
  const entries = await Promise.all(refs.map(async (ref) => [ref, await computeFingerprint(repoRoot, ref)] as const));
  return Object.fromEntries(entries);
}
