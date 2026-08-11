import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";

export type DomainWorkflowResult = {
  status:
    | "success"
    | "duplicate_operation"
    | "not_found"
    | "invalid"
    | "permission_denied"
    | "invalid_state"
    | "insufficient_quantity"
    | "asset_unavailable"
    | "dependency_conflict"
    | "validation_error";
  operationId: string;
  workflowType: string;
  message?: string;
  movementIds?: string[];
  rentalId?: string;
  assignmentId?: string;
  metadata?: Record<string, unknown>;
};

export type DeliveryWorkflowRequest = {
  operationId: string;
  ticketId: string;
  lineId?: string;
  inventoryItemId: string;
  productId?: string;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  quantity?: number;
  mode: "load" | "deliver" | "return";
  patientId?: string;
  patientName?: string;
  deliveryTicketNumber?: string;
  salesOrderNumber?: string;
  vehicleId?: string;
  truckId?: string;
  returnCondition?: string;
  returnNotes?: string;
};

export type RentalWorkflowRequest = {
  operationId: string;
  rentalId: string;
  inventoryItemId?: string;
  replacementInventoryItemId?: string;
  productId?: string;
  replacementProductId?: string;
  patientId?: string;
  patientName?: string;
  serialNumber?: string;
  replacementSerialNumber?: string;
  quantity?: number;
  reason?: string;
};

export type CreateAndCheckoutRentalWorkflowRequest = Omit<RentalWorkflowRequest, "rentalId"> & {
  rentalId?: string;
  rentalData?: Record<string, unknown>;
};

export type DeliverySignatureFinalizeRequest = {
  operationId: string;
  ticketId: string;
  patientId?: string;
  signerName: string;
  signerRole: string;
  signerRelationship?: string;
  witnessName?: string;
  refusalReason?: string;
  pendingStoragePath: string;
  pendingDownloadURL?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  checksum?: string;
};

export type DeliveryDamageFinalizeRequest = {
  operationId: string;
  ticketId: string;
  patientId?: string;
  files: Array<{
    pendingStoragePath: string;
    pendingDownloadURL?: string;
    fileName: string;
    contentType?: string;
    fileSize?: number;
    checksum?: string;
  }>;
  damageNotes?: string;
  returnCondition?: string;
};

export type DeliveryTechCheckInRequest = {
  operationId: string;
  ticketId: string;
  techName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type DeliveryRouteRequest = {
  operationId: string;
  ticketId: string;
  etaMinutes?: number;
  routeSequence?: number;
  routeStatus?: string;
  routeNotes?: string;
};

export type PatientEquipmentWorkflowRequest = {
  operationId: string;
  action:
    | "assign"
    | "remove"
    | "transfer"
    | "recover_deceased"
    | "replace"
    | "lost"
    | "damaged"
    | "return_to_warehouse";
  patientId: string;
  toPatientId?: string;
  inventoryItemId: string;
  replacementInventoryItemId?: string;
  productId?: string;
  patientName?: string;
  toPatientName?: string;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  quantity?: number;
  reason?: string;
};

export type InventoryCleanupAction =
  | "ASSIGN_CATEGORY"
  | "LINK_CANONICAL_PRODUCT"
  | "RELINK_PRODUCT_ID"
  | "CORRECT_MANUFACTURER"
  | "CORRECT_MODEL"
  | "CORRECT_PRODUCT_NAME"
  | "CORRECT_SERIAL"
  | "CORRECT_ASSET_TAG"
  | "CORRECT_ASSET_NUMBER"
  | "MARK_AS_REVIEWED"
  | "DISMISS_FALSE_POSITIVE";

export type InventoryCleanupRequest = {
  mode: "preview" | "apply";
  operationId: string;
  action: InventoryCleanupAction;
  inventoryItemId: string;
  targetProductId?: string;
  field?: string;
  newValue?: string;
  reason?: string;
  previewToken?: string;
  acknowledgement?: string;
  riskId?: string;
};

export type InventoryCleanupResult = {
  status: "preview" | "success" | "duplicate_operation";
  operationId: string;
  workflowType: "inventory.cleanup";
  action: InventoryCleanupAction;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  inventoryItemId: string;
  current: Record<string, string>;
  proposed: Record<string, string>;
  diff: Array<{ field: string; before: string; after: string }>;
  affectedRecords: number;
  sideEffects: string[];
  warnings: string[];
  previewToken: string;
  requiresReason: boolean;
  requiresAcknowledgement: boolean;
  auditWritten?: boolean;
  changedFields?: string[];
};

export async function recordDeliveryScanWorkflow(
  request: DeliveryWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<DeliveryWorkflowRequest, DomainWorkflowResult>(
    functions,
    "recordDeliveryScanWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function completeDeliveryTicketWorkflow(request: {
  operationId: string;
  ticketId: string;
}): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<
    { operationId: string; ticketId: string },
    DomainWorkflowResult
  >(functions, "completeDeliveryTicketWorkflowCallable");
  const result = await callable(request);
  return result.data;
}

export async function returnRentalWorkflow(
  request: RentalWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<RentalWorkflowRequest, DomainWorkflowResult>(
    functions,
    "returnRentalWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function exchangeRentalWorkflow(
  request: RentalWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<RentalWorkflowRequest, DomainWorkflowResult>(
    functions,
    "exchangeRentalWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function checkoutRentalWorkflow(
  request: RentalWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<RentalWorkflowRequest, DomainWorkflowResult>(
    functions,
    "checkoutRentalWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function createAndCheckoutRentalWorkflow(
  request: CreateAndCheckoutRentalWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<CreateAndCheckoutRentalWorkflowRequest, DomainWorkflowResult>(
    functions,
    "createAndCheckoutRentalWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function cancelRentalWorkflow(
  request: RentalWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<RentalWorkflowRequest, DomainWorkflowResult>(
    functions,
    "cancelRentalWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function finalizeDeliverySignatureWorkflow(
  request: DeliverySignatureFinalizeRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<
    DeliverySignatureFinalizeRequest,
    DomainWorkflowResult
  >(functions, "finalizeDeliverySignatureWorkflowCallable");
  const result = await callable(request);
  return result.data;
}

export async function finalizeDeliveryDamagePhotosWorkflow(
  request: DeliveryDamageFinalizeRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<
    DeliveryDamageFinalizeRequest,
    DomainWorkflowResult
  >(functions, "finalizeDeliveryDamagePhotosWorkflowCallable");
  const result = await callable(request);
  return result.data;
}

export async function deliveryTechCheckInWorkflow(
  request: DeliveryTechCheckInRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<DeliveryTechCheckInRequest, DomainWorkflowResult>(
    functions,
    "deliveryTechCheckInWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function updateDeliveryRouteWorkflow(
  request: DeliveryRouteRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<DeliveryRouteRequest, DomainWorkflowResult>(
    functions,
    "updateDeliveryRouteWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function patientLifecycleWorkflow(request: {
  operationId: string;
  patientId: string;
  action: "archive" | "restore" | "destroy";
  reason?: string;
  dryRun?: boolean;
  confirmationToken?: string;
}): Promise<DomainWorkflowResult & { dependencyReport?: Record<string, unknown> }> {
  const callable = httpsCallable<
    typeof request,
    DomainWorkflowResult & { dependencyReport?: Record<string, unknown> }
  >(functions, "patientLifecycleWorkflowCallable");
  const result = await callable(request);
  return result.data;
}

export async function patientEquipmentWorkflow(
  request: PatientEquipmentWorkflowRequest
): Promise<DomainWorkflowResult> {
  const callable = httpsCallable<PatientEquipmentWorkflowRequest, DomainWorkflowResult>(
    functions,
    "patientEquipmentWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}

export async function inventoryCleanupWorkflow(
  request: InventoryCleanupRequest
): Promise<InventoryCleanupResult> {
  const callable = httpsCallable<InventoryCleanupRequest, InventoryCleanupResult>(
    functions,
    "inventoryCleanupWorkflowCallable"
  );
  const result = await callable(request);
  return result.data;
}
