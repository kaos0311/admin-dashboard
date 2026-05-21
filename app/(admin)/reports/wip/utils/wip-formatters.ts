import type { WipPriority, WipStatus } from "../types/wip.types";

export function formatWipStatus(status: WipStatus): string {
  const map: Record<WipStatus, string> = {
    open: "Open",
    pending: "Pending",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return map[status];
}

export function formatWipPriority(priority: WipPriority): string {
  const map: Record<WipPriority, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    critical: "Critical",
  };

  return map[priority];
}