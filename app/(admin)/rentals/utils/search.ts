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
      record.serialNumber,
      record.assetTag,
      record.patientName,
      record.patientId,
      record.location,
      record.status,
      record.condition,
      record.notes,
    ].join(" ")
  );

  return haystack.includes(query);
}


