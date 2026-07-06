"use client";

import { Loader2 } from "lucide-react";
import { glass, typography } from "@/theme";

export function InventoryLoadingState() {
  return (
    <div className={`${glass.insetPadded} space-y-3`}>
      <div className={`flex items-center gap-2 ${typography.body}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inventory...
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className={`${glass.card} h-20 animate-pulse`} />
        <div className={`${glass.card} h-20 animate-pulse`} />
        <div className={`${glass.card} h-20 animate-pulse`} />
      </div>
    </div>
  );
}



