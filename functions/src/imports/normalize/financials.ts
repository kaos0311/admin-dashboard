import type { NormalizedFinancials, RawImportRow } from "../types";

function cleanNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(
    String(value)
      .replace(/[$,]/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(row: RawImportRow, keys: string[]): number {
  for (const key of keys) {
    const value = cleanNumber(row[key]);
    if (value !== 0) return value;
  }

  return 0;
}

export function normalizeFinancials(row: RawImportRow): NormalizedFinancials {
  const chargeAmount = firstNumber(row, [
    "chargeAmount",
    "Charge Amount",
    "charge",
    "Charge",
    "amount",
    "Amount",
    "total",
    "Total",
  ]);

  const allowedAmount = firstNumber(row, [
    "allowedAmount",
    "Allowed Amount",
    "allowed",
    "Allowed",
  ]);

  const paidAmount = firstNumber(row, [
    "paidAmount",
    "Paid Amount",
    "payment",
    "Payment",
    "payments",
    "Payments",
  ]);

  const balanceAmount = firstNumber(row, [
    "balanceAmount",
    "Balance Amount",
    "balance",
    "Balance",
    "openBalance",
    "Open Balance",
  ]);

  return {
    chargeAmount,
    allowedAmount,
    paidAmount,
    balanceAmount,
  };
}