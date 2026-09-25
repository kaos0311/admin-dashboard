"use client";

import { colors, surfaces, tiles, typography } from "@/theme";

import { ClipboardList } from "lucide-react";

export function InventoryEmptyState() {
  return (
    <div className={`${surfaces.emptyState} ${colors.surfaceInset} p-8 text-center`}>
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${tiles.icon}`}>
        <ClipboardList className={`h-6 w-6 ${colors.textMuted}`} />
      </div>

      <h3 className={typography.cardTitle}>No inventory records found.</h3>

      <p className={`mt-1 ${typography.bodyMuted}`}>
        Adjust filters or add a new item to begin tracking inventory.
      </p>
    </div>
  );
}
