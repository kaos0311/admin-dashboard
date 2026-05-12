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
  Unsubscribe,
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
  const [previewsLoaded, setPreviewsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refreshDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      setError("");

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
          normalizeWipEmployee(docSnap.data() as Record<string, unknown>)
        )
      );

      setOrders(
        ordersSnap.docs.map((docSnap) =>
          normalizeOrder(docSnap.id, docSnap.data() as Record<string, unknown>)
        )
      );

      setRentals(
        rentalsSnap.docs.map((docSnap) =>
          normalizeRental(docSnap.id, docSnap.data() as Record<string, unknown>)
        )
      );

      setProducts(
        productsSnap.docs.map((docSnap) =>
          normalizeProduct(docSnap.id, docSnap.data() as Record<string, unknown>)
        )
      );

      setMovements(
        movementsSnap.docs.map((docSnap) =>
          normalizeMovement(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          )
        )
      );

      setPreviewsLoaded(true);
    } catch (loadError) {
      console.warn("Dashboard preview data failed to load.", loadError);
      setError(
        "Dashboard preview data could not be loaded. Check permissions and indexes."
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];

    const markAnalyticsLoaded = () => setAnalyticsLoaded(true);

    unsubscribes.push(
      onSnapshot(
        doc(db, "analytics", "dashboard"),
        (snap) => {
          setSummary(
            snap.exists()
              ? normalizeDashboardSummary(
                  snap.data() as Record<string, unknown>
                )
              : EMPTY_SUMMARY
          );

          markAnalyticsLoaded();
        },
        (snapshotError) => {
          console.warn("analytics/dashboard listener failed.", snapshotError);
          setError(
            "Dashboard analytics could not be loaded. Check Firestore rules for analytics/dashboard."
          );
          markAnalyticsLoaded();
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
                  snap.data() as Record<string, unknown>
                )
              : EMPTY_BIRTHDAYS
          );
        },
        (snapshotError) => {
          console.warn("analytics/birthdays listener failed.", snapshotError);
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
                  snap.data() as Record<string, unknown>
                )
              : EMPTY_INVENTORY_ANALYTICS
          );
        },
        (snapshotError) => {
          console.warn("analytics/inventory listener failed.", snapshotError);
        }
      )
    );

    void refreshDashboard();

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [refreshDashboard]);

  const loading = useMemo(
    () => !analyticsLoaded || !previewsLoaded,
    [analyticsLoaded, previewsLoaded]
  );

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