export type RentalStatus = "Active" | "Due Soon" | "Returned" | "Overdue";
export type PaymentStatus = "unpaid" | "paid" | "late";

export type RentalPayment = {
  monthIndex: number;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  reminderSent?: boolean;
  paidAt?: string | null;
};

export function addMonthsSafe(dateString: string, monthsToAdd: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  const originalDay = date.getDate();

  date.setMonth(date.getMonth() + monthsToAdd);

  if (date.getDate() < originalDay) {
    date.setDate(0);
  }

  return date.toISOString().slice(0, 10);
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildPaymentSchedule(
  startDate: string,
  termMonths: number,
  monthlyAmount: number
): RentalPayment[] {
  return Array.from({ length: termMonths }, (_, index) => ({
    monthIndex: index + 1,
    dueDate: addMonthsSafe(startDate, index),
    amount: monthlyAmount,
    status: "unpaid",
    reminderSent: false,
    paidAt: null,
  }));
}

export function getNextDueDateFromPayments(
  payments: Array<Pick<RentalPayment, "dueDate" | "status">>
): string {
  const unpaid = payments
    .filter((p) => p.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return unpaid[0]?.dueDate ?? "";
}

export function getRentalStatusFromPayments(
  payments: Array<Pick<RentalPayment, "dueDate" | "status">>,
  fallback: RentalStatus = "Active"
): RentalStatus {
  if (!payments.length) return fallback;

  const today = todayDateString();

  const unpaid = payments
    .filter((p) => p.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (!unpaid.length) {
    return "Returned";
  }

  const nextDue = unpaid[0].dueDate;

  if (nextDue < today) return "Overdue";

  const diffDays = Math.ceil(
    (new Date(`${nextDue}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 5) return "Due Soon";

  return "Active";
}

export function currency(amount?: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount ?? 0);
}