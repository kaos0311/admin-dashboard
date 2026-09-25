import { normalizeBarcode } from "@/lib/barcode";

import {
  makeOrderKey,
  makePatientKey,
  normalizeDob,
  normalizePhone,
  normalizeSearchText,
} from "./orderKeys";
import type {
  OrderFormState,
  OrderRow,
  OrderStatus,
  SmartReviewReason,
  SmartRouteTarget,
} from "./orderTypes";

export function isHospiceText(value: string): boolean {
  return value.toLowerCase().includes("hospice");
}

export function isArchivedStatus(status: OrderStatus): boolean {
  return status === "delivered" || status === "cancelled" || status === "archived";
}

export function getReviewReasons(order: OrderRow): SmartReviewReason[] {
  const reasons = new Set<SmartReviewReason>();

  if (!order.patientName.trim()) reasons.add("missingPatientName");
  if (!order.patientAddress.trim()) reasons.add("missingAddress");
  if (!order.productType.trim()) reasons.add("missingProduct");
  if (!order.productId.trim()) reasons.add("missingProductId");
  if (!order.dob?.trim()) reasons.add("missingDob");
  if (!order.phone?.trim()) reasons.add("missingPhone");

  if (
    order.isHospice === true ||
    isHospiceText(order.insurance || "") ||
    isHospiceText(order.facilityName || "") ||
    isHospiceText(order.notes || "")
  ) {
    reasons.add("possibleHospice");
  }

  if (!order.inventoryAllocated && order.status !== "cancelled") {
    reasons.add("inventoryNotAllocated");
  }

  if (order.status === "cancelled" && order.inventoryRestored) {
    reasons.add("cancelledInventoryRestored");
  }

  if (order.status === "archived") reasons.add("archived");

  if (order.status === "delivered" || order.status === "cancelled") {
    reasons.add("deliveredReadyForArchive");
  }

  return [...reasons];
}

export function getSmartRouteTargets(order: OrderRow): SmartRouteTarget[] {
  const targets = new Set<SmartRouteTarget>();

  targets.add("orders");
  targets.add("patients");
  targets.add("analytics");

  if (order.insurance) targets.add("insurancePatients");

  if (
    order.isHospice ||
    isHospiceText(order.insurance || "") ||
    isHospiceText(order.facilityName || "")
  ) {
    targets.add("hospicePatients");
  }

  if (order.needsReview || getReviewReasons(order).length > 0) {
    targets.add("review");
  }

  return [...targets];
}

export function validateOrderForm(data: OrderFormState): string {
  if (!data.patientName.trim()) return "Patient name is required.";
  if (!data.patientAddress.trim()) return "Patient address is required.";
  if (!data.productType.trim()) return "Product type is required.";
  if (!data.productId.trim()) return "A linked inventory item is required.";

  const purchaseCost = Number(data.purchaseCost);
  if (Number.isNaN(purchaseCost) || purchaseCost < 0) {
    return "Purchase cost must be 0 or greater.";
  }

  const quantity = Number(data.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be at least 1.";
  }

  return "";
}

export function buildSmartOrderPayload(data: OrderFormState) {
  const patientName = data.patientName.trim();
  const patientAddress = data.patientAddress.trim();
  const productType = data.productType.trim();
  const phone = data.phone.trim();
  const barcode = normalizeBarcode(data.barcode);
  const facilityName = data.facilityName.trim();
  const notes = data.notes.trim();

  const patientKey = makePatientKey({
    patientName,
    phone,
    patientAddress,
  });

  const orderKey = makeOrderKey({
    patientName,
    productType,
    createdAt: new Date(),
  });

  const searchText = normalizeSearchText(
    [
      patientName,
      patientAddress,
      productType,
      phone,
      facilityName,
      notes,
      barcode,
      patientKey,
      orderKey,
    ].join(" ")
  );

  const reviewReasons: SmartReviewReason[] = [];
  if (!phone) reviewReasons.push("missingPhone");

  return {
    patientName,
    patientAddress,
    productId: data.productId.trim(),
    productType,
    purchaseCost: Number(data.purchaseCost),
    quantity: Number(data.quantity),
    barcode,
    phone,
    facilityName,
    status: data.status,
    notes,

    isHospice: false,

    inventoryAllocated: false,
    inventoryAllocationSourceId: "",
    inventoryRestored: false,

    patientKey,
    orderKey,

    normalizedName: normalizeSearchText(patientName),
    normalizedDob: normalizeDob(""),
    normalizedPhone: normalizePhone(phone),
    normalizedAddress: normalizeSearchText(patientAddress),

    needsReview: reviewReasons.length > 0,
    reviewReasons,
    smartRouteTargets: ["orders", "patients", "analytics"] as SmartRouteTarget[],

    linkedPatientId: "",
    linkedInventoryId: data.productId.trim(),

    searchText,
  };
}

export function getReviewReasonLabel(reason: SmartReviewReason): string {
  const labels: Record<SmartReviewReason, string> = {
    missingPatientName: "Missing patient",
    missingAddress: "Missing address",
    missingProduct: "Missing product",
    missingProductId: "No linked inventory",
    missingDob: "Missing DOB",
    missingPhone: "Missing phone",
    possibleHospice: "Possible hospice",
    inventoryNotAllocated: "Inventory not allocated",
    cancelledInventoryRestored: "Cancelled/restored",
    archived: "Archived",
    deliveredReadyForArchive: "Ready to archive",
    duplicateRisk: "Duplicate risk",
  };

  return labels[reason];
}