"use client";

import { Loader2 } from "lucide-react";

export function InventoryLoadingState() {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inventory...
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}