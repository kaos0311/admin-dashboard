import type { RentalRecord } from "../rentals-types";

export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function rentalMatchesSearch(
  record: RentalRecord,
  search: string
): boolean {
  const query = normalizeSearch(search);
  if (!query) return true;

  const haystack = normalizeSearch(
    [
      record.productName,
      record.itemId,
      record.itemGroup,
      record.procCode,
      record.modifiers,
      record.serialNumber,
      record.assetNumber,
      record.assetTag,
      record.patientName,
      record.patientId,
      record.patientDob,
      record.phone,
      record.location,
      record.status,
      record.condition,
      record.insuranceName,
      record.payor,
      record.planType,
      record.parNumber,
      record.parExpiration,
      record.itemDiagnosis,
      record.orderingDoctor,
      record.primaryDoctor,
      record.orderDocNpi,
      record.primaryDocNpi,
      record.salesOrderId,
      record.salesOrderDetailId,
      record.notes,
    ].join(" ")
  );

  return haystack.includes(query);
}


