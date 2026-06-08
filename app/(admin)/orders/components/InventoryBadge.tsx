"use client";

import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

import { colors } from "@/theme";

import type { OrderRow } from "../lib/orderTypes";

const badgeBase =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold";

export function InventoryBadge({ order }: { order: OrderRow }) {
  if (order.inventoryRestored) {
    return (
      <span className={`${badgeBase} ${colors.warningBadge}`}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Restored
      </span>
    );
  }

  if (order.inventoryAllocated) {
    return (
      <span className={`${badgeBase} ${colors.successBadge}`}>
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Allocated
      </span>
    );
  }

  return (
    <span className={`${badgeBase} ${colors.dangerBadge}`}>
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      Missing
    </span>
  );
}



