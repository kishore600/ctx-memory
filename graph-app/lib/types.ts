export type GraphNodeType = "memory" | "file" | "tag";
export type GraphEdgeType = "refs" | "tag" | "supersedes";
export type MemoryStatus = "active" | "stale" | "superseded";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  status?: MemoryStatus;
  date?: string;
  tags?: string[];
  refs?: string[];
  summary?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
}

export interface MemoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type TypeFilters = Record<GraphNodeType, boolean>;
export type StatusFilters = Record<MemoryStatus, boolean>;

export interface GraphStats {
  memory: number;
  file: number;
  tag: number;
  edges: number;
}

