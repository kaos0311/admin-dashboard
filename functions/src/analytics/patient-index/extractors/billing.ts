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
  const invoiceCreateDate = valueFromAliases(row, ["InvoiceCreateDate"]);
  const invoiceOpenDate = valueFromAliases(row, ["InvoiceOpenDate"]);
  const invoiceServiceDate = valueFromAliases(row, ["InvoiceServiceDate"]);
  const invoiceDocumentDate = valueFromAliases(row, ["InvoiceDocumentDate"]);
  const paymentCreateDate = valueFromAliases(row, ["PaymentCreateDate"]);
  const paymentPostedDate = valueFromAliases(row, ["PaymentPostedDate"]);

  return {
    lastInvoiceDate: normalizeIsoDate(invoiceDate),
    lastPaymentDate: normalizeIsoDate(paymentDate),
    invoiceCreateDate: normalizeIsoDate(invoiceCreateDate),
    invoiceOpenDate: normalizeIsoDate(invoiceOpenDate),
    invoiceServiceDate: normalizeIsoDate(invoiceServiceDate),
    invoiceDocumentDate: normalizeIsoDate(invoiceDocumentDate),
    paymentCreateDate: normalizeIsoDate(paymentCreateDate),
    paymentPostedDate: normalizeIsoDate(paymentPostedDate),
    paymentDos: normalizeIsoDate(valueFromAliases(row, ["PaymentDOS"])),
    paymentReason: valueFromAliases(row, ["PaymentReason"]),
    saleType: valueFromAliases(row, ["SaleType"]),
    transactionType: valueFromAliases(row, ["TransType"]),
    lastPickupDate: normalizeIsoDate(valueFromAliases(row, ["LastPickupDate"])),
    totalCharges90Days: isWithinLastDays(invoiceDate, 90) ? charge : 0,
    totalAllowed90Days: isWithinLastDays(invoiceDate, 90) ? allow : 0,
    totalPayments90Days: isWithinLastDays(paymentDate, 90) ? payment : 0,
    totalAdjustments90Days: isWithinLastDays(invoiceDate, 90) ? adjustment : 0,
    openBalanceEstimate: Math.max(charge - payment - adjustment, 0),
    appliedPayment: numberFromAliases(row, ["AppliedPayment"]),
    invoiceStatus: valueFromAliases(row, [
      "InvoiceStatus",
      "Invoice Status",
      "Status",
    ]),
  };
}
