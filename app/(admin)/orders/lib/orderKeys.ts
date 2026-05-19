import type { ImportReportType } from "./orderTypes";

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeCompact(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

export function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

export function normalizeDob(value: string): string {
  return normalizeSearchText(value);
}

export function makePatientKey(input: {
  patientName: string;
  dob?: string;
  phone?: string;
  patientAddress?: string;
}): string {
  const name = normalizeSearchText(input.patientName);
  const dob = normalizeDob(input.dob || "");
  const phone = normalizePhone(input.phone || "");
  const address = normalizeCompact(input.patientAddress || "");

  if (name && dob) return `${name}|dob:${dob}`;
  if (name && phone) return `${name}|phone:${phone}`;
  if (name && address) return `${name}|addr:${address.slice(0, 36)}`;

  return name || "";
}

export function makeOrderKey(input: {
  salesOrderNumber?: string;
  customerId?: string;
  patientName: string;
  dob?: string;
  productType: string;
  createdAt?: Date | null;
}): string {
  const salesOrderNumber = normalizeCompact(input.salesOrderNumber || "");
  const customerId = normalizeCompact(input.customerId || "");

  if (salesOrderNumber) return `so:${salesOrderNumber}`;

  if (customerId && input.productType) {
    return `customer:${customerId}|product:${normalizeCompact(
      input.productType
    )}`;
  }

  return normalizeSearchText(
    [
      input.patientName,
      input.dob || "",
      input.productType,
      input.createdAt ? input.createdAt.toISOString().slice(0, 10) : "",
    ].join(" ")
  );
}

export function makeDuplicateImportKey(
  file: File,
  reportType: ImportReportType
): string {
  return normalizeSearchText(`${reportType}_${file.name}_${file.size}`);
}