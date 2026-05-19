import { Timestamp } from "firebase/firestore";

import {
  makeOrderKey,
  makePatientKey,
  normalizeDob,
  normalizePhone,
  normalizeSearchText,
} from "./orderKeys";
import { getReviewReasons, getSmartRouteTargets } from "./orderValidation";
import type {
  ImportJob,
  ImportJobStatus,
  OrderRow,
  OrderStatus,
  SmartReviewReason,
  SmartRouteTarget,
} from "./orderTypes";

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function normalizeOrder(
  id: string,
  data: Record<string, unknown>
): OrderRow {
  const statusRaw =
    typeof data.status === "string" ? data.status.toLowerCase() : "processing";

  const status: OrderStatus =
    statusRaw === "ready" ||
    statusRaw === "delivered" ||
    statusRaw === "cancelled" ||
    statusRaw === "archived"
      ? statusRaw
      : "processing";

  const createdAt = toDateSafe(data.createdAt);

  const baseOrder: OrderRow = {
    id,
    patientName:
      typeof data.patientName === "string"
        ? data.patientName
        : typeof data.customerName === "string"
          ? data.customerName
          : "",
    patientAddress:
      typeof data.patientAddress === "string"
        ? data.patientAddress
        : typeof data.address === "string"
          ? data.address
          : "",
    productId: typeof data.productId === "string" ? data.productId : "",
    productType:
      typeof data.productType === "string"
        ? data.productType
        : typeof data.item === "string"
          ? data.item
          : typeof data.productName === "string"
            ? data.productName
            : "",
    purchaseCost:
      typeof data.purchaseCost === "number"
        ? data.purchaseCost
        : typeof data.cost === "number"
          ? data.cost
          : typeof data.price === "number"
            ? data.price
            : 0,
    quantity:
      typeof data.quantity === "number" && Number.isFinite(data.quantity)
        ? data.quantity
        : 1,
    barcode: typeof data.barcode === "string" ? data.barcode : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    facilityName:
      typeof data.facilityName === "string"
        ? data.facilityName
        : typeof data.facility === "string"
          ? data.facility
          : "",
    status,
    notes: typeof data.notes === "string" ? data.notes : "",
    createdAt,
    updatedAt: toDateSafe(data.updatedAt),

    sourceImportId:
      typeof data.sourceImportId === "string" ? data.sourceImportId : "",
    sourceReportType:
      typeof data.sourceReportType === "string" ? data.sourceReportType : "",
    salesOrderNumber:
      typeof data.salesOrderNumber === "string" ? data.salesOrderNumber : "",
    customerId: typeof data.customerId === "string" ? data.customerId : "",
    dob: typeof data.dob === "string" ? data.dob : "",
    insurance: typeof data.insurance === "string" ? data.insurance : "",

    isHospice: data.isHospice === true,

    inventoryAllocated: data.inventoryAllocated === true,
    inventoryAllocationSourceId:
      typeof data.inventoryAllocationSourceId === "string"
        ? data.inventoryAllocationSourceId
        : "",
    inventoryRestored: data.inventoryRestored === true,

    searchText: typeof data.searchText === "string" ? data.searchText : "",
    patientKey: typeof data.patientKey === "string" ? data.patientKey : "",
    orderKey: typeof data.orderKey === "string" ? data.orderKey : "",

    normalizedName:
      typeof data.normalizedName === "string" ? data.normalizedName : "",
    normalizedDob:
      typeof data.normalizedDob === "string" ? data.normalizedDob : "",
    normalizedPhone:
      typeof data.normalizedPhone === "string" ? data.normalizedPhone : "",
    normalizedAddress:
      typeof data.normalizedAddress === "string" ? data.normalizedAddress : "",

    needsReview: data.needsReview === true,

    reviewReasons: Array.isArray(data.reviewReasons)
      ? data.reviewReasons.filter(
          (item): item is SmartReviewReason => typeof item === "string"
        )
      : [],

    smartRouteTargets: Array.isArray(data.smartRouteTargets)
      ? data.smartRouteTargets.filter(
          (item): item is SmartRouteTarget => typeof item === "string"
        )
      : [],

    linkedPatientId:
      typeof data.linkedPatientId === "string" ? data.linkedPatientId : "",
    linkedInventoryId:
      typeof data.linkedInventoryId === "string" ? data.linkedInventoryId : "",
  };

  const reviewReasons = baseOrder.reviewReasons?.length
    ? baseOrder.reviewReasons
    : getReviewReasons(baseOrder);

  const patientKey =
    baseOrder.patientKey ||
    makePatientKey({
      patientName: baseOrder.patientName,
      dob: baseOrder.dob,
      phone: baseOrder.phone,
      patientAddress: baseOrder.patientAddress,
    });

  const orderKey =
    baseOrder.orderKey ||
    makeOrderKey({
      salesOrderNumber: baseOrder.salesOrderNumber,
      customerId: baseOrder.customerId,
      patientName: baseOrder.patientName,
      dob: baseOrder.dob,
      productType: baseOrder.productType,
      createdAt,
    });

  return {
    ...baseOrder,
    patientKey,
    orderKey,
    normalizedName:
      baseOrder.normalizedName || normalizeSearchText(baseOrder.patientName),
    normalizedDob: baseOrder.normalizedDob || normalizeDob(baseOrder.dob || ""),
    normalizedPhone:
      baseOrder.normalizedPhone || normalizePhone(baseOrder.phone || ""),
    normalizedAddress:
      baseOrder.normalizedAddress ||
      normalizeSearchText(baseOrder.patientAddress),
    needsReview: baseOrder.needsReview || reviewReasons.length > 0,
    reviewReasons,
    smartRouteTargets: baseOrder.smartRouteTargets?.length
      ? baseOrder.smartRouteTargets
      : getSmartRouteTargets({ ...baseOrder, reviewReasons }),
  };
}

export function normalizeImportJob(
  id: string,
  data: Record<string, unknown>
): ImportJob {
  const statusRaw = typeof data.status === "string" ? data.status : "uploaded";

  const status: ImportJobStatus =
    statusRaw === "processing" ||
    statusRaw === "complete" ||
    statusRaw === "empty" ||
    statusRaw === "failed"
      ? statusRaw
      : "uploaded";

  return {
    id,
    reportType: typeof data.reportType === "string" ? data.reportType : "",
    detectedReportType:
      typeof data.detectedReportType === "string"
        ? data.detectedReportType
        : "",
    detectionConfidence:
      typeof data.detectionConfidence === "number"
        ? data.detectionConfidence
        : 0,
    fileName: typeof data.fileName === "string" ? data.fileName : "",
    fileSize: typeof data.fileSize === "number" ? data.fileSize : 0,
    status,
    rowCount: typeof data.rowCount === "number" ? data.rowCount : 0,
    skippedHospiceRows:
      typeof data.skippedHospiceRows === "number"
        ? data.skippedHospiceRows
        : 0,
    duplicateRows:
      typeof data.duplicateRows === "number" ? data.duplicateRows : 0,
    missingDobRows:
      typeof data.missingDobRows === "number" ? data.missingDobRows : 0,
    missingAddressRows:
      typeof data.missingAddressRows === "number"
        ? data.missingAddressRows
        : 0,
    missingProductRows:
      typeof data.missingProductRows === "number"
        ? data.missingProductRows
        : 0,
    needsReviewRows:
      typeof data.needsReviewRows === "number" ? data.needsReviewRows : 0,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : "",
    storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
    duplicateKey:
      typeof data.duplicateKey === "string" ? data.duplicateKey : "",
    createdAt: toDateSafe(data.createdAt),
    updatedAt: toDateSafe(data.updatedAt),
    completedAt: toDateSafe(data.completedAt),
  };
}