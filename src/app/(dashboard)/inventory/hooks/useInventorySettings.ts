"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  defaultInventoryThresholds,
  type InventoryThresholdSettings,
} from "../lib/inventoryAlerts";

function readNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function useInventorySettings() {
  const [thresholds, setThresholds] = useState<InventoryThresholdSettings>(
    defaultInventoryThresholds
  );

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "app"), (snapshot) => {
      const data = snapshot.data();
      const inventory =
        data?.inventory && typeof data.inventory === "object"
          ? (data.inventory as Record<string, unknown>)
          : {};

      setThresholds({
        defaultReorderLevel: readNumber(
          inventory.defaultReorderLevel,
          defaultInventoryThresholds.defaultReorderLevel
        ),
        cpapSupplyReorderLevel: readNumber(
          inventory.cpapSupplyReorderLevel,
          defaultInventoryThresholds.cpapSupplyReorderLevel
        ),
        oxygenReorderLevel: readNumber(
          inventory.oxygenReorderLevel,
          defaultInventoryThresholds.oxygenReorderLevel
        ),
        rentalEquipmentReorderLevel: readNumber(
          inventory.rentalEquipmentReorderLevel,
          defaultInventoryThresholds.rentalEquipmentReorderLevel
        ),
        highDemandReorderLevel: readNumber(
          inventory.highDemandReorderLevel,
          defaultInventoryThresholds.highDemandReorderLevel
        ),
        lowStockWarningEnabled:
          typeof inventory.lowStockWarningEnabled === "boolean"
            ? inventory.lowStockWarningEnabled
            : defaultInventoryThresholds.lowStockWarningEnabled,
      });
    });
  }, []);

  return thresholds;
}
