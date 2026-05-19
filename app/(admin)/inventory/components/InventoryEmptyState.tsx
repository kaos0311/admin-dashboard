"use client";

import { ClipboardList } from "lucide-react";

export function InventoryEmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center shadow-inner shadow-black/20">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
        <ClipboardList className="h-6 w-6 text-slate-300" />
      </div>

      <h3 className="font-semibold text-white">No inventory records found.</h3>

      <p className="mt-1 text-sm text-slate-400">
        Adjust filters or add a new item. Truly advanced civilization stuff.
      </p>
    </div>
  );
}