import type {
  BillingSnapshot
} from "../types";

import {
  isWithinLastDays,
  normalizeIsoDate,
  numberFromAliases,
  valueFromAliases
} from "../utils";

export function extractBilling(row: Record<string, unknown>): BillingSnapshot | null {
  const invoice = valueFromAliases(row, [
    "InvNbrDisplay",
    "Invoice",
    "Invoice Number",
  ]);

  const charge = numberFromAliases(row, ["Charge", "Charges"]);
  const payment = numberFromAliases(row, ["Payment", "Payments", "Paid"]);
  const allow = numberFromAliases(row, ["Allow", "Allowed"]);
  const adjustment = numberFromAliases(row, [
    "Adjustment",
    "Adjustments",
    "WriteOff",
    "Write Off",
  ]);

  if (!invoice && charge === 0 && payment === 0 && allow === 0) return null;

  const invoiceDate = valueFromAliases(row, ["InvDt", "Invoice Date"]);
  const paymentDate = valueFromAliases(row, ["PmtDt", "Payment Date"]);

  return {
    lastInvoiceDate: normalizeIsoDate(invoiceDate),
    lastPaymentDate: normalizeIsoDate(paymentDate),
    totalCharges90Days: isWithinLastDays(invoiceDate, 90) ? charge : 0,
    totalAllowed90Days: isWithinLastDays(invoiceDate, 90) ? allow : 0,
    totalPayments90Days: isWithinLastDays(paymentDate, 90) ? payment : 0,
    totalAdjustments90Days: isWithinLastDays(invoiceDate, 90) ? adjustment : 0,
    openBalanceEstimate: Math.max(charge - payment - adjustment, 0),
    invoiceStatus: valueFromAliases(row, [
      "InvoiceStatus",
      "Invoice Status",
      "Status",
    ]),
  };
}
