"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  DatabaseZap,
  Layers,
  Package,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  buttons,
  glass,
  typography,
} from "@/theme";
import {
  getEffectiveReorderLevel,
  type InventoryThresholdSettings,
  isLowStock,
} from "../lib/inventoryAlerts";
import {
  buildInventoryIndex,
  type InventoryCategoryNode,
  type InventoryLocationQuantityNode,
  type InventoryProductNode,
  type InventoryUnitNode,
} from "../lib/inventoryIndex";
import { formatMoney } from "../lib/inventoryNormalize";
import type { InventoryItem } from "../lib/inventoryTypes";
import {
  StatusPill,
  WarningPill,
} from "./InventoryPills";

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

type InventoryActions = Omit<InventoryTableProps, "items">;

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
  const inventoryIndex = useMemo(
    () => buildInventoryIndex({ inventoryItems: items }),
    [items],
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleCategory(categoryId: string): void {
    setExpandedCategories((current) => toggleSetValue(current, categoryId));
  }

  function toggleProduct(productKey: string): void {
    setExpandedProducts((current) => toggleSetValue(current, productKey));
  }

  if (inventoryIndex.categories.length === 0) {
    return (
      <div className={`${glass.inset} rounded-lg px-4 py-8 text-center`}>
        <Package className="mx-auto mb-3 h-8 w-8 text-white/40" />
        <p className={typography.bodyStrong}>No inventory matches the current view.</p>
        <p className={typography.smallMuted}>Adjust search or filters to broaden the results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inventoryIndex.categories.map((category) => {
        const categoryExpanded = expandedCategories.has(category.id);

        return (
          <section
            key={category.id}
            className={`${glass.inset} overflow-hidden rounded-lg`}
          >
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className="flex w-full flex-col gap-3 border-b border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 lg:flex-row lg:items-center lg:justify-between"
              aria-expanded={categoryExpanded}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 rounded-md border border-white/10 bg-black/20 p-2">
                  {categoryExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className={`${typography.cardTitle} break-words`}>
                    {category.name}
                  </h3>
                  <p className={typography.smallMuted}>
                    {category.products.length.toLocaleString()} product types
                  </p>
                </div>
              </div>
              <CategoryMetrics category={category} />
            </button>

            {categoryExpanded ? (
              <div className="divide-y divide-white/10">
                {category.products.map((product) => {
                  const productExpanded = expandedProducts.has(product.key);

                  return (
                    <ProductSection
                      key={product.key}
                      product={product}
                      expanded={productExpanded}
                      onToggle={() => toggleProduct(product.key)}
                      selectedIds={selectedIds}
                      isAdmin={isAdmin}
                      thresholds={thresholds}
                      onToggleSelected={onToggleSelected}
                      onEdit={onEdit}
                      onDiscontinue={onDiscontinue}
                      onArchive={onArchive}
                      onDelete={onDelete}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function toggleSetValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return next;
}

function CategoryMetrics({ category }: { category: InventoryCategoryNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:min-w-[560px]">
      <Metric label="Total" value={category.totals.totalQuantity} />
      <Metric label="Available" value={category.totals.available} />
      <Metric label="Checked Out" value={category.totals.checkedOut} />
      <Metric label="Service" value={category.totals.service} />
      <Metric label="Other" value={category.totals.other} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <div className={typography.smallMuted}>{label}</div>
      <div className={typography.bodyStrong}>{value.toLocaleString()}</div>
    </div>
  );
}

function ProductSection({
  product,
  expanded,
  onToggle,
  selectedIds,
  isAdmin,
  thresholds,
  onToggleSelected,
  onEdit,
  onDiscontinue,
  onArchive,
  onDelete,
}: {
  product: InventoryProductNode;
  expanded: boolean;
  onToggle: () => void;
} & InventoryActions) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] lg:flex-row lg:items-start lg:justify-between"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-md border border-white/10 bg-black/20 p-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`${typography.bodyStrong} break-words`}>
                {product.productName}
              </h4>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                {product.isSerialized ? "Serialized" : "Quantity"}
              </span>
            </div>
            <p className={typography.smallMuted}>
              {product.manufacturer} {product.modelNumber} | SKU {product.sku} | HCPCS {product.hcpc}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[448px]">
          <Metric label={product.isSerialized ? "Units" : "Quantity"} value={product.totals.totalQuantity} />
          <Metric label="Available" value={product.totals.available} />
          <Metric label="Checked Out" value={product.totals.checkedOut} />
          <Metric label="Service" value={product.totals.service} />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-white/10 px-4 pb-4">
          {product.units.length > 0 ? (
            <SerializedUnitsTable
              units={product.units}
              selectedIds={selectedIds}
              isAdmin={isAdmin}
              thresholds={thresholds}
              onToggleSelected={onToggleSelected}
              onEdit={onEdit}
              onDiscontinue={onDiscontinue}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ) : null}

          {product.quantities.length > 0 ? (
            <QuantityTable
              quantities={product.quantities}
              selectedIds={selectedIds}
              isAdmin={isAdmin}
              thresholds={thresholds}
              onToggleSelected={onToggleSelected}
              onEdit={onEdit}
              onDiscontinue={onDiscontinue}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SerializedUnitsTable({
  units,
  ...actions
}: {
  units: InventoryUnitNode[];
} & InventoryActions) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className={typography.bodyMuted}>
          <tr className="border-y border-white/10">
            <th className="px-3 py-2">Select</th>
            <th className="px-3 py-2">Serial Number</th>
            <th className="px-3 py-2">On Hand</th>
            <th className="px-3 py-2">Available</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <InventoryRecordRow
              key={unit.id}
              item={unit.item}
              identity={unit.label}
              {...actions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuantityTable({
  quantities,
  selectedIds,
  isAdmin,
  thresholds,
  onToggleSelected,
  onEdit,
  onDiscontinue,
  onArchive,
  onDelete,
}: {
  quantities: InventoryLocationQuantityNode[];
} & InventoryActions) {
  return (
    <div className="mt-4 space-y-3">
      {quantities.map((quantity) => (
        <div
          key={quantity.key}
          className="rounded-md border border-white/10 bg-black/10"
        >
          <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Layers className="h-4 w-4 text-white/50" />
              <div className="min-w-0">
                <div className={typography.bodyStrong}>{quantity.locationName}</div>
                <div className={typography.smallMuted}>
                  Lot {quantity.lotNumber || "-"} | {quantity.recordCount.toLocaleString()} records
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-56">
              <Metric label="On Hand" value={quantity.quantityOnHand} />
              <Metric label="Available" value={quantity.available} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className={typography.bodyMuted}>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Inventory Record</th>
                  <th className="px-3 py-2">On Hand</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quantity.records.map((item) => (
                  <InventoryRecordRow
                    key={item.id}
                    item={item}
                    identity={item.lotNumber ? `Lot ${item.lotNumber}` : item.name}
                    selectedIds={selectedIds}
                    isAdmin={isAdmin}
                    thresholds={thresholds}
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
        </div>
      ))}
    </div>
  );
}

function InventoryRecordRow({
  item,
  identity,
  selectedIds,
  isAdmin,
  thresholds,
  onToggleSelected,
  onEdit,
  onDiscontinue,
  onArchive,
  onDelete,
}: {
  item: InventoryItem;
  identity: string;
} & InventoryActions) {
  const lowStock = isLowStock(item, thresholds);
  const effectiveReorderLevel = getEffectiveReorderLevel(item, thresholds);

  return (
    <tr className="border-t border-white/10 align-top hover:bg-white/[0.04]">
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          title={`Select ${item.name}`}
          aria-label={`Select ${item.name}`}
          onChange={() => onToggleSelected(item.id)}
        />
      </td>

      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className={`${typography.bodyStrong} text-left underline-offset-4 hover:underline`}
        >
          {identity}
        </button>
        <div className={typography.smallMuted}>{item.name}</div>
      </td>

      <td className="px-3 py-3">
        <div className={typography.bodyStrong}>
          {item.quantityOnHand.toLocaleString()}
        </div>
      </td>

      <td className="px-3 py-3">
        <div className={lowStock ? typography.warningStrong : typography.bodyStrong}>
          {item.available.toLocaleString()}
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill value={item.status} />
          {lowStock ? <WarningPill label="Low Stock" /> : null}
        </div>
        <div className={`mt-1 ${typography.smallMuted}`}>
          Reorder {effectiveReorderLevel}
        </div>
      </td>

      <td className={`px-3 py-3 ${typography.body}`}>
        <div>{item.locationName || "-"}</div>
        <div className={typography.smallMuted}>
          Bin {item.binLocation || "-"}
        </div>
      </td>

      <td className={`px-3 py-3 ${typography.body}`}>
        <div>{formatMoney(item.totalValue)}</div>
        <div className={typography.smallMuted}>
          Unit {formatMoney(item.unitCost)}
        </div>
      </td>

      <td className="px-3 py-3">
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

          {isAdmin ? (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className={buttons.iconDelete}
              title="Permanent Delete"
              aria-label={`Permanently delete ${item.name}`}
            >
              <DatabaseZap className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
