import { parseRef } from "./fingerprint.js";
import type { MemoryEntry, Status } from "./schema.js";

export type GraphNodeType = "memory" | "file" | "tag";
export type GraphEdgeType = "refs" | "tag" | "supersedes";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Present on "memory" nodes only. */
  status?: Status;
  date?: string;
  tags?: string[];
  refs?: string[];
  summary?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  /** The symbol name, for a "refs" edge anchored to `file#symbol` rather than the whole file. */
  label?: string;
}

export interface MemoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const memoryNodeId = (id: string): string => `memory:${id}`;
export const fileNodeId = (file: string): string => `file:${file}`;
export const tagNodeId = (tag: string): string => `tag:${tag}`;

function firstLine(body: string): string {
  return body.split("\n").find((l) => l.trim().length > 0) ?? "";
}

/**
 * Builds the relationship graph over captured memory: a node per entry, file and tag, with
 * edges for "this entry references this file/symbol", "this entry has this tag", and "this
 * entry supersedes that one". Derived entirely from the entries already on disk — there is no
 * separate index to keep in sync, so the graph is always as current as the last `listEntries`.
 */
export function buildGraph(entries: MemoryEntry[]): MemoryGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const entry of entries) {
    const f = entry.frontmatter;
    const id = memoryNodeId(f.id);
    nodes.set(id, {
      id,
      type: "memory",
      label: f.title,
      status: f.status,
      date: f.date,
      tags: f.tags,
      refs: f.refs,
      summary: firstLine(entry.body),
    });

    for (const ref of f.refs) {
      const { file, symbol } = parseRef(ref);
      const fId = fileNodeId(file);
      if (!nodes.has(fId)) nodes.set(fId, { id: fId, type: "file", label: file });
      edges.push({ source: id, target: fId, type: "refs", label: symbol ?? undefined });
    }

    for (const tag of f.tags) {
      const tId = tagNodeId(tag);
      if (!nodes.has(tId)) nodes.set(tId, { id: tId, type: "tag", label: tag });
      edges.push({ source: id, target: tId, type: "tag" });
    }

    if (f.supersedes) {
      edges.push({ source: id, target: memoryNodeId(f.supersedes), type: "supersedes" });
    }
  }

  // A supersedes edge can point at an id that no longer exists (the prior entry was deleted
  // by hand outside the tool) — drop those rather than ship a dangling edge to the renderer.
  const nodeIds = new Set(nodes.keys());
  const wellFormedEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes: [...nodes.values()], edges: wellFormedEdges };
}

export interface RelatedEntry {
  entry: MemoryEntry;
  score: number;
  reasons: string[];
}

/**
 * Finds other entries related to `id` via shared file/symbol refs, shared tags, or a
 * supersedes relationship — the same connections the graph draws edges for, scored so the
 * strongest relationships surface first. Shared refs count more than shared tags because a
 * ref is a much more specific signal than a tag; a supersedes link counts most because it is
 * the same decision at a different point in time.
 */
export function findRelatedEntries(entries: MemoryEntry[], id: string, limit = 10): RelatedEntry[] {
  const target = entries.find((e) => e.frontmatter.id === id);
  if (!target) return [];

  const targetFiles = new Set(target.frontmatter.refs.map((r) => parseRef(r).file));
  const targetTags = new Set(target.frontmatter.tags);

  const results: RelatedEntry[] = [];
  for (const entry of entries) {
    if (entry.frontmatter.id === id) continue;

    const reasons: string[] = [];
    let score = 0;

    if (entry.frontmatter.id === target.frontmatter.supersedes || entry.frontmatter.supersedes === target.frontmatter.id) {
      score += 5;
      reasons.push("supersedes chain");
    }

    const sharedFiles = [...new Set(entry.frontmatter.refs.map((r) => parseRef(r).file).filter((f) => targetFiles.has(f)))];
    if (sharedFiles.length) {
      score += sharedFiles.length * 2;
      reasons.push(`shared file: ${sharedFiles.join(", ")}`);
    }

    const sharedTags = entry.frontmatter.tags.filter((t) => targetTags.has(t));
    if (sharedTags.length) {
      score += sharedTags.length;
      reasons.push(`shared tag: ${sharedTags.join(", ")}`);
    }

    if (score > 0) results.push({ entry, score, reasons });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
