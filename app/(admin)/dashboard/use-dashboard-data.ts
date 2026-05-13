"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  BirthdayAnalytics,
  DashboardSummary,
  InventoryAnalytics,
  MovementRow,
  OrderRow,
  ProductRow,
  RentalRow,
  WipEmployeeSummary,
} from "./dashboard-types";

import {
  EMPTY_BIRTHDAYS,
  EMPTY_INVENTORY_ANALYTICS,
  EMPTY_SUMMARY,
  normalizeBirthdayAnalytics,
  normalizeDashboardSummary,
  normalizeInventoryAnalytics,
  normalizeMovement,
  normalizeOrder,
  normalizeProduct,
  normalizeRental,
  normalizeWipEmployee,
} from "./dashboard-utils";

const ORDER_PREVIEW_LIMIT = 15;
const RENTAL_PREVIEW_LIMIT = 15;
const PRODUCT_PREVIEW_LIMIT = 100;
const MOVEMENT_LIMIT = 8;
const WIP_EMPLOYEE_LIMIT = 12;

export type DashboardDataState = {
  summary: DashboardSummary;
  birthdays: BirthdayAnalytics;
  inventoryAnalytics: InventoryAnalytics;

  orders: OrderRow[];
  rentals: RentalRow[];
  products: ProductRow[];
  movements: MovementRow[];
  wipEmployees: WipEmployeeSummary[];

  loading: boolean;
  refreshing: boolean;
  error: string;

  refreshDashboard: () => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown dashboard error.";
}

function withDocId<T extends Record<string, unknown>>(
  id: string,
  data: T
): T & { id: string } {
  return {
    id,
    ...data,
  };
}

export function useDashboardData(): DashboardDataState {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);

  const [birthdays, setBirthdays] =
    useState<BirthdayAnalytics>(EMPTY_BIRTHDAYS);

  const [inventoryAnalytics, setInventoryAnalytics] =
    useState<InventoryAnalytics>(EMPTY_INVENTORY_ANALYTICS);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [wipEmployees, setWipEmployees] = useState<WipEmployeeSummary[]>([]);

  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [birthdaysLoaded, setBirthdaysLoaded] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [previewsLoaded, setPreviewsLoaded] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const [
        wipEmployeesSnap,
        ordersSnap,
        rentalsSnap,
        productsSnap,
        movementsSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, "analytics", "wip", "employees"),
            orderBy("open", "desc"),
            limit(WIP_EMPLOYEE_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(ORDER_PREVIEW_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "rentals"),
            orderBy("createdAt", "desc"),
            limit(RENTAL_PREVIEW_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "products"),
            orderBy("name", "asc"),
            limit(PRODUCT_PREVIEW_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "stockMovements"),
            orderBy("createdAt", "desc"),
            limit(MOVEMENT_LIMIT)
          )
        ),
      ]);

      setWipEmployees(
        wipEmployeesSnap.docs.map((docSnap) =>
          normalizeWipEmployee(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
        )
      );

      setOrders(
        ordersSnap.docs.map((docSnap) =>
          normalizeOrder(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
        )
      );

      setRentals(
        rentalsSnap.docs.map((docSnap) =>
          normalizeRental(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
        )
      );

      setProducts(
        productsSnap.docs.map((docSnap) =>
          normalizeProduct(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
        )
      );

      setMovements(
        movementsSnap.docs.map((docSnap) =>
          normalizeMovement(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
        )
      );

      setPreviewsLoaded(true);
    } catch (loadError) {
      console.warn("Dashboard preview data failed to load.", loadError);

      setOrders([]);
      setRentals([]);
      setProducts([]);
      setMovements([]);
      setWipEmployees([]);

      setError(
        `Dashboard preview data could not be loaded. Check Firestore permissions, rules, and required indexes. ${getErrorMessage(
          loadError
        )}`
      );

      setPreviewsLoaded(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];

    unsubscribes.push(
      onSnapshot(
        doc(db, "analytics", "dashboard"),
        (snap) => {
          setSummary(
            snap.exists()
              ? normalizeDashboardSummary(
                  snap.data() as Partial<DashboardSummary>
                )
              : EMPTY_SUMMARY
          );

          setAnalyticsLoaded(true);
        },
        (snapshotError) => {
          console.warn("analytics/dashboard listener failed.", snapshotError);

          setSummary(EMPTY_SUMMARY);
          setAnalyticsLoaded(true);

          setError(
            `Dashboard analytics could not be loaded. Check Firestore rules for analytics/dashboard. ${getErrorMessage(
              snapshotError
            )}`
          );
        }
      )
    );

    unsubscribes.push(
      onSnapshot(
        doc(db, "analytics", "birthdays"),
        (snap) => {
          setBirthdays(
            snap.exists()
              ? normalizeBirthdayAnalytics(
                  snap.data() as Partial<BirthdayAnalytics>
                )
              : EMPTY_BIRTHDAYS
          );

          setBirthdaysLoaded(true);
        },
        (snapshotError) => {
          console.warn("analytics/birthdays listener failed.", snapshotError);

          setBirthdays(EMPTY_BIRTHDAYS);
          setBirthdaysLoaded(true);
        }
      )
    );

    unsubscribes.push(
      onSnapshot(
        doc(db, "analytics", "inventory"),
        (snap) => {
          setInventoryAnalytics(
            snap.exists()
              ? normalizeInventoryAnalytics(
                  snap.data() as Partial<InventoryAnalytics>
                )
              : EMPTY_INVENTORY_ANALYTICS
          );

          setInventoryLoaded(true);
        },
        (snapshotError) => {
          console.warn("analytics/inventory listener failed.", snapshotError);

          setInventoryAnalytics(EMPTY_INVENTORY_ANALYTICS);
          setInventoryLoaded(true);
        }
      )
    );

    void refreshDashboard();

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [refreshDashboard]);

  const loading = useMemo(() => {
    return (
      !analyticsLoaded ||
      !birthdaysLoaded ||
      !inventoryLoaded ||
      !previewsLoaded
    );
  }, [
    analyticsLoaded,
    birthdaysLoaded,
    inventoryLoaded,
    previewsLoaded,
  ]);

  return {
    summary,
    birthdays,
    inventoryAnalytics,

    orders,
    rentals,
    products,
    movements,
    wipEmployees,

    loading,
    refreshing,
    error,

    refreshDashboard,
  };
}