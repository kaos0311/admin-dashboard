const PROTECTED_INVENTORY_FIELDS = new Set([
  "quantityOnHand",
  "available",
  "onRent",
  "onTruck",
  "committed",
  "allocated",
  "reserved",
  "patientId",
  "patientKey",
  "patientName",
  "rentalId",
  "locationId",
  "warehouseId",
  "status",
  "inventoryStatus",
  "rentalStatus",
  "assignmentStatus",
  "lifecycleStatus",
  "isDeleted",
  "deleted",
  "deletedAt",
  "archived",
  "discontinued",
]);

export function getProtectedInventoryFields(
  data: Record<string, unknown>
): string[] {
  return Object.keys(data).filter((field) =>
    PROTECTED_INVENTORY_FIELDS.has(field)
  );
}

export function assertMetadataOnlyInventoryWrite(
  data: Record<string, unknown>,
  context: string
): void {
  const blocked = getProtectedInventoryFields(data);

  if (blocked.length > 0) {
    throw new Error(
      `${context} cannot change protected inventory fields: ${blocked.join(
        ", "
      )}. Use createInventoryMovement instead.`
    );
  }
}

export function isInventoryCollectionPath(path: string): boolean {
  return path === "inventory" || path.startsWith("inventory/");
}
