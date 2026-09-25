import type { InventoryItem } from "@/app/(admin)/inventory/lib/inventoryTypes";
import { isRentalProperty } from "@/app/(admin)/inventory/lib/rentalProperty";
import type {
  DeceasedPatientSummary,
  DeceasedPickupCandidate,
} from "@/services/inventory/pickup-review.types";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateMs(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestDate(...values: string[]): string {
  return (
    values
      .filter(Boolean)
      .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] ?? ""
  );
}

function normalizePatientMatchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapPatientForPickup(
  id: string,
  data: Record<string, unknown>
): DeceasedPatientSummary | null {
  const dateOfDeath = cleanText(data.dateOfDeath) || cleanText(data.dod);

  const deliverySummary =
    data.deliverySummary && typeof data.deliverySummary === "object"
      ? (data.deliverySummary as Record<string, unknown>)
      : {};
  const billing =
    data.billing && typeof data.billing === "object"
      ? (data.billing as Record<string, unknown>)
      : {};
  const lastDeliveryDate = latestDate(
    cleanText(deliverySummary.actualDeliveryDate),
    cleanText(deliverySummary.scheduledDeliveryDate),
    cleanText(data.lastTreatmentDate),
    cleanText(data.lastEquipmentDate)
  );
  const lastPickupDate = latestDate(
    cleanText(billing.lastPickupDate),
    cleanText(data.lastPickupDate),
    cleanText(data.lastEquipmentDate)
  );

  if (
    !dateOfDeath &&
    !(parseDateMs(lastPickupDate) > parseDateMs(lastDeliveryDate))
  ) {
    return null;
  }

  return {
    id,
    fullName:
      cleanText(data.fullName) || cleanText(data.sourceFullName) || "Unnamed Patient",
    dateOfDeath,
    phone: cleanText(data.phone),
    lastDeliveryDate,
    lastPickupDate,
  };
}

function patientForInventoryItem(
  item: InventoryItem,
  patientsById: Map<string, DeceasedPatientSummary>,
  patientsByName: Map<string, DeceasedPatientSummary>
): DeceasedPatientSummary | null {
  for (const key of [item.patientKey, item.patientId]) {
    if (key && patientsById.has(key)) return patientsById.get(key) ?? null;
  }

  const nameKey = normalizePatientMatchKey(item.patientName ?? "");
  return nameKey ? (patientsByName.get(nameKey) ?? null) : null;
}

function buildDeceasedPickupCandidates(
  items: InventoryItem[],
  deceasedPatients: DeceasedPatientSummary[]
): DeceasedPickupCandidate[] {
  const patientsById = new Map(
    deceasedPatients.map((patient) => [patient.id, patient])
  );
  const patientsByName = new Map(
    deceasedPatients.map((patient) => [
      normalizePatientMatchKey(patient.fullName),
      patient,
    ])
  );

  return items
    .filter(isRentalProperty)
    .flatMap((item) => {
      const patient = patientForInventoryItem(item, patientsById, patientsByName);
      if (!patient) return [];

      const lastDeliveryDate = latestDate(
        item.lastDeliveredAt ?? "",
        item.originalDos ?? "",
        patient.lastDeliveryDate
      );
      const deathDateMs = parseDateMs(patient.dateOfDeath ?? "");
      const deliveryDateMs = parseDateMs(lastDeliveryDate);
      const pickupDateMs = parseDateMs(patient.lastPickupDate);

      const deceasedAfterDelivery =
        deathDateMs > 0 && (deliveryDateMs === 0 || deathDateMs >= deliveryDateMs);
      const pickupAfterDelivery =
        pickupDateMs > 0 && deliveryDateMs > 0 && pickupDateMs > deliveryDateMs;
      const reason: DeceasedPickupCandidate["reason"] = pickupAfterDelivery
        ? "pickup_after_delivery"
        : "deceased";

      if (!deceasedAfterDelivery && !pickupAfterDelivery) {
        return [];
      }

      return [
        {
          item,
          patient,
          lastDeliveryDate,
          pickupDate: patient.lastPickupDate,
          needsDateReview:
            !pickupAfterDelivery && (deliveryDateMs === 0 || deathDateMs === 0),
          reason,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.patient.fullName.localeCompare(b.patient.fullName) ||
        a.item.name.localeCompare(b.item.name)
    );
}

function equipmentMatchesInventory(
  equipment: Record<string, unknown>,
  item: InventoryItem
): boolean {
  return [
    [cleanText(equipment.inventoryId), item.id],
    [cleanText(equipment.productId), item.productId],
    [cleanText(equipment.serialNumber) || cleanText(equipment.serial), item.serial],
    [cleanText(equipment.lotNumber), item.lotNumber],
    [cleanText(equipment.itemId), item.sku || item.productId],
    [cleanText(equipment.itemName), item.name],
  ].some(([left, right]) => Boolean(left && right && left === right));
}

function archiveCurrentEquipmentArray(
  value: unknown,
  item: InventoryItem,
  archivedAt: string
): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null;

  let changed = false;
  const archived = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;

    const equipment = entry as Record<string, unknown>;
    if (!equipmentMatchesInventory(equipment, item)) return equipment;

    changed = true;
    return {
      ...equipment,
      status: "archived_returned",
      retrievalStatus: "picked_up_returned_to_inventory",
      archivedAt,
      returnedAt: archivedAt,
      lastUpdated: archivedAt,
    };
  });

  return changed ? (archived as Array<Record<string, unknown>>) : null;
}

export {
  cleanText,
  parseDateMs,
  latestDate,
  normalizePatientMatchKey,
  mapPatientForPickup,
  patientForInventoryItem,
  buildDeceasedPickupCandidates,
  equipmentMatchesInventory,
  archiveCurrentEquipmentArray,
};

