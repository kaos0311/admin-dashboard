"use client";

import { colors, surfaces, typography } from "@/theme";

import { ClipboardList } from "lucide-react";

export function InventoryEmptyState() {
  return (
    <div className={`${surfaces.emptyState} ${colors.surfaceInset} p-8 text-center`}>
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${colors.surface} ${colors.textMuted}`}>
        <ClipboardList className={`h-6 w-6 ${typography.bodyMuted}`} />
      </div>

      <h3 className={typography.cardTitle}>No inventory records found.</h3>

      <p className={`mt-1 text-sm ${typography.bodyMuted}`}>
        Adjust filters or add a new item. Truly advanced civilization stuff.
      </p>
    </div>
  );
}

