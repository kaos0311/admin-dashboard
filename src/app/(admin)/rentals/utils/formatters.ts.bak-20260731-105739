import type { RentalCondition, RentalStatus } from "../rentals-types";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string): string {
  if (!value) return "â€”";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "â€”";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatStatus(status: RentalStatus): string {
  const map: Record<RentalStatus, string> = {
    available: "Available",
    checked_out: "Checked Out",
    overdue: "Overdue",
    maintenance: "Maintenance",
    retired: "Retired",
  };

  return map[status] ?? "Unknown";
}

export function formatCondition(condition: RentalCondition): string {
  const map: Record<RentalCondition, string> = {
    new: "New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    damaged: "Damaged",
  };

  return map[condition] ?? "Unknown";
}


