"use client";

import {
  CalendarClock,
  DatabaseZap,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  buttons,
  typography,
} from "@/theme";

import {
  getEffectiveReorderLevel,
  type InventoryThresholdSettings,
  isLowStock,
  isServiceDue,
  isWarrantyExpired,
} from "../lib/inventoryAlerts";

import { formatMoney } from "../lib/inventoryNormalize";

import type { InventoryItem } from "../lib/inventoryTypes";

import {
  StatusPill,
  WarningPill,
} from "./InventoryPills";

type InventoryTableRowProps = {
  item: InventoryItem;
  isSelected: boolean;
  isAdmin: boolean;
  thresholds: InventoryThresholdSettings;

  onToggleSelected: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
  onDiscontinue: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

function alertTextClass(active: boolean): string {
  return active ? typography.warningText : typography.smallMuted;
}

function dangerTextClass(active: boolean): string {
  return active ? typography.dangerText : typography.smallMuted;
}

export function InventoryTableRow({
  item,
  isSelected,
  isAdmin,
  thresholds,
  onToggleSelected,
  onEdit,
  onDiscontinue,
  onArchive,
  onDelete,
}: InventoryTableRowProps) {
  const lowStock = isLowStock(item, thresholds);
  const effectiveReorderLevel = getEffectiveReorderLevel(item, thresholds);

  return (
    <tr className="border-t border-white/10 align-top hover:bg-white/[0.04]">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          title={`Select ${item.name}`}
          aria-label={`Select ${item.name}`}
          onChange={() => onToggleSelected(item.id)}
        />
      </td>

      <td className="px-4 py-3">
        <div className={typography.bodyStrong}>
          {item.name}
        </div>

        <div className={typography.smallMuted}>
          {item.category || "-"}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill value={item.status} />

          {lowStock && (
            <WarningPill label="Low Stock" />
          )}
        </div>
      </td>

      <td className={`px-4 py-3 ${typography.body}`}>
        <div>{item.manufacturer || "-"}</div>

        <div className={typography.smallMuted}>
          MFG ID: {item.manufacturerItemId || "-"}
        </div>

        <div className={typography.smallMuted}>
          Model: {item.modelNumber || "-"}
        </div>
      </td>

      <td className={`px-4 py-3 ${typography.body}`}>
        <div>SKU: {item.sku || "-"}</div>
        <div>HCPCS: {item.hcpc || "-"}</div>
        <div>Barcode: {item.barcode || "-"}</div>
        <div>Serial: {item.serial || "-"}</div>
        <div>Lot: {item.lotNumber || "-"}</div>
      </td>

      <td className={`px-4 py-3 ${typography.body}`}>
        <div>On Hand: {item.quantityOnHand}</div>

        <div className={lowStock ? typography.warningStrong : ""}>
          Available: {item.available}
        </div>

        <div>Committed: {item.committed}</div>
        <div>On Rent: {item.onRent}</div>
        <div>On Order: {item.onOrder}</div>
        <div>
          Reorder: {effectiveReorderLevel}
          {item.reorderLevel <= 0 ? " default" : ""}
        </div>

        <div>
          Value: {formatMoney(item.totalValue)}
        </div>
      </td>

      <td className={`px-4 py-3 ${typography.body}`}>
        <div>{item.warrantyProvider || "-"}</div>

        <div className={typography.smallMuted}>
          Start: {item.warrantyStartDate || "-"}
        </div>

        <div className={dangerTextClass(isWarrantyExpired(item))}>
          End: {item.warrantyEndDate || "-"}
        </div>
      </td>

      <td className={`px-4 py-3 ${typography.body}`}>
        <div className="flex items-center gap-2 capitalize">
          <CalendarClock className="h-4 w-4" />
          {item.lifecycleStatus.replaceAll("_", " ")}
        </div>

        <div className={alertTextClass(isServiceDue(item))}>
          Service: {item.nextServiceDate || "-"}
        </div>

        <div className={typography.smallMuted}>
          Life: {item.usefulLifeMonths || 0} months
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className={buttons.icon}
            title="Edit"
            aria-label={`Edit ${item.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDiscontinue(item)}
            className={buttons.iconWarning}
            title="Discontinue"
            aria-label={`Discontinue ${item.name}`}
          >
            <X className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onArchive(item)}
            className={buttons.iconArchive}
            title="Archive"
            aria-label={`Archive ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className={buttons.iconDelete}
              title="Permanent Delete"
              aria-label={`Permanently delete ${item.name}`}
            >
              <DatabaseZap className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

