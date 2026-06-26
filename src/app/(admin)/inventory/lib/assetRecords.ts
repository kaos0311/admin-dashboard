import type { InventoryItem } from "./inventoryTypes";

export type AssetTitleGroup = {
  id: string;
  title: string;
  items: InventoryItem[];
  patients: AssetPatient[];
  onRent: number;
  available: number;
};

export type AssetPatient = {
  id: string;
  name: string;
  dob: string;
  phone: string;
  items: InventoryItem[];
};

function groupId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed-asset"
  );
}

function assetTitle(item: InventoryItem): string {
  return item.name || item.category || item.hcpc || "Unnamed asset";
}

function patientKey(item: InventoryItem): string {
  return item.patientKey || item.patientId || item.patientName || "unassigned";
}

export function isArchivedPatientReturn(item: InventoryItem): boolean {
  return Boolean(
    item.activeAssetArchived ||
      item.patientEquipmentArchived ||
      (item.lastReturnedAt && item.returnedFromPatientKey)
  );
}

export function isActiveAssetRecord(item: InventoryItem): boolean {
  return !isArchivedPatientReturn(item);
}

export function buildAssetTitleGroups(items: InventoryItem[]): AssetTitleGroup[] {
  const groups = new Map<string, AssetTitleGroup>();

  items.forEach((item) => {
    const title = assetTitle(item);
    const id = groupId(title);
    const current =
      groups.get(id) ??
      ({
        id,
        title,
        items: [],
        patients: [],
        onRent: 0,
        available: 0,
      } satisfies AssetTitleGroup);

    current.items.push(item);
    current.onRent += item.onRent;
    current.available += item.available;

    groups.set(id, current);
  });

  return Array.from(groups.values())
    .map((group) => {
      const patients = new Map<string, AssetPatient>();

      group.items.forEach((item) => {
        const key = patientKey(item);
        const existing =
          patients.get(key) ??
          ({
            id: key,
            name: item.patientName || "No patient assigned",
            dob: item.patientDob || "",
            phone: item.patientPhone || "",
            items: [],
          } satisfies AssetPatient);

        existing.items.push(item);
        if (!existing.dob && item.patientDob) existing.dob = item.patientDob;
        if (!existing.phone && item.patientPhone) existing.phone = item.patientPhone;

        patients.set(key, existing);
      });

      return {
        ...group,
        patients: Array.from(patients.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      };
    })
    .sort(
      (a, b) =>
        b.items.length - a.items.length ||
        b.onRent - a.onRent ||
        a.title.localeCompare(b.title)
    );
}
