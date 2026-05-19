import type {
  BillingCycle,
  DeliveryStatus,
  ProductOption,
  Rental,
  RentalStatus,
} from "../types/rentalTypes";
import {
  calculateMonthsUsed,
  deriveRentalStatus,
} from "./rentalCalculations";

export function toSafeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function toSafeNumber(value: unknown): number {
  if (value === "" || value == null) return 0;

  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeBillingCycle(value: unknown): BillingCycle {
  if (value === "Weekly" || value === "Daily") return value;
  return "Monthly";
}

export function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  if (
    value === "Scheduled" ||
    value === "Delivered" ||
    value === "Pickup Scheduled" ||
    value === "Picked Up" ||
    value === "Cleaning" ||
    value === "Ready"
  ) {
    return value;
  }

  return "Not Scheduled";
}

export function normalizeRentalStatus(value: unknown): RentalStatus {
  if (
    value === "Returned" ||
    value === "Cancelled" ||
    value === "Past Due" ||
    value === "Deleted"
  ) {
    return value;
  }

  return "Active";
}

export function normalizeProduct(
  id: string,
  data: Record<string, unknown>
): ProductOption {
  return {
    id,
    name: toSafeString(data.name),
    category: toSafeString(data.category),
    sku: toSafeString(data.sku),
    upc: toSafeString(data.upc),
    basePrice: toSafeNumber(data.basePrice),
    isRentalItem: Boolean(data.isRentalItem),
    status: data.status === "inactive" ? "inactive" : "active",
  };
}

export function normalizeRental(
  id: string,
  data: Record<string, unknown>
): Rental {
  const rentalStartDate = toSafeString(data.rentalStartDate);
  const rentalEndDate = toSafeString(data.rentalEndDate);
  const monthlyRate = toSafeNumber(data.monthlyRate);

  const monthsUsed =
    data.monthsUsed == null
      ? calculateMonthsUsed(rentalStartDate, rentalEndDate)
      : toSafeNumber(data.monthsUsed);

  const rawStatus = normalizeRentalStatus(data.status);
  const status = deriveRentalStatus(rawStatus, rentalEndDate);

  return {
    id,
    productId: toSafeString(data.productId),
    productName: toSafeString(data.productName),
    category: toSafeString(data.category),
    sku: toSafeString(data.sku),
    serialNumber: toSafeString(data.serialNumber),
    lotNumber: toSafeString(data.lotNumber),
    customerName: toSafeString(data.customerName),
    patientName: toSafeString(data.patientName),
    patientId: toSafeString(data.patientId),
    payerName: toSafeString(data.payerName),
    insuranceType: toSafeString(data.insuranceType),
    authorizationNumber: toSafeString(data.authorizationNumber),
    rentalStartDate,
    rentalEndDate,
    monthsUsed,
    monthlyRate,
    totalCharges:
      data.totalCharges == null
        ? monthlyRate * monthsUsed
        : toSafeNumber(data.totalCharges),
    billingCycle: normalizeBillingCycle(data.billingCycle),
    status,
    deliveryStatus: normalizeDeliveryStatus(data.deliveryStatus),
    deliveryDate: toSafeString(data.deliveryDate),
    pickupDate: toSafeString(data.pickupDate),
    location: toSafeString(data.location),
    assignedTo: toSafeString(data.assignedTo),
    notes: toSafeString(data.notes),
  };
}