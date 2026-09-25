"use client";

import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import { InventoryRepository } from "@/repositories/firestore/inventory.repository";

import { INVENTORY_LIMIT } from "../lib/inventoryConstants";
import type { InventoryItem } from "../lib/inventoryTypes";

type UseInventoryDataArgs = {
  authLoading: boolean;
  canRead: boolean;
  refreshKey: number;
};

type UseInventoryDataResult = {
  items: InventoryItem[];
  loading: boolean;
  lastLoadedAt: Date | null;
};

export function useInventoryData({
  authLoading,
  canRead,
  refreshKey,
}: UseInventoryDataArgs): UseInventoryDataResult {
  const permissionToastShownRef = useRef(false);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let isActive = true;

    if (!canRead) {
      queueMicrotask(() => {
        if (!isActive) return;

        setItems([]);
        setHasResolvedInitialLoad(true);
        setLastLoadedAt(null);

        if (!permissionToastShownRef.current) {
          toast.error("You do not have permission to view inventory.");
          permissionToastShownRef.current = true;
        }
      });

      return () => {
        isActive = false;
      };
    }

    permissionToastShownRef.current = false;

    const unsubscribe = InventoryRepository.subscribeToInventory(
      INVENTORY_LIMIT,
      (rows) => {
        if (!isActive) return;
        setItems(rows);
        setLastLoadedAt(new Date());
        setHasResolvedInitialLoad(true);
      },
      (error: unknown) => {
        console.error("LOAD INVENTORY ERROR:", error);

        if (!isActive) return;

        setHasResolvedInitialLoad(true);
        toast.error("Inventory could not be loaded.");
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [authLoading, canRead, refreshKey]);

  return {
    items,
    loading: authLoading || !hasResolvedInitialLoad,
    lastLoadedAt,
  };
}
