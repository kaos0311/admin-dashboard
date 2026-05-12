import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type DashboardStats = {
  openOrders: number;
  readyOrders: number;
  activeRentals: number;
  products: number;
  users: number;
  lowStockItems: number;
  insuranceQueue: number;
  importedReports: number;
  outstandingSalesAmount: number;
};

type DashboardRecentOrder = {
  id: string;
  customerName: string;
  item: string;
  status: string;
  date: string;
};

type DashboardLowStockItem = {
  id: string;
  name: string;
  quantity: number;
  reorderLevel: number;
};

type DashboardRecentReport = {
  id: string;
  fileName: string;
  reportType: string;
  uploadedAtLabel: string;
};

type DashboardRecentAuditLog = {
  id: string;
  action: string;
  actorEmail: string;
  targetEmail: string;
  createdAtLabel: string;
};

export type DashboardAnalyticsDoc = {
  stats: DashboardStats;
  recentOrders: DashboardRecentOrder[];
  lowStockItems: DashboardLowStockItem[];
  recentReports: DashboardRecentReport[];
  recentAuditLogs: DashboardRecentAuditLog[];
  generatedAtLabel: string;
  generatedAt?: unknown;
};

type RebuildOptions = {
  includeAuditLogs?: boolean;
};

function safeCount(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatUnknownTimestamp(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  return "-";
}

function parseCurrency(value: unknown): number {
  const raw = getString(value);
  if (!raw) return 0;

  const cleaned = raw.replace(/[$,()]/g, "").trim();
  const negative = raw.includes("(") && raw.includes(")");
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function isOutstandingSalesStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;

  const closedStatuses = [
    "delivered",
    "completed",
    "closed",
    "cancelled",
    "canceled",
    "void",
    "picked up",
    "picked-up",
  ];

  return !closedStatuses.some((value) => normalized.includes(value));
}

function isOutstandingSalesRow(data: Record<string, unknown>): boolean {
  const reportType = getString(data.reportType).toLowerCase();

  const hasSalesShape =
    Boolean(getString(data.SOKey)) &&
    Boolean(getString(data.PatientName)) &&
    Boolean(
      getString(data.ItemDescription) ||
        getString(data.ExtChargeAmt) ||
        getString(data.SOStatus)
    );

  if (reportType === "sales" && hasSalesShape) {
    return isOutstandingSalesStatus(getString(data.SOStatus));
  }

  if (hasSalesShape) {
    return isOutstandingSalesStatus(getString(data.SOStatus));
  }

  return false;
}

export async function rebuildDashboardAnalytics(
  options: RebuildOptions = {}
): Promise<DashboardAnalyticsDoc> {
  const includeAuditLogs = options.includeAuditLogs ?? true;

  const openOrdersQuery = query(
    collection(db, "orders"),
    where("status", "in", ["Processing", "open"])
  );

  const readyOrdersQuery = query(
    collection(db, "orders"),
    where("status", "in", ["Ready"])
  );

  const activeRentalsQuery = query(
    collection(db, "rentals"),
    where("status", "in", ["Active", "active"])
  );

  const lowStockQuery = query(
    collection(db, "inventory"),
    where("status", "==", "active")
  );

  const insuranceQueueQuery = collection(db, "insuranceQueue");
  const importedReportsQuery = collection(db, "importedReports");

  const recentOrdersQuery = query(
    collection(db, "orders"),
    orderBy("date", "desc"),
    limit(5)
  );

  const recentReportsQuery = query(
    collection(db, "importedReports"),
    orderBy("uploadedAt", "desc"),
    limit(5)
  );

  const recentAuditLogsQuery = query(
    collection(db, "auditLogs"),
    orderBy("createdAt", "desc"),
    limit(5)
  );

  const salesRowsQuery = query(collectionGroup(db, "rows"));

  const [
    openOrdersSnap,
    readyOrdersSnap,
    activeRentalsSnap,
    productsSnap,
    usersSnap,
    insuranceQueueSnap,
    importedReportsSnap,
    lowStockRawSnap,
    recentOrdersSnap,
    recentReportsSnap,
    recentAuditLogsSnap,
    salesRowsSnap,
  ] = await Promise.all([
    getCountFromServer(openOrdersQuery),
    getCountFromServer(readyOrdersQuery),
    getCountFromServer(activeRentalsQuery),
    getCountFromServer(collection(db, "products")),
    getCountFromServer(collection(db, "users")),
    getCountFromServer(insuranceQueueQuery),
    getCountFromServer(importedReportsQuery),
    getDocs(lowStockQuery),
    getDocs(recentOrdersQuery),
    getDocs(recentReportsQuery),
    includeAuditLogs ? getDocs(recentAuditLogsQuery) : Promise.resolve(null),
    getDocs(salesRowsQuery),
  ]);

  const lowStockRows: DashboardLowStockItem[] = lowStockRawSnap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const quantity = safeCount(data.quantity);
      const reorderLevel = safeCount(data.reorderLevel);

      return {
        id: docSnap.id,
        name: getString(data.name) || "Unnamed item",
        quantity,
        reorderLevel,
      };
    })
    .filter((item) => item.quantity <= item.reorderLevel)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);

  const recentOrderRows: DashboardRecentOrder[] = recentOrdersSnap.docs.map(
    (docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        customerName:
          getString(data.customerName) ||
          getString(data.customer) ||
          "Unknown customer",
        item: getString(data.item) || getString(data.productName) || "-",
        status: getString(data.status) || "-",
        date: getString(data.date) || formatUnknownTimestamp(data.createdAt),
      };
    }
  );

  const recentReportRows: DashboardRecentReport[] = recentReportsSnap.docs.map(
    (docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        fileName:
          getString(data.fileName) ||
          getString(data.name) ||
          getString(data.originalFileName) ||
          "Imported report",
        reportType: getString(data.reportType) || "-",
        uploadedAtLabel: formatUnknownTimestamp(data.uploadedAt),
      };
    }
  );

  const auditRows: DashboardRecentAuditLog[] =
    includeAuditLogs && recentAuditLogsSnap
      ? recentAuditLogsSnap.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            action: getString(data.action) || "-",
            actorEmail: getString(data.actorEmail) || "-",
            targetEmail: getString(data.targetEmail) || "-",
            createdAtLabel: formatUnknownTimestamp(data.createdAt),
          };
        })
      : [];

  const outstandingSalesAmount = salesRowsSnap.docs.reduce((sum, docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    if (!isOutstandingSalesRow(data)) return sum;
    return sum + parseCurrency(data.ExtChargeAmt);
  }, 0);

  const analyticsDoc: DashboardAnalyticsDoc = {
    stats: {
      openOrders: safeCount(openOrdersSnap.data().count),
      readyOrders: safeCount(readyOrdersSnap.data().count),
      activeRentals: safeCount(activeRentalsSnap.data().count),
      products: safeCount(productsSnap.data().count),
      users: safeCount(usersSnap.data().count),
      lowStockItems: lowStockRows.length,
      insuranceQueue: safeCount(insuranceQueueSnap.data().count),
      importedReports: safeCount(importedReportsSnap.data().count),
      outstandingSalesAmount,
    },
    lowStockItems: lowStockRows,
    recentOrders: recentOrderRows,
    recentReports: recentReportRows,
    recentAuditLogs: auditRows,
    generatedAtLabel: new Date().toLocaleString(),
  };

  await setDoc(
    doc(db, "analytics", "dashboard"),
    {
      ...analyticsDoc,
      generatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return analyticsDoc;
}