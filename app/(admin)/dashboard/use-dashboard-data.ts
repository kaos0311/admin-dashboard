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
  type QuerySnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  BirthdayAnalytics,
  DashboardSummary,
  ImportedReportRow,
  InventoryAnalytics,
  MovementRow,
  OrderRow,
  ProductRow,
  RentalRow,
  ReportTypeSummary,
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
const IMPORTED_REPORT_LIMIT = 50;

export type DashboardDataState = {
  summary: DashboardSummary;
  birthdays: BirthdayAnalytics;
  inventoryAnalytics: InventoryAnalytics;

  orders: OrderRow[];
  rentals: RentalRow[];
  products: ProductRow[];
  movements: MovementRow[];
  wipEmployees: WipEmployeeSummary[];
  importedReports: ImportedReportRow[];
  reportTypeSummaries: ReportTypeSummary[];

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

function formatTimestamp(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toLocaleString();
  }

  if (typeof value === "string") return value;

  return null;
}

function getStringField(
  data: Record<string, unknown>,
  keys: string[],
  fallback: string
): string {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getNumberField(data: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(data[key]);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

function normalizeImportedReport(
  id: string,
  data: Record<string, unknown>
): ImportedReportRow {
  return {
    id,
    fileName: getStringField(
      data,
      ["fileName", "originalFileName", "name"],
      "Imported report"
    ),
    reportType: getStringField(
      data,
      ["reportType", "primaryReportType", "selectedReportType"],
      "custom"
    ),
    rowCount: getNumberField(data, [
      "rowCount",
      "rowsInserted",
      "rowsProcessed",
      "processedRows",
      "totalRows",
    ]),
    status: getStringField(
      data,
      ["status", "processingStatus", "processingStage"],
      "queued"
    ),
    uploadedAt: formatTimestamp(
      data.uploadedAt ?? data.createdAt ?? data.startedAt ?? data.updatedAt
    ),
  };
}

function mergeImportedReports(
  reports: ImportedReportRow[],
  jobs: ImportedReportRow[]
): ImportedReportRow[] {
  const merged = new Map<string, ImportedReportRow>();

  jobs.forEach((job) => merged.set(job.id, job));
  reports.forEach((report) => {
    const job = merged.get(report.id);

    merged.set(report.id, {
      ...job,
      ...report,
      rowCount: report.rowCount || job?.rowCount || 0,
      uploadedAt: report.uploadedAt || job?.uploadedAt || null,
    });
  });

  return [...merged.values()].slice(0, IMPORTED_REPORT_LIMIT);
}

function buildReportTypeSummaries(reports: ImportedReportRow[]): ReportTypeSummary[] {
  const summaries = new Map<string, ReportTypeSummary>();

  reports.forEach((report) => {
    const reportType = report.reportType || "custom";
    const current = summaries.get(reportType) ?? {
      reportType,
      files: 0,
      rows: 0,
    };

    current.files += 1;
    current.rows += report.rowCount;
    summaries.set(reportType, current);
  });

  return [...summaries.values()].sort((a, b) => b.rows - a.rows);
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

type PreviewSnapshot = QuerySnapshot<Record<string, unknown>>;
type PreviewResult = PromiseSettledResult<PreviewSnapshot>;

function getFulfilledSnapshot(
  result: PreviewResult,
  label: string,
  failures: string[]
): PreviewSnapshot | null {
  if (result.status === "fulfilled") {
    return result.value;
  }

  console.warn(`Dashboard ${label} preview failed.`, result.reason);
  failures.push(label);
  return null;
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
  const [importedReports, setImportedReports] = useState<ImportedReportRow[]>([]);

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
        wipEmployeesResult,
        ordersResult,
        rentalsResult,
        productsResult,
        movementsResult,
        importedReportsResult,
        importJobsResult,
      ] = await Promise.allSettled([
        getDocs(
          query(
            collection(db, "analytics", "wip", "employees"),
            orderBy("open", "desc"),
            limit(WIP_EMPLOYEE_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,

        getDocs(
          query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(ORDER_PREVIEW_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,

        getDocs(
          query(
            collection(db, "rentals"),
            orderBy("createdAt", "desc"),
            limit(RENTAL_PREVIEW_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,

        getDocs(
          query(
            collection(db, "products"),
            orderBy("name", "asc"),
            limit(PRODUCT_PREVIEW_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,

        getDocs(
          query(
            collection(db, "stockMovements"),
            orderBy("createdAt", "desc"),
            limit(MOVEMENT_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,

        getDocs(
          query(
            collection(db, "importedReports"),
            orderBy("uploadedAt", "desc"),
            limit(IMPORTED_REPORT_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,

        getDocs(
          query(
            collection(db, "importJobs"),
            orderBy("createdAt", "desc"),
            limit(IMPORTED_REPORT_LIMIT)
          )
        ) as Promise<PreviewSnapshot>,
      ]);

      const failures: string[] = [];
      const wipEmployeesSnap = getFulfilledSnapshot(
        wipEmployeesResult,
        "WIP employee",
        failures
      );
      const ordersSnap = getFulfilledSnapshot(ordersResult, "orders", failures);
      const rentalsSnap = getFulfilledSnapshot(
        rentalsResult,
        "rentals",
        failures
      );
      const productsSnap = getFulfilledSnapshot(
        productsResult,
        "products",
        failures
      );
      const movementsSnap = getFulfilledSnapshot(
        movementsResult,
        "stock movement",
        failures
      );
      const importedReportsSnap = getFulfilledSnapshot(
        importedReportsResult,
        "imported reports",
        failures
      );
      const importJobsSnap = getFulfilledSnapshot(
        importJobsResult,
        "import jobs",
        failures
      );

      setWipEmployees(
        (wipEmployeesSnap?.docs ?? []).map((docSnap) =>
          normalizeWipEmployee(
            withDocId(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
        )
      );

      setOrders(
        (ordersSnap?.docs ?? []).map((docSnap) =>
          normalizeOrder(
            withDocId(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
        )
      );

      setRentals(
        (rentalsSnap?.docs ?? []).map((docSnap) =>
          normalizeRental(
            withDocId(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
        )
      );

      setProducts(
        (productsSnap?.docs ?? []).map((docSnap) =>
          normalizeProduct(
            withDocId(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
        )
      );

      setImportedReports(
        mergeImportedReports(
          (importedReportsSnap?.docs ?? []).map((docSnap) =>
            normalizeImportedReport(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          ),
          (importJobsSnap?.docs ?? []).map((docSnap) =>
            normalizeImportedReport(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
        )
      );

      setMovements(
        (movementsSnap?.docs ?? []).map((docSnap) =>
          normalizeMovement(
            withDocId(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
        )
      );

      if (failures.length > 0) {
        setError(
          `Some dashboard preview data could not be loaded: ${failures.join(
            ", "
          )}. Check Firestore rules and deployed indexes for those collections.`
        );
      }

      setPreviewsLoaded(true);
    } catch (loadError) {
      console.warn("Dashboard preview data failed to load.", loadError);

      setOrders([]);
      setRentals([]);
      setProducts([]);
      setMovements([]);
      setWipEmployees([]);
      setImportedReports([]);
      setPreviewsLoaded(true);

      setError(
        `Dashboard preview data could not be loaded. Check Firestore permissions, rules, and required indexes. ${getErrorMessage(
          loadError
        )}`
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];

    const dashboardUnsubscribe = onSnapshot(
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
    );

    const birthdaysUnsubscribe = onSnapshot(
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
    );

    const inventoryUnsubscribe = onSnapshot(
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
    );

    unsubscribes.push(
      dashboardUnsubscribe,
      birthdaysUnsubscribe,
      inventoryUnsubscribe
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
  }, [analyticsLoaded, birthdaysLoaded, inventoryLoaded, previewsLoaded]);

  const reportTypeSummaries = useMemo(
    () => buildReportTypeSummaries(importedReports),
    [importedReports]
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
    importedReports,
    reportTypeSummaries,

    loading,
    refreshing,
    error,

    refreshDashboard,
  };
}