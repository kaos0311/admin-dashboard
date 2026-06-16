"use client";

import {
  formatWipPriority,
  formatWipStatus,
  type WipPriority,
  type WipStatus,
} from "@/lib/reports/wip";
import { badges } from "@/theme";

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
      return badges.info;
    case "pending":
      return badges.info;
    case "completed":
      return badges.success;
    case "cancelled":
      return badges.neutral;
  }
}

function getPriorityClass(priority: WipPriority) {
  switch (priority) {
    case "critical":
      return badges.danger;
    case "high":
      return badges.warning;
    case "normal":
      return badges.info;
    case "low":
      return badges.neutral;
  }
}




