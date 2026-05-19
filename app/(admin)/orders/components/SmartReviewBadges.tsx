"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { getReviewReasonLabel } from "../lib/orderValidation";
import type { OrderRow } from "../lib/orderTypes";

export function SmartReviewBadges({ order }: { order: OrderRow }) {
  const reasons = order.reviewReasons || [];

  if (!order.needsReview && reasons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden={true} />
        Clean
      </span>
    );
  }

  return (
    <div className="flex max-w-xs flex-wrap gap-1.5">
      {reasons.slice(0, 4).map((reason) => (
        <span
          key={reason}
          className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden={true} />
          {getReviewReasonLabel(reason)}
        </span>
      ))}

      {reasons.length > 4 ? (
        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-zinc-300">
          +{reasons.length - 4}
        </span>
      ) : null}
    </div>
  );
}