"use client";

import { useEffect, useState } from "react";

import { InventoryRepository } from "@/repositories/firestore/inventory.repository";

import {
  defaultInventoryThresholds,
  type InventoryThresholdSettings,
} from "../lib/inventoryAlerts";

export function useInventorySettings() {
  const [thresholds, setThresholds] = useState<InventoryThresholdSettings>(
    defaultInventoryThresholds
  );

  useEffect(() => {
    return InventoryRepository.subscribeToSettings(setThresholds);
  }, []);

  return thresholds;
}
