"use client";

import { glass, typography } from "@/theme";
import type { InventoryThresholdSettings } from "../lib/inventoryAlerts";
import type { InventoryItem } from "../lib/inventoryTypes";

import { InventoryTableRow } from "./InventoryTableRow";

type InventoryTableProps = {
  items: InventoryItem[];
  selectedIds: string[];
  isAdmin: boolean;
  thresholds: InventoryThresholdSettings;

  onToggleSelected: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
  onDiscontinue: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

export function InventoryTable({
  items,
  selectedIds,
  isAdmin,
  thresholds,
  onToggleSelected,
  onEdit,
  onDiscontinue,
  onArchive,
  onDelete,
}: InventoryTableProps) {
  return (
    <div className={`${glass.inset} overflow-x-auto rounded-lg`}>
      <table className="w-full min-w-[1550px] text-left text-sm">
        <thead className={`bg-white/5 ${typography.bodyMuted} backdrop-blur-xl`}>
          <tr>
            <th className="px-4 py-3">Select</th>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Manufacturer</th>
            <th className="px-4 py-3">IDs</th>
            <th className="px-4 py-3">Stock</th>
            <th className="px-4 py-3">Warranty</th>
            <th className="px-4 py-3">Lifecycle</th>
            <th className="px-4 py-3 text-right">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <InventoryTableRow
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              thresholds={thresholds}
              isSelected={selectedIds.includes(item.id)}
              onToggleSelected={onToggleSelected}
              onEdit={onEdit}
              onDiscontinue={onDiscontinue}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}



