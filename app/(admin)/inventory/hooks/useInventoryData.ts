"use client";

import { useEffect, useRef, useState } from "react";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import toast from "react-hot-toast";

import { db } from "@/lib/firebase";

import { INVENTORY_LIMIT } from "../lib/inventoryConstants";
import { normalizeInventoryItem } from "../lib/inventoryNormalize";
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

    const inventoryQuery = query(
      collection(db, "inventory"),
      orderBy("name", "asc"),
      limit(INVENTORY_LIMIT),
    );

    const unsubscribe = onSnapshot(
      inventoryQuery,
      (snapshot) => {
        if (!isActive) return;

        const rows = snapshot.docs
          .map((docSnap) =>
            normalizeInventoryItem(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          )
          .filter((item) => !item.isDeleted);

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
