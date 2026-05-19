"use client";

import { CheckSquare } from "lucide-react";

type InventoryBatchActionsProps = {
  selectedCount: number;
  selectedVisibleCount: number;
  onToggleSelectAll: () => void;
  onBatchDiscontinue: () => void;
  onBatchArchive: () => void;
};

export function InventoryBatchActions({
  selectedCount,
  selectedVisibleCount,
  onToggleSelectAll,
  onBatchDiscontinue,
  onBatchArchive,
}: InventoryBatchActionsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onToggleSelectAll}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-white/15"
      >
        <CheckSquare className="h-4 w-4" />
        Select Visible
      </button>

      <button
        type="button"
        onClick={onBatchDiscontinue}
        disabled={!selectedCount}
        className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Discontinue Selected
      </button>

      <button
        type="button"
        onClick={onBatchArchive}
        disabled={!selectedCount}
        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Archive Selected
      </button>

      <span className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-slate-400 shadow-inner shadow-black/20 backdrop-blur-xl">
        Selected: {selectedCount}
        {selectedVisibleCount !== selectedCount
          ? ` (${selectedVisibleCount} visible)`
          : ""}
      </span>
    </div>
  );
}