"use client";


import {
  buttons,
  glass,
  tiles,
  typography,
} from "@/theme";
import { Loader2, PackagePlus, Pencil, Save } from "lucide-react";
import type { FormEvent } from "react";

import type {
  InventoryForm as InventoryFormType,
  InventoryStatus,
  LifecycleStatus,
  ScanTarget,
} from "../lib/inventoryTypes";

import { formatMoney, toSafeNumber } from "../lib/inventoryNormalize";

import { FieldGroup } from "./shared/FieldGroup";

import { ScanInput } from "./fields/ScanInput";
import { SelectInput } from "./fields/SelectInput";
import { Textarea } from "./fields/Textarea";
import { TextInput } from "./fields/TextInput";

type InventoryFormProps = {
  form: InventoryFormType;
  autofillOptions: {
    itemNames: string[];
    categories: string[];
    skus: string[];
    hcpcs: string[];
    manufacturers: string[];
    locations: string[];
  };

  saving: boolean;
  canWrite: boolean;

  onSubmit: (event: FormEvent<HTMLFormElement>) => void;

  onReset: () => void;

  onUpdate: <
    K extends keyof InventoryFormType
  >(
    key: K,
    value: InventoryFormType[K]
  ) => void;

  onOpenScanner: (target: ScanTarget) => void;
  onJarvisIdentify?: () => void;
  jarvisIdentifying?: boolean;
};

export function InventoryForm({
  form,
  autofillOptions,
  saving,
  canWrite,
  onSubmit,
  onReset,
  onUpdate,
  onOpenScanner,
  onJarvisIdentify,
  jarvisIdentifying = false,
}: InventoryFormProps) {
  const available =
    toSafeNumber(form.quantityOnHand) -
    toSafeNumber(form.committed) -
    toSafeNumber(form.onRent);

  const totalValue =
    toSafeNumber(form.quantityOnHand) *
    toSafeNumber(form.unitCost);

  return (
    <form
      onSubmit={onSubmit}
      className={`${glass.shell} p-6`}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className={tiles.compact}>
          {form.id ? (
            <Pencil className="h-5 w-5" />
          ) : (
            <PackagePlus className="h-5 w-5" />
          )}
        </div>

        <div>
          <h2 className={typography.sectionTitle}>
            {form.id ? "Edit Item" : "Add Item"}
          </h2>

          <p className={typography.bodyMuted}>
            Inventory tracking, warranty, lifecycle, and searchable metadata.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <FieldGroup title="Core Item">
          <TextInput
            label="Item Name"
            value={form.name}
            onChange={(value) =>
              onUpdate("name", value)
            }
            list="inventory-item-name-options"
            required
          />

          <SuggestionList id="inventory-item-name-options" values={autofillOptions.itemNames} />

          <TextInput
            label="Category"
            value={form.category}
            onChange={(value) =>
              onUpdate("category", value)
            }
            list="inventory-category-options"
            required
          />

          <SuggestionList id="inventory-category-options" values={autofillOptions.categories} />

          <div className="grid gap-3 md:grid-cols-3">
            <TextInput
              label="SKU"
              value={form.sku}
              onChange={(value) =>
                onUpdate("sku", value)
              }
              list="inventory-sku-options"
            />

            <TextInput
              label="HCPCS"
              value={form.hcpc}
              onChange={(value) =>
                onUpdate("hcpc", value.toUpperCase())
              }
              list="inventory-hcpcs-options"
            />

            <TextInput
              label="Barcode"
              value={form.barcode}
              onChange={(value) =>
                onUpdate("barcode", value)
              }
            />
          </div>

          <SuggestionList id="inventory-sku-options" values={autofillOptions.skus} />
          <SuggestionList id="inventory-hcpcs-options" values={autofillOptions.hcpcs} />

          <div className="grid gap-3 md:grid-cols-2">
            <ScanInput
              label="Serial"
              value={form.serial}
              onChange={(value) =>
                onUpdate("serial", value)
              }
              onScan={() =>
                onOpenScanner("serial")
              }
            />

            <ScanInput
              label="Lot Number"
              value={form.lotNumber}
              onChange={(value) =>
                onUpdate("lotNumber", value)
              }
              onScan={() =>
                onOpenScanner("lotNumber")
              }
            />
          </div>
        </FieldGroup>

        {form.id ? (
          <div className={`${glass.insetPadded} flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="min-w-0">
              <p className={typography.bodyStrong}>Jarvis Product Identify</p>
              <p className={`${typography.smallMuted} mt-1`}>
                Search the internet for this scanned code, create/update the
                product, and attach a stock image when found.
              </p>
            </div>

            <button
              type="button"
              className={buttons.secondary}
              disabled={!canWrite || jarvisIdentifying || !onJarvisIdentify}
              onClick={onJarvisIdentify}
            >
              {jarvisIdentifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="h-4 w-4" />
              )}
              Identify Online
            </button>
          </div>
        ) : null}

        <FieldGroup title="Manufacturer">
          <TextInput
            label="Manufacturer"
            value={form.manufacturer}
            onChange={(value) =>
              onUpdate("manufacturer", value)
            }
            list="inventory-manufacturer-options"
          />

          <SuggestionList id="inventory-manufacturer-options" values={autofillOptions.manufacturers} />

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Manufacturer Item ID"
              value={form.manufacturerItemId}
              onChange={(value) =>
                onUpdate("manufacturerItemId", value)
              }
            />

            <TextInput
              label="Model Number"
              value={form.modelNumber}
              onChange={(value) =>
                onUpdate("modelNumber", value)
              }
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Stock">
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Location"
              value={form.locationName}
              onChange={(value) =>
                onUpdate("locationName", value)
              }
              list="inventory-location-options"
            />

            <TextInput
              label="Bin / Shelf"
              value={form.binLocation}
              onChange={(value) =>
                onUpdate("binLocation", value)
              }
            />
          </div>

          <SuggestionList id="inventory-location-options" values={autofillOptions.locations} />

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Quantity"
              type="number"
              value={form.quantityOnHand}
              onChange={(value) =>
                onUpdate("quantityOnHand", value)
              }
            />

            <TextInput
              label="Unit Cost"
              type="number"
              value={form.unitCost}
              onChange={(value) =>
                onUpdate("unitCost", value)
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <TextInput
              label="Committed"
              type="number"
              value={form.committed}
              onChange={(value) =>
                onUpdate("committed", value)
              }
            />

            <TextInput
              label="On Rent"
              type="number"
              value={form.onRent}
              onChange={(value) =>
                onUpdate("onRent", value)
              }
            />

            <TextInput
              label="On Order"
              type="number"
              value={form.onOrder}
              onChange={(value) =>
                onUpdate("onOrder", value)
              }
            />

            <TextInput
              label="Reorder"
              type="number"
              value={form.reorderLevel}
              onChange={(value) =>
                onUpdate("reorderLevel", value)
              }
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Warranty">
          <TextInput
            label="Warranty Provider"
            value={form.warrantyProvider}
            onChange={(value) =>
              onUpdate("warrantyProvider", value)
            }
          />

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Warranty Start"
              type="date"
              value={form.warrantyStartDate}
              onChange={(value) =>
                onUpdate("warrantyStartDate", value)
              }
            />

            <TextInput
              label="Warranty End"
              type="date"
              value={form.warrantyEndDate}
              onChange={(value) =>
                onUpdate("warrantyEndDate", value)
              }
            />
          </div>

          <Textarea
            label="Warranty Notes"
            value={form.warrantyNotes}
            onChange={(value) =>
              onUpdate("warrantyNotes", value)
            }
          />
        </FieldGroup>

        <FieldGroup title="Lifecycle">
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Purchase Date"
              type="date"
              value={form.purchaseDate}
              onChange={(value) =>
                onUpdate("purchaseDate", value)
              }
            />

            <TextInput
              label="Useful Life Months"
              type="number"
              value={form.usefulLifeMonths}
              onChange={(value) =>
                onUpdate("usefulLifeMonths", value)
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SelectInput
              label="Lifecycle Status"
              value={form.lifecycleStatus}
              onChange={(value) =>
                onUpdate(
                  "lifecycleStatus",
                  value as LifecycleStatus
                )
              }
              options={[
                "new",
                "active",
                "needs_service",
                "end_of_life",
                "retired",
              ]}
            />

            <TextInput
              label="Next Service Date"
              type="date"
              value={form.nextServiceDate}
              onChange={(value) =>
                onUpdate("nextServiceDate", value)
              }
            />
          </div>

          <Textarea
            label="Lifecycle Notes"
            value={form.lifecycleNotes}
            onChange={(value) =>
              onUpdate("lifecycleNotes", value)
            }
          />
        </FieldGroup>

        <SelectInput
          label="Inventory Status"
          value={form.status}
          onChange={(value) =>
            onUpdate(
              "status",
              value as InventoryStatus
            )
          }
          options={[
            "available",
            "inactive",
            "damaged",
            "lost",
            "discontinued",
          ]}
        />

        <Textarea
          label="General Notes"
          value={form.notes}
          onChange={(value) =>
            onUpdate("notes", value)
          }
        />

        <div className={`${glass.inset} p-4 ${typography.body}`}>
          Available:{" "}
          <span className={typography.metricCompact}>
            {available.toLocaleString()}
          </span>

          {" â€¢ "}

          Total Value:{" "}
          <span className={typography.metricCompact}>
            {formatMoney(totalValue)}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !canWrite}
            className={`${buttons.primary} flex-1`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            Save Inventory
          </button>

          <button
            type="button"
            onClick={onReset}
            className={buttons.secondary}
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}

function SuggestionList({
  id,
  values,
}: {
  id: string;
  values: string[];
}) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={`${id}-${value}`} value={value} />
      ))}
    </datalist>
  );
}







