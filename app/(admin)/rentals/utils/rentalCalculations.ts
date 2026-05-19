import type { RentalStatus } from "../types/rentalTypes";

export function dateFromInput(value: string): Date | null {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculateMonthsUsed(startValue: string, endValue: string): number {
  const start = dateFromInput(startValue);
  const end = dateFromInput(endValue) ?? new Date();

  if (!start) return 0;
  if (end < start) return 0;

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  let totalMonths = years * 12 + months;

  if (end.getDate() >= start.getDate()) {
    totalMonths += 1;
  }

  return Math.max(totalMonths, 1);
}

export function deriveRentalStatus(
  status: RentalStatus,
  endDate: string
): RentalStatus {
  if (status === "Returned" || status === "Cancelled" || status === "Deleted") {
    return status;
  }

  const end = dateFromInput(endDate);
  const today = dateFromInput(todayInputValue());

  if (end && today && end < today) return "Past Due";

  return "Active";
}

export function money(value: number): string {
  return `$${value.toFixed(2)}`;
}