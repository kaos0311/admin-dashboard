const PROTECTED_RENTAL_FIELDS = new Set([
  "status",
  "patientId",
  "patientName",
  "inventoryItemId",
  "itemId",
  "checkedOutAt",
  "checkedOutByUid",
  "checkedOutByEmail",
  "returnedDate",
  "returnedAt",
  "returnedByUid",
  "returnedByEmail",
  "returnMovementId",
  "movementId",
  "cancelledAt",
  "cancelledByUid",
  "cancelledByEmail",
  "previousInventoryItemId",
  "exchangedAt",
  "exchangedByUid",
  "exchangedByEmail",
  "exchangeReturnMovementId",
  "exchangeCheckoutMovementId",
]);

const PROTECTED_PATIENT_EQUIPMENT_FIELDS = new Set([
  "inventoryId",
  "productId",
  "status",
  "assignedAt",
  "assignedByUid",
  "assignedByEmail",
  "closedAt",
  "closedByUid",
  "closedByEmail",
  "movementId",
  "deliveryTicketId",
  "deliveryTicketNumber",
  "deliveredAt",
  "returnedAt",
  "returnMovementId",
  "transferredAt",
  "transferredByUid",
  "transferredByEmail",
  "transferredFromPatientId",
  "replacementInventoryItemId",
  "replacesInventoryItemId",
  "closeReason",
  "systemGenerated",
]);

type DomainWriteScope = "rental" | "patient-equipment";

function topLevelField(field: string): string {
  return field.split(".")[0] ?? field;
}

function protectedFieldsForScope(scope: DomainWriteScope): Set<string> {
  return scope === "rental"
    ? PROTECTED_RENTAL_FIELDS
    : PROTECTED_PATIENT_EQUIPMENT_FIELDS;
}

export function isRentalDocumentPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return segments[0] === "rentals" && segments.length >= 1;
}

export function isPatientEquipmentDocumentPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return (
    segments.length >= 3 &&
    segments[0] === "patients" &&
    segments[2] === "equipment"
  );
}

export function getProtectedDomainFields(
  path: string,
  data: Record<string, unknown>
): string[] {
  const scope = isRentalDocumentPath(path)
    ? "rental"
    : isPatientEquipmentDocumentPath(path)
      ? "patient-equipment"
      : null;

  if (!scope) return [];

  const protectedFields = protectedFieldsForScope(scope);
  return Object.keys(data).filter((field) =>
    protectedFields.has(topLevelField(field))
  );
}

export function assertMetadataOnlyDomainWrite(
  path: string,
  data: Record<string, unknown>,
  context: string
): void {
  const blocked = getProtectedDomainFields(path, data);

  if (blocked.length > 0) {
    throw new Error(
      `${context} cannot change protected domain workflow fields: ${blocked.join(
        ", "
      )}. Use the server workflow instead.`
    );
  }
}

export function assertDraftRentalCreate(
  data: Record<string, unknown>,
  context: string
): void {
  if (data.status !== "draft") {
    throw new Error(`${context} can only create draft rental metadata.`);
  }

  const blocked = getProtectedDomainFields("rentals/new", data).filter(
    (field) => topLevelField(field) !== "status"
  );

  if (blocked.length > 0) {
    throw new Error(
      `${context} cannot create protected rental workflow fields: ${blocked.join(
        ", "
      )}. Use the server workflow instead.`
    );
  }
}
