import type { GraphNode } from "./types";

export const MEMORY_COLOR = "#6366f1";
export const FILE_COLOR = "#10b981";
export const TAG_COLOR = "#a855f7";
export const STALE_COLOR = "#f59e0b";
export const SUPERSEDED_COLOR = "#94a3b8";

const TYPE_COLOR: Record<string, string> = { file: FILE_COLOR, tag: TAG_COLOR };

export const EDGE_COLOR: Record<string, string> = {
  refs: "#64748b",
  tag: "#a855f7",
  supersedes: STALE_COLOR,
};

/** Memory nodes encode status through color; file/tag nodes always show their type color. */
export function nodeColorFor(node: Pick<GraphNode, "type" | "status">): string {
  if (node.type !== "memory") return TYPE_COLOR[node.type] ?? "#64748b";
  if (node.status === "stale") return STALE_COLOR;
  if (node.status === "superseded") return SUPERSEDED_COLOR;
  return MEMORY_COLOR;
}

export function withAlpha(hex: string, alpha: number): string {
  const int = parseInt(hex.replace("#", ""), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
