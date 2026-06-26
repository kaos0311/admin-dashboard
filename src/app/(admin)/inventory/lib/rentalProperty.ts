import type { InventoryItem } from "./inventoryTypes";

export type RentalFacilityTile = {
  id: string;
  label: string;
  items: InventoryItem[];
  patients: RentalFacilityPatient[];
  patientCount: number;
  totalOnRent: number;
  hospice: boolean;
};

export type RentalFacilityPatient = {
  id: string;
  name: string;
  dob: string;
  phone: string;
  assetCount: number;
  onRent: number;
};

function normalizeTileId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isRentalProperty(item: InventoryItem): boolean {
  return (
    item.status === "rental_out" ||
    item.onRent > 0 ||
    Boolean(item.salesOrderId || item.salesOrderDetailId || item.patientName)
  );
}

function isHospiceRental(item: InventoryItem): boolean {
  return [
    item.payor,
    item.insuranceName,
    item.planType,
    item.sourceReport,
    item.notes,
    item.locationName,
    item.searchText,
  ]
    .join(" ")
    .toLowerCase()
    .includes("hospice");
}

function facilityLabelForRental(item: InventoryItem): string {
  if (isHospiceRental(item)) return "Hospice";

  return item.insuranceName || "No Insurance Listed";
}

function buildRentalPatients(items: InventoryItem[]): RentalFacilityPatient[] {
  const patients = new Map<string, RentalFacilityPatient>();

  items.forEach((item) => {
    const name = item.patientName?.trim() || "Unassigned Patient";
    const id = (item.patientKey || item.patientId || item.patientName || name).trim();
    const key = id || name;
    const existing =
      patients.get(key) ??
      ({
        id: key,
        name,
        dob: item.patientDob || "",
        phone: item.patientPhone || "",
        assetCount: 0,
        onRent: 0,
      } satisfies RentalFacilityPatient);

    existing.assetCount += 1;
    existing.onRent += Math.max(item.onRent, item.status === "rental_out" ? 1 : 0);
    if (!existing.dob && item.patientDob) existing.dob = item.patientDob;
    if (!existing.phone && item.patientPhone) existing.phone = item.patientPhone;

    patients.set(key, existing);
  });

  return Array.from(patients.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function buildRentalFacilityTiles(items: InventoryItem[]): RentalFacilityTile[] {
  const groups = new Map<string, RentalFacilityTile>();

  items.filter(isRentalProperty).forEach((item) => {
    const label = facilityLabelForRental(item);
    const hospice = label === "Hospice";
    const id = hospice ? "hospice" : normalizeTileId(label);
    const existing =
      groups.get(id) ??
      ({
        id,
        label,
        items: [],
        patients: [],
        patientCount: 0,
        totalOnRent: 0,
        hospice,
      } satisfies RentalFacilityTile);

    existing.items.push(item);
    existing.totalOnRent += Math.max(
      item.onRent,
      item.status === "rental_out" ? 1 : 0
    );

    groups.set(id, existing);
  });

  return Array.from(groups.values())
    .map((group) => {
      const patients = buildRentalPatients(group.items);

      return {
        ...group,
        patients,
        patientCount: patients.length,
      };
    })
    .sort((a, b) => {
      if (a.hospice !== b.hospice) return a.hospice ? -1 : 1;
      return b.items.length - a.items.length || a.label.localeCompare(b.label);
    });
}
