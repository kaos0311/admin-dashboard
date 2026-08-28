import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin, requireTank } from "../inventory/auth.js";
import * as deliveryWorkflowService from "./deliveryWorkflowService.js";
import { assertAdmin, assertOperationId } from "./shared.js";
import { type EmployeeEvaluationAction, employeeEvaluationWorkflow, type EmployeeEvaluationWorkflowInput } from "./employeeEvaluationWorkflowService.js";
import { type PatientEquipmentAction, patientEquipmentWorkflow } from "./patientEquipmentWorkflowService.js";
import { type PatientLifecycleAction, patientLifecycleWorkflow } from "./patientLifecycleWorkflowService.js";
import {
  cancelRentalWorkflow,
  checkoutRentalWorkflow,
  createAndCheckoutRentalWorkflow,
  exchangeRentalWorkflow,
  reportStaleRentalDrafts,
  returnRentalWorkflow,
} from "./rentalWorkflowService.js";
import { equipmentCheckInByBarcodeWorkflow } from "./scannerCheckInWorkflowService.js";

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const DELIVERY_MODES = new Set(["load", "deliver", "return"]);
const PATIENT_EQUIPMENT_ACTIONS = new Set([
  "assign",
  "remove",
  "transfer",
  "recover_deceased",
  "replace",
  "lost",
  "damaged",
  "return_to_warehouse",
]);
const PATIENT_LIFECYCLE_ACTIONS = new Set(["archive", "restore", "destroy"]);

async function requireRateLimitedStaffOrAdmin(
  request: Parameters<typeof requireStaffOrAdmin>[0],
) {
  await enforceCallableRateLimit(request, "general");
  return requireStaffOrAdmin(request);
}

export const recordDeliveryScanWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    const mode = cleanString(data?.mode) as deliveryWorkflowService.DeliveryScanMode | undefined;
    if (!mode || !DELIVERY_MODES.has(mode)) {
      throw new HttpsError("invalid-argument", "Invalid delivery mode.");
    }

    return deliveryWorkflowService.recordDeliveryScanWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        ticketId: cleanString(data?.ticketId) ?? "",
        lineId: cleanString(data?.lineId),
        inventoryItemId: cleanString(data?.inventoryItemId) ?? "",
        productId: cleanString(data?.productId),
        barcode: cleanString(data?.barcode),
        serialNumber: cleanString(data?.serialNumber),
        lotNumber: cleanString(data?.lotNumber),
        quantity: cleanNumber(data?.quantity),
        mode,
        patientId: cleanString(data?.patientId),
        patientName: cleanString(data?.patientName),
        deliveryTicketNumber: cleanString(data?.deliveryTicketNumber),
        salesOrderNumber: cleanString(data?.salesOrderNumber),
        vehicleId: cleanString(data?.vehicleId),
        truckId: cleanString(data?.truckId),
        returnCondition: cleanString(data?.returnCondition),
        returnNotes: cleanString(data?.returnNotes),
      },
      actor
    );
  }
);

export const completeDeliveryTicketWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return deliveryWorkflowService.completeDeliveryTicketWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        ticketId: cleanString(data?.ticketId) ?? "",
      },
      actor
    );
  }
);

export const finalizeDeliverySignatureWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return deliveryWorkflowService.finalizeDeliverySignatureWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        ticketId: cleanString(data?.ticketId) ?? "",
        patientId: cleanString(data?.patientId),
        signerName: cleanString(data?.signerName) ?? "",
        signerRole: cleanString(data?.signerRole) ?? "",
        signerRelationship: cleanString(data?.signerRelationship),
        witnessName: cleanString(data?.witnessName),
        refusalReason: cleanString(data?.refusalReason),
        pendingStoragePath: cleanString(data?.pendingStoragePath) ?? "",
        pendingDownloadURL: cleanString(data?.pendingDownloadURL),
        fileName: cleanString(data?.fileName),
        contentType: cleanString(data?.contentType),
        fileSize: cleanNumber(data?.fileSize),
        checksum: cleanString(data?.checksum),
      },
      actor
    );
  }
);

export const finalizeDeliveryDamagePhotosWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    const files = Array.isArray(data?.files)
      ? data.files.map((item) => {
          const file = item as Record<string, unknown>;
          return {
            pendingStoragePath: cleanString(file.pendingStoragePath) ?? "",
            pendingDownloadURL: cleanString(file.pendingDownloadURL),
            fileName: cleanString(file.fileName) ?? "damage-photo.jpg",
            contentType: cleanString(file.contentType),
            fileSize: cleanNumber(file.fileSize),
            checksum: cleanString(file.checksum),
          };
        })
      : [];

    return deliveryWorkflowService.finalizeDeliveryDamagePhotosWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        ticketId: cleanString(data?.ticketId) ?? "",
        patientId: cleanString(data?.patientId),
        files,
        damageNotes: cleanString(data?.damageNotes),
        returnCondition: cleanString(data?.returnCondition),
      },
      actor
    );
  }
);

export const deliveryTechCheckInWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return deliveryWorkflowService.deliveryTechCheckInWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        ticketId: cleanString(data?.ticketId) ?? "",
        techName: cleanString(data?.techName) ?? "",
        latitude: cleanNumber(data?.latitude) ?? Number.NaN,
        longitude: cleanNumber(data?.longitude) ?? Number.NaN,
        accuracy: cleanNumber(data?.accuracy),
      },
      actor
    );
  }
);

export const updateDeliveryRouteWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return deliveryWorkflowService.updateDeliveryRouteWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        ticketId: cleanString(data?.ticketId) ?? "",
        etaMinutes: cleanNumber(data?.etaMinutes),
        routeSequence: cleanNumber(data?.routeSequence),
        routeStatus: cleanString(data?.routeStatus),
        routeNotes: cleanString(data?.routeNotes),
      },
      actor
    );
  }
);

export const checkoutRentalWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return checkoutRentalWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        rentalId: cleanString(data?.rentalId) ?? "",
        inventoryItemId: cleanString(data?.inventoryItemId),
        productId: cleanString(data?.productId),
        patientId: cleanString(data?.patientId),
        patientName: cleanString(data?.patientName),
        serialNumber: cleanString(data?.serialNumber),
        quantity: cleanNumber(data?.quantity),
        reason: cleanString(data?.reason),
      },
      actor
    );
  }
);

export const createAndCheckoutRentalWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return createAndCheckoutRentalWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        rentalId: cleanString(data?.rentalId),
        inventoryItemId: cleanString(data?.inventoryItemId),
        productId: cleanString(data?.productId),
        patientId: cleanString(data?.patientId),
        patientName: cleanString(data?.patientName),
        serialNumber: cleanString(data?.serialNumber),
        quantity: cleanNumber(data?.quantity),
        reason: cleanString(data?.reason),
        rentalData:
          data?.rentalData && typeof data.rentalData === "object"
            ? (data.rentalData as Record<string, unknown>)
            : undefined,
      },
      actor
    );
  }
);

export const returnRentalWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return returnRentalWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        rentalId: cleanString(data?.rentalId) ?? "",
        inventoryItemId: cleanString(data?.inventoryItemId),
        productId: cleanString(data?.productId),
        patientId: cleanString(data?.patientId),
        patientName: cleanString(data?.patientName),
        serialNumber: cleanString(data?.serialNumber),
        quantity: cleanNumber(data?.quantity),
        reason: cleanString(data?.reason),
      },
      actor
    );
  }
);

export const exchangeRentalWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return exchangeRentalWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        rentalId: cleanString(data?.rentalId) ?? "",
        inventoryItemId: cleanString(data?.inventoryItemId),
        replacementInventoryItemId: cleanString(data?.replacementInventoryItemId),
        productId: cleanString(data?.productId),
        replacementProductId: cleanString(data?.replacementProductId),
        patientId: cleanString(data?.patientId),
        patientName: cleanString(data?.patientName),
        serialNumber: cleanString(data?.serialNumber),
        replacementSerialNumber: cleanString(data?.replacementSerialNumber),
        quantity: cleanNumber(data?.quantity),
        reason: cleanString(data?.reason),
      },
      actor
    );
  }
);

export const cancelRentalWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return cancelRentalWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        rentalId: cleanString(data?.rentalId) ?? "",
        reason: cleanString(data?.reason),
      },
      actor
    );
  }
);

export const reportStaleRentalDraftsCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 2,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    assertAdmin(actor);
    const data = request.data as Record<string, unknown> | undefined;
    return reportStaleRentalDrafts({
      actor,
      dryRun: data?.dryRun !== false,
      repair: data?.repair === true,
      olderThanHours: cleanNumber(data?.olderThanHours) ?? 72,
    });
  }
);

export const patientEquipmentWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    const action = cleanString(data?.action) as PatientEquipmentAction | undefined;
    if (!action || !PATIENT_EQUIPMENT_ACTIONS.has(action)) {
      throw new HttpsError("invalid-argument", "Invalid patient equipment action.");
    }

    return patientEquipmentWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        action,
        patientId: cleanString(data?.patientId) ?? "",
        toPatientId: cleanString(data?.toPatientId),
        inventoryItemId: cleanString(data?.inventoryItemId) ?? "",
        replacementInventoryItemId: cleanString(data?.replacementInventoryItemId),
        productId: cleanString(data?.productId),
        patientName: cleanString(data?.patientName),
        toPatientName: cleanString(data?.toPatientName),
        barcode: cleanString(data?.barcode),
        serialNumber: cleanString(data?.serialNumber),
        lotNumber: cleanString(data?.lotNumber),
        quantity: cleanNumber(data?.quantity),
        reason: cleanString(data?.reason),
      },
      actor
    );
  }
);

export const equipmentCheckInByBarcodeCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    return equipmentCheckInByBarcodeWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        barcode: cleanString(data?.barcode) ?? "",
        rawScan: cleanString(data?.rawScan),
        quantity: cleanNumber(data?.quantity),
        reason: cleanString(data?.reason),
      },
      actor
    );
  }
);

export const patientLifecycleWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;
    const action = cleanString(data?.action) as PatientLifecycleAction | undefined;
    if (!action || !PATIENT_LIFECYCLE_ACTIONS.has(action)) {
      throw new HttpsError("invalid-argument", "Invalid patient lifecycle action.");
    }

    return patientLifecycleWorkflow(
      {
        operationId: cleanString(data?.operationId) ?? "",
        patientId: cleanString(data?.patientId) ?? "",
        action,
        reason: cleanString(data?.reason),
        dryRun: data?.dryRun === true,
        confirmationToken: cleanString(data?.confirmationToken),
      },
      actor
    );
  }
);

export const cleanupPendingWorkflowUploadsCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 2,
  },
  async (request) => {
    const actor = await requireRateLimitedStaffOrAdmin(request);
    assertAdmin(actor);
    const data = request.data as Record<string, unknown> | undefined;
    const dryRun = data?.dryRun !== false;
    const olderThanHours =
      typeof data?.olderThanHours === "number" && Number.isFinite(data.olderThanHours)
        ? Math.max(1, data.olderThanHours)
        : 24;
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    const [files] = await getStorage().bucket().getFiles({
      prefix: "workflow-pending/delivery/",
      maxResults: 1000,
    });
    const stale: Array<{ path: string; updatedAt: string }> = [];

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const updatedAt = metadata.updated ?? "";
      if ((updatedAt ? Date.parse(updatedAt) : Date.now()) < cutoff) {
        stale.push({ path: file.name, updatedAt });
        if (!dryRun) {
          await file.delete({ ignoreNotFound: true });
        }
      }
    }

    return {
      status: "success",
      dryRun,
      olderThanHours,
      count: stale.length,
      stale,
    };
  }
);

export const employeeEvaluationWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    const actor = await requireTank(request);
    const data = request.data as Record<string, unknown> | undefined;
    const action = cleanString(data?.action) as EmployeeEvaluationAction | undefined;
    if (!action || !["save", "snapshot", "comment"].includes(action)) {
      throw new HttpsError("invalid-argument", "Invalid employee evaluation action.");
    }

    const operationId = cleanString(data?.operationId) ?? "";
    assertOperationId(operationId);

    // The workflow service performs server-authoritative validation. Do NOT
    // coerce malformed numeric values to 0 here - raw payload values must
    // reach the service so invalid input is rejected at runtime.
    return employeeEvaluationWorkflow(
      {
        operationId,
        action,
        employeeId: cleanString(data?.employeeId) ?? "",
        employeeName: cleanString(data?.employeeName) ?? "",
        role: ["front_office", "tech"].includes(cleanString(data?.role) ?? "")
          ? (cleanString(data?.role) as "front_office" | "tech")
          : "front_office",
        titles: Array.isArray(data?.titles)
          ? data.titles.filter((item): item is string => typeof item === "string")
          : [],
        // Pass raw evaluationYear through WITHOUT coercion so the
        // server-authoritative validation in employeeEvaluationWorkflow
        // rejects invalid years instead of silently defaulting to the
        // current year.
        evaluationYear: data?.evaluationYear as number,
        recordAccuracy: data?.recordAccuracy as number,
        highDollarSales: data?.highDollarSales as number,
        deliveryTimeScore: data?.deliveryTimeScore as number,
        productivityScore: data?.productivityScore as number,
        deliveryAccuracy: data?.deliveryAccuracy as number,
        commentsQrUrl: cleanString(data?.commentsQrUrl) ?? "",
        reviewNotes: cleanString(data?.reviewNotes) ?? "",
        // Pass raw tone through WITHOUT coercion so the server-authoritative
        // validation in employeeEvaluationWorkflow rejects invalid values.
        // This prevents a malformed tone from being silently accepted.
        tone: data?.tone as "positive" | "corrective" | "neutral" | undefined,
        comment: cleanString(data?.comment) ?? "",
      } as EmployeeEvaluationWorkflowInput,
      actor
    );
  }
);
