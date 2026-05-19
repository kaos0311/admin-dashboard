"use client";

import {
  CalendarClock,
  DatabaseZap,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
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

  onToggleSelected: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
  onDiscontinue: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

export function InventoryTableRow({
  item,
  isSelected,
  isAdmin,
  onToggleSelected,
  onEdit,
  onDiscontinue,
  onArchive,
  onDelete,
}: InventoryTableRowProps) {
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
        <div className="font-semibold text-white">
          {item.name}
        </div>

        <div className="text-xs text-slate-500">
          {item.category || "-"}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill value={item.status} />

          {isLowStock(item) && (
            <WarningPill label="Low Stock" />
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>{item.manufacturer || "-"}</div>

        <div className="text-xs text-slate-500">
          MFG ID: {item.manufacturerItemId || "-"}
        </div>

        <div className="text-xs text-slate-500">
          Model: {item.modelNumber || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>SKU: {item.sku || "-"}</div>
        <div>Barcode: {item.barcode || "-"}</div>
        <div>Serial: {item.serial || "-"}</div>
        <div>Lot: {item.lotNumber || "-"}</div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>On Hand: {item.quantityOnHand}</div>

        <div
          className={
            isLowStock(item)
              ? "font-semibold text-yellow-300"
              : ""
          }
        >
          Available: {item.available}
        </div>

        <div>Committed: {item.committed}</div>
        <div>On Rent: {item.onRent}</div>
        <div>On Order: {item.onOrder}</div>
        <div>Reorder: {item.reorderLevel}</div>

        <div>
          Value: {formatMoney(item.totalValue)}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div>{item.warrantyProvider || "-"}</div>

        <div className="text-xs text-slate-500">
          Start: {item.warrantyStartDate || "-"}
        </div>

        <div
          className={`text-xs ${
            isWarrantyExpired(item)
              ? "text-red-300"
              : "text-slate-500"
          }`}
        >
          End: {item.warrantyEndDate || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">
        <div className="flex items-center gap-2 capitalize">
          <CalendarClock className="h-4 w-4" />
          {item.lifecycleStatus.replaceAll("_", " ")}
        </div>

        <div
          className={`text-xs ${
            isServiceDue(item)
              ? "text-yellow-300"
              : "text-slate-500"
          }`}
        >
          Service: {item.nextServiceDate || "-"}
        </div>

        <div className="text-xs text-slate-500">
          Life: {item.usefulLifeMonths || 0} months
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="rounded-xl border border-white/10 bg-white/10 p-2 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-white/15"
            title="Edit"
            aria-label={`Edit ${item.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDiscontinue(item)}
            className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-2 text-yellow-200 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-yellow-500/20"
            title="Discontinue"
            aria-label={`Discontinue ${item.name}`}
          >
            <X className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onArchive(item)}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-red-500/20"
            title="Archive"
            aria-label={`Archive ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="rounded-xl border border-red-700/30 bg-red-950/40 p-2 text-red-400 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-red-950/70"
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