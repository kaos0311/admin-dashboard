"use client";

import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
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

export function useInventoryData({
  authLoading,
  canRead,
  refreshKey,
}: UseInventoryDataArgs) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!canRead) {
      setItems([]);
      setLoading(false);
      toast.error("You do not have permission to view inventory.");
      return;
    }

    setLoading(true);

    const inventoryQuery = query(
      collection(db, "inventory"),
      orderBy("name", "asc"),
      limit(INVENTORY_LIMIT)
    );

    const unsubscribe = onSnapshot(
      inventoryQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((docSnap) =>
            normalizeInventoryItem(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
          .filter((item) => !item.isDeleted);

        setItems(rows);
        setLastLoadedAt(new Date());
        setLoading(false);
      },
      (error: unknown) => {
        console.error("LOAD INVENTORY ERROR:", error);
        setLoading(false);
        toast.error("Inventory could not be loaded.");
      }
    );

    return () => unsubscribe();
  }, [authLoading, canRead, refreshKey]);

  return {
    items,
    loading,
    lastLoadedAt,
  };
}