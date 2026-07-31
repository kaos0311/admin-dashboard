"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import { OrderRepository } from "@/repositories/firestore/order.repository";

import { ORDERS_PAGE_SIZE } from "../lib/orderConstants";
import { isHospiceText } from "../lib/orderValidation";
import type { FilterTab, OrderRow, OrderStatus } from "../lib/orderTypes";

export function useOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [tab, setTab] = useState<FilterTab>("processing");
  const [hasMore, setHasMore] = useState(false);
  const [lastCursor, setLastCursor] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthed(Boolean(user));

      if (!user) {
        setOrders([]);
        setLoading(false);
        setLastCursor(null);
        setHasMore(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const loadOrders = useCallback(
    async (mode: "initial" | "refresh" | "more" = "initial") => {
      if (!isAuthed) return;

      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        if (mode === "more") setLoadingMore(true);

        const result = await OrderRepository.getOrdersPage({
          tab,
          cursor: mode === "more" ? (lastCursor as any) : null,
          pageSize: ORDERS_PAGE_SIZE,
        });

        const next = result.orders.filter(
          (order) =>
            !order.isHospice && !isHospiceText(order.insurance || ""),
        );

        setOrders((prev) => {
          if (mode !== "more") return next;

          const existing = new Set(prev.map((order) => order.id));
          const uniqueNext = next.filter((order) => !existing.has(order.id));

          return [...prev, ...uniqueNext];
        });

        setHasMore(result.hasMore);
        setLastCursor(result.nextCursor);
      } catch (error: unknown) {
        console.error("LOAD ORDERS ERROR:", error);

        if (mode !== "more") setOrders([]);

        toast.error(
          error instanceof Error ? error.message : "Failed to load orders.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [isAuthed, lastCursor, tab],
  );

  useEffect(() => {
    if (!isAuthed) return;

    setLastCursor(null);
    void loadOrders("initial");
  }, [isAuthed, tab, loadOrders]);

  const summary = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      processing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      archived: 0,
    };

    let needsReview = 0;
    let inventoryIssues = 0;
    let hospiceRisks = 0;
    let missingProduct = 0;
    let archiveReady = 0;

    for (const order of orders) {
      counts[order.status] += 1;

      const reasons = order.reviewReasons || [];

      if (order.needsReview || reasons.length > 0) needsReview += 1;
      if (reasons.includes("inventoryNotAllocated")) inventoryIssues += 1;
      if (reasons.includes("possibleHospice")) hospiceRisks += 1;

      if (
        reasons.includes("missingProduct") ||
        reasons.includes("missingProductId")
      ) {
        missingProduct += 1;
      }

      if (reasons.includes("deliveredReadyForArchive")) archiveReady += 1;
    }

    return {
      ...counts,
      needsReview,
      inventoryIssues,
      hospiceRisks,
      missingProduct,
      archiveReady,
    };
  }, [orders]);

  function resetPagination() {
    setLastCursor(null);
    setHasMore(false);
  }

  return {
    orders,
    setOrders,

    loading,
    refreshing,
    loadingMore,

    tab,
    setTab,

    hasMore,
    loadOrders,
    resetPagination,

    summary,
    isAuthed,
  };
}
