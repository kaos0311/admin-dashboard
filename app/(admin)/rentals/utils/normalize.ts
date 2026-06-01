import type {
  RentalCondition,
  RentalProductOption,
  RentalRecord,
  RentalStatus,
} from "../rentals-types";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeStatus(value: unknown): RentalStatus {
  const clean = readString(value);

  if (
    clean === "available" ||
    clean === "checked_out" ||
    clean === "overdue" ||
    clean === "maintenance" ||
    clean === "retired"
  ) {
    return clean;
  }

  return "available";
}

function normalizeCondition(value: unknown): RentalCondition {
  const clean = readString(value);

  if (
    clean === "new" ||
    clean === "good" ||
    clean === "fair" ||
    clean === "poor" ||
    clean === "damaged"
  ) {
    return clean;
  }

  return "good";
}

export function normalizeRentalRecord(
  id: string,
  data: Record<string, unknown>
): RentalRecord {
  return {
    id,
    productId: readString(data.productId),
    productName: readString(data.productName),
    serialNumber: readString(data.serialNumber),
    assetTag: readString(data.assetTag),
    patientName: readString(data.patientName),
    patientId: readString(data.patientId),
    location: readString(data.location),
    status: normalizeStatus(data.status),
    condition: normalizeCondition(data.condition),
    checkedOutDate: readString(data.checkedOutDate),
    expectedReturnDate: readString(data.expectedReturnDate),
    returnedDate: readString(data.returnedDate),
    monthlyRate: readNumber(data.monthlyRate),
    notes: readString(data.notes),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function normalizeRentalProductOption(
  id: string,
  data: Record<string, unknown>
): RentalProductOption {
  const name =
    readString(data.name) ||
    readString(data.productName) ||
    readString(data.title) ||
    "Unnamed Product";

  return {
    id,
    name,
    sku: readString(data.sku),
    hcpcs: readString(data.hcpcs) || readString(data.hcpcsCode),
    rentalEligible:
      data.rentalEligible === true ||
      data.isRental === true ||
      readString(data.category).toLowerCase().includes("rental"),
  };
}


