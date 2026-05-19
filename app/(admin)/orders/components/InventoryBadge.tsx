"use client";

import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

import type { OrderRow } from "../lib/orderTypes";

export function InventoryBadge({ order }: { order: OrderRow }) {
  if (order.inventoryRestored) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden={true} />
        Restored
      </span>
    );
  }

  if (order.inventoryAllocated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden={true} />
        Allocated
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-100">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden={true} />
      Missing
    </span>
  );
}