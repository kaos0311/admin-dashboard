"use client";

import { buttons, colors } from "@/theme";
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
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleSelectAll}
        className={buttons.secondary}
      >
        <CheckSquare className="h-4 w-4" />
        Select Visible
      </button>

      <button
        type="button"
        onClick={onBatchDiscontinue}
        disabled={!selectedCount}
        className={buttons.warning}
      >
        Discontinue Selected
      </button>

      <button
        type="button"
        onClick={onBatchArchive}
        disabled={!selectedCount}
        className={buttons.danger}
      >
        Archive Selected
      </button>

      <span className={`rounded-xl border ${colors.border} ${colors.surface} px-4 py-2 text-sm ${colors.textMuted}`}>
        Selected: {selectedCount}
        {selectedVisibleCount !== selectedCount
          ? ` (${selectedVisibleCount} visible)`
          : ""}
      </span>
    </div>
  );
}
