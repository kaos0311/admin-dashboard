"use client";

import type { Dispatch, SetStateAction } from "react";
import { PackageCheck } from "lucide-react";

import { glass, typography } from "@/theme";

import type { AppSettings, InventorySettings } from "../../settings-types";
import { Field } from "../shared/Field";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { ToggleRow } from "../shared/ToggleRow";

type InventoryTabProps = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

export function InventoryTab({
  settings,
  setSettings,
}: InventoryTabProps) {
  function updateInventory<Key extends keyof InventorySettings>(
    key: Key,
    value: InventorySettings[Key]
  ) {
    setSettings((current) => ({
      ...current,
      inventory: {
        ...current.inventory,
        [key]: value,
      },
    }));
  }

  return (
    <section className={`${glass.card} p-5`}>
      <SectionHeader
        eyebrow="Inventory"
        title="Resupply Thresholds"
        description="Set default stock warning levels used by the inventory page when an item does not already have its own reorder level."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <InfoCard
          title="Stock Warning Defaults"
          description="These numbers help flag resupply needs before shelves get thin."
        >
          <div className="grid gap-5">
            <Field
              id="default-reorder-level"
              label="Default Reorder Level"
              type="number"
              value={settings.inventory.defaultReorderLevel}
              onChange={(value) =>
                updateInventory("defaultReorderLevel", Number(value))
              }
              placeholder="5"
            />

            <Field
              id="high-demand-reorder-level"
              label="High Demand Reorder Level"
              type="number"
              value={settings.inventory.highDemandReorderLevel}
              onChange={(value) =>
                updateInventory("highDemandReorderLevel", Number(value))
              }
              placeholder="15"
            />

            <ToggleRow
              title="Low Stock Warnings"
              description="Show low-stock warnings on inventory records when available stock is at or below the configured threshold."
              checked={settings.inventory.lowStockWarningEnabled}
              onChange={(checked) =>
                updateInventory("lowStockWarningEnabled", checked)
              }
            />
          </div>
        </InfoCard>

        <InfoCard title="Category Thresholds">
          <div className="grid gap-5">
            <Field
              id="cpap-supply-reorder-level"
              label="CPAP Supply Reorder Level"
              type="number"
              value={settings.inventory.cpapSupplyReorderLevel}
              onChange={(value) =>
                updateInventory("cpapSupplyReorderLevel", Number(value))
              }
              placeholder="10"
            />

            <Field
              id="oxygen-reorder-level"
              label="Oxygen Reorder Level"
              type="number"
              value={settings.inventory.oxygenReorderLevel}
              onChange={(value) =>
                updateInventory("oxygenReorderLevel", Number(value))
              }
              placeholder="3"
            />

            <Field
              id="rental-equipment-reorder-level"
              label="Rental Equipment Reorder Level"
              type="number"
              value={settings.inventory.rentalEquipmentReorderLevel}
              onChange={(value) =>
                updateInventory("rentalEquipmentReorderLevel", Number(value))
              }
              placeholder="2"
            />
          </div>
        </InfoCard>

        <InfoCard title="How Inventory Uses This">
          <div className="flex gap-3">
            <PackageCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
            <p className={typography.bodyMuted}>
              Item-specific reorder levels still win. If an inventory item has
              no reorder level set, the inventory page falls back to these
              thresholds by category so resupply warnings stay active.
            </p>
          </div>
        </InfoCard>
      </div>
    </section>
  );
}
