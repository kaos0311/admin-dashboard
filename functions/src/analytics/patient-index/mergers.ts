import type {
  BillingSnapshot,
  CpapInfo
} from "./types";

export function mergeCpap(
  existing: CpapInfo | null,
  next: CpapInfo | null
): CpapInfo | null {
  if (!existing && !next) return null;
  if (!existing) return next;
  if (!next) return existing;

  return {
    onRecord: existing.onRecord || next.onRecord,
    machine: next.machine || existing.machine,
    maskType: next.maskType || existing.maskType,
    humidifier: next.humidifier || existing.humidifier,
    tubing: next.tubing || existing.tubing,
    filters: next.filters || existing.filters,
    headgear: next.headgear || existing.headgear,
    pressure: next.pressure || existing.pressure,
    serialNumber: next.serialNumber || existing.serialNumber,
    setupDate: next.setupDate || existing.setupDate,
    lastServiceDate: next.lastServiceDate || existing.lastServiceDate,
    complianceStatus: next.complianceStatus || existing.complianceStatus,
  };
}

export function mergeBilling(
  existing: BillingSnapshot | null,
  next: BillingSnapshot | null
): BillingSnapshot | null {
  if (!existing && !next) return null;
  if (!existing) return next;
  if (!next) return existing;

  return {
    lastInvoiceDate: next.lastInvoiceDate || existing.lastInvoiceDate,
    lastPaymentDate: next.lastPaymentDate || existing.lastPaymentDate,
    totalCharges90Days: existing.totalCharges90Days + next.totalCharges90Days,
    totalAllowed90Days: existing.totalAllowed90Days + next.totalAllowed90Days,
    totalPayments90Days: existing.totalPayments90Days + next.totalPayments90Days,
    totalAdjustments90Days:
      existing.totalAdjustments90Days + next.totalAdjustments90Days,
    openBalanceEstimate: existing.openBalanceEstimate + next.openBalanceEstimate,
    invoiceStatus: next.invoiceStatus || existing.invoiceStatus,
  };
}
