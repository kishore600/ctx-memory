"use client";

import type { GraphNode, GraphStats, StatusFilters, TypeFilters } from "../lib/types";
import DetailPanel from "./DetailPanel";

interface SidebarProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilters: TypeFilters;
  onToggleType: (type: keyof TypeFilters) => void;
  statusFilters: StatusFilters;
  onToggleStatus: (status: keyof StatusFilters) => void;
  stats: GraphStats;
  selectedNode: GraphNode | null;
  connections: GraphNode[];
  onSelectNode: (id: string) => void;
  lastUpdated: Date | null;
  onRefresh: () => void;
  error: string | null;
}

const TYPE_OPTIONS: { key: keyof TypeFilters; label: string; dot: string }[] = [
  { key: "memory", label: "Memories", dot: "bg-indigo-500" },
  { key: "file", label: "Files", dot: "bg-emerald-500" },
  { key: "tag", label: "Tags", dot: "bg-purple-500" },
];

const STATUS_OPTIONS: { key: keyof StatusFilters; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "stale", label: "Stale" },
  { key: "superseded", label: "Superseded" },
];

export default function Sidebar({
  search,
  onSearchChange,
  typeFilters,
  onToggleType,
  statusFilters,
  onToggleStatus,
  stats,
  selectedNode,
  connections,
  onSelectNode,
  lastUpdated,
  onRefresh,
  error,
}: SidebarProps) {
  return (
    <aside className="scrollbar-thin flex w-[360px] flex-none flex-col gap-5 overflow-y-auto border-r border-white/10 bg-[#0f1420] p-5">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-white">WhyAnchor</h1>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh now"
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
          >
            Refresh
          </button>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refreshes` : "Loading…"}
        </p>
        {error && <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</p>}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search nodes…"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
      />

      <div>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">Type</h2>
        <div className="flex flex-col gap-1.5">
          {TYPE_OPTIONS.map(({ key, label, dot }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={typeFilters[key]}
                onChange={() => onToggleType(key)}
                className="accent-indigo-500"
              />
              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">Status</h2>
        <div className="flex flex-col gap-1.5">
          {STATUS_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={statusFilters[key]}
                onChange={() => onToggleStatus(key)}
                className="accent-indigo-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {stats.memory} memories · {stats.file} files · {stats.tag} tags · {stats.edges} links
      </p>

      <div className="border-t border-white/10 pt-4">
        <DetailPanel node={selectedNode} connections={connections} onSelectNode={onSelectNode} />
      </div>
    </aside>
  );
}
