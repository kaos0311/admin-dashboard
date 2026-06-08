"use client";

import {
  formatWipPriority,
  formatWipStatus,
  type WipPriority,
  type WipStatus,
} from "@/lib/reports/wip";

type BadgeProps =
  | {
      type: "status";
      value: WipStatus;
    }
  | {
      type: "priority";
      value: WipPriority;
    };

export function WipStatusBadge({ type, value }: BadgeProps) {
  const className =
    type === "priority"
      ? getPriorityClass(value)
      : getStatusClass(value);

  const label =
    type === "priority"
      ? formatWipPriority(value)
      : formatWipStatus(value);

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function getStatusClass(status: WipStatus) {
  switch (status) {
    case "open":
      return "border-amber-300/25 bg-amber-400/10 text-amber-200";
    case "pending":
      return "border-sky-300/25 bg-sky-400/10 text-sky-200";
    case "completed":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-200";
    case "cancelled":
      return "border-slate-300/20 bg-slate-400/10 text-slate-300";
  }
}

function getPriorityClass(priority: WipPriority) {
  switch (priority) {
    case "critical":
      return "border-red-300/25 bg-red-400/10 text-red-200";
    case "high":
      return "border-orange-300/25 bg-orange-400/10 text-orange-200";
    case "normal":
      return "border-sky-300/25 bg-sky-400/10 text-sky-200";
    case "low":
      return "border-slate-300/20 bg-slate-400/10 text-slate-300";
  }
}




