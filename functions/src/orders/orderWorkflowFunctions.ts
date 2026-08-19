import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin } from "../inventory/auth.js";
import { orderWorkflow } from "./orderWorkflowService.js";
import type { OrderWorkflowInput } from "./orderWorkflowService.js";

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export const orderWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const actor = await requireStaffOrAdmin(request);

    const data = request.data as Record<string, unknown> | undefined;
    const action = cleanString(data?.action) as OrderWorkflowInput["action"] | undefined;

    if (!action || !["create", "cancel", "restore"].includes(action)) {
      throw new HttpsError("invalid-argument", "Invalid order action. Must be create, cancel, or restore.");
    }

    const input: OrderWorkflowInput = {
      operationId: cleanString(data?.operationId) ?? "",
      action,
      orderId: cleanString(data?.orderId),
      productId: cleanString(data?.productId) ?? "",
      quantity: cleanNumber(data?.quantity, 1),
      patientName: cleanString(data?.patientName),
      patientAddress: cleanString(data?.patientAddress),
      productType: cleanString(data?.productType),
      purchaseCost: cleanNumber(data?.purchaseCost, 0),
      barcode: cleanString(data?.barcode),
      phone: cleanString(data?.phone),
      facilityName: cleanString(data?.facilityName),
      notes: cleanString(data?.notes),
    };

    if (!input.operationId) {
      throw new HttpsError("invalid-argument", "operationId is required.");
    }

    const database = getFirestore();

    return database.runTransaction((transaction) =>
      orderWorkflow({
        database,
        transaction,
        input,
        actor,
      })
    );
  }
);
