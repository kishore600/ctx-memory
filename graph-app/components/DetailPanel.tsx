"use client";

import type { GraphNode } from "../lib/types";

interface DetailPanelProps {
  node: GraphNode | null;
  connections: GraphNode[];
  onSelectNode: (id: string) => void;
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "active") return null;
  const color = status === "stale" ? "text-amber-400 bg-amber-400/10" : "text-slate-400 bg-slate-400/10";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>{status}</span>;
}

export default function DetailPanel({ node, connections, onSelectNode }: DetailPanelProps) {
  if (!node) {
    return <p className="text-sm text-gray-500">Click a node to see its details.</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-semibold leading-snug ${node.type === "file" ? "font-mono text-[13px]" : ""}`}>{node.label}</h3>
        <StatusBadge status={node.status} />
      </div>

      {node.type === "memory" && node.date && <div className="text-xs text-gray-500">{node.date}</div>}
      {node.type !== "memory" && <div className="text-xs uppercase tracking-wide text-gray-500">{node.type}</div>}

      {node.tags && node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      {node.summary && <p className="leading-relaxed text-gray-300">{node.summary}</p>}

      {node.refs && node.refs.length > 0 && (
        <div>
          <h4 className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">References</h4>
          <ul className="space-y-1">
            {node.refs.map((ref) => (
              <li key={ref} className="break-words font-mono text-[12px] text-gray-400">
                {ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {connections.length > 0 && (
        <div>
          <h4 className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
            {node.type === "memory" ? "Connects to" : `Memories (${connections.length})`}
          </h4>
          <ul className="space-y-1">
            {connections.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(c.id)}
                  className="text-left text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  {c.label}
                  {c.status && c.status !== "active" ? ` (${c.status})` : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
