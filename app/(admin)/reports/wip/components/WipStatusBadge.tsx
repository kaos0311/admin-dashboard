"use client";

import {
  formatWipPriority,
  formatWipStatus,
  type WipPriority,
  type WipStatus,
} from "@/lib/reports/wip";
import { colors } from "@/theme";

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

function getStatusClass(_status: WipStatus) {
  return colors.neutralBadge;
}

function getPriorityClass(_priority: WipPriority) {
  return colors.neutralBadge;
}
