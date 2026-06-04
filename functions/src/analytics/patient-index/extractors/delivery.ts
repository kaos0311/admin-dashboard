import type {
  DeliverySummary
} from "../types";

import {
  normalizeIsoDate,
  valueFromAliases
} from "../utils";

export function extractDelivery(row: Record<string, unknown>): DeliverySummary | null {
  const salesOrderId = valueFromAliases(row, [
    "Sales Order",
    "SalesOrderId",
    "Sales Order ID",
    "SO",
  ]);

  const deliveryDate = normalizeIsoDate(
    valueFromAliases(row, [
      "ActualDeliveryDate",
      "Delivery Date",
      "Delivered Date",
    ])
  );

  const scheduledDate = normalizeIsoDate(
    valueFromAliases(row, ["SchedDeliveryDate", "Scheduled Delivery Date"])
  );

  const comments = valueFromAliases(row, [
    "Comments or Special Instructions",
    "Comments",
    "Special Instructions",
    "notes",
  ]);

  if (!salesOrderId && !deliveryDate && !scheduledDate && !comments) return null;

  return {
    salesOrderId,
    salesOrderStatus: valueFromAliases(row, [
      "SalesOrderStatus",
      "Sales Order Status",
    ]),
    actualDeliveryDate: deliveryDate,
    scheduledDeliveryDate: scheduledDate,
    deliveryTechName: valueFromAliases(row, [
      "DeliveryTechName",
      "Delivery Tech",
      "Technician",
    ]),
    csr: valueFromAliases(row, ["CSR"]),
    branch: valueFromAliases(row, ["Branch"]),
    comments,
    hipaaSignatureOnFile: valueFromAliases(row, [
      "HIPAA Signature on file",
      "HIPAA",
      "HipaaSignatureOnFile",
    ]),
  };
}
