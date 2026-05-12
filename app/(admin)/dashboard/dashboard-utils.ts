import type {
  BirthdayAnalytics,
  BirthdayItem,
  CleanDatabaseResult,
  DashboardInventoryAnalytics,
  DashboardMovement,
  DashboardOrder,
  DashboardRental,
  DashboardSummary,
  ProductRow,
  WipEmployeeSummary,
} from "./dashboard-types";

export const EMPTY_SUMMARY: DashboardSummary = {
  totalRevenue: 0,
  outstandingBalance: 0,

  totalWips: 0,
  openWips: 0,
  completedWips: 0,

  activeOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  archivedOrders: 0,

  activeRentals: 0,
  monthlyRentalRevenue: 0,

  lowStockAlerts: 0,

  importedReportRows: 0,
  importedReportFiles: 0,
};

export const EMPTY_INVENTORY_ANALYTICS: DashboardInventoryAnalytics = {
  totalProducts: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  totalInventoryValue: 0,
  totalInventoryAvailable: 0,
  totalInventoryOnRent: 0,
  totalInventoryCommitted: 0,
  lowStockItems: [],
};

export const EMPTY_BIRTHDAYS: BirthdayAnalytics = {
  today: [],
  next7Days: [],
  next30Days: [],
  thisMonth: [],
  todayCount: 0,
  next7DaysCount: 0,
  next30DaysCount: 0,
  thisMonthCount: 0,
};

export function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

export function formatDate(value: unknown): string {
  if (!value) return "-";

  try {
    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().toLocaleDateString();
    }

    const parsed =
      value instanceof Date
        ? value
        : typeof value === "string" || typeof value === "number"
          ? new Date(value)
          : null;

    if (!parsed || Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleDateString();
  } catch {
    return "-";
  }
}

export function formatBirthdayTiming(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `${daysUntil} days`;
}

export function privateOrderLabel(value: unknown): string {
  const text = safeString(value);
  return text || "Private Order";
}

export function normalizeDashboardSummary(value: unknown): DashboardSummary {
  const data = toRecord(value);

  return {
    totalRevenue: safeNumber(data.totalRevenue),
    outstandingBalance: safeNumber(data.outstandingBalance),

    totalWips: safeNumber(data.totalWips),
    openWips: safeNumber(data.openWips),
    completedWips: safeNumber(data.completedWips),

    activeOrders: safeNumber(data.activeOrders),
    deliveredOrders: safeNumber(data.deliveredOrders),
    cancelledOrders: safeNumber(data.cancelledOrders),
    archivedOrders: safeNumber(data.archivedOrders),

    activeRentals: safeNumber(data.activeRentals),
    monthlyRentalRevenue: safeNumber(data.monthlyRentalRevenue),

    lowStockAlerts: safeNumber(data.lowStockAlerts),

    importedReportRows: safeNumber(data.importedReportRows),
    importedReportFiles: safeNumber(data.importedReportFiles),
  };
}

export function normalizeInventoryAnalytics(
  value: unknown
): DashboardInventoryAnalytics {
  const data = toRecord(value);

  return {
    totalProducts: safeNumber(data.totalProducts),
    lowStockProducts: safeNumber(data.lowStockProducts),
    outOfStockProducts: safeNumber(data.outOfStockProducts),
    totalInventoryValue: safeNumber(data.totalInventoryValue),

    totalInventoryAvailable: safeNumber(data.totalInventoryAvailable),
    totalInventoryOnRent: safeNumber(data.totalInventoryOnRent),
    totalInventoryCommitted: safeNumber(data.totalInventoryCommitted),

    lowStockItems: Array.isArray(data.lowStockItems)
      ? data.lowStockItems.map(normalizeProduct)
      : [],
  };
}

export function normalizeBirthdayAnalytics(value: unknown): BirthdayAnalytics {
  const data = toRecord(value);

  const today = normalizeBirthdayArray(data.today);
  const next7Days = normalizeBirthdayArray(data.next7Days);
  const next30Days = normalizeBirthdayArray(data.next30Days);
  const thisMonth = normalizeBirthdayArray(data.thisMonth);

  return {
    today,
    next7Days,
    next30Days,
    thisMonth,

    todayCount: safeNumber(data.todayCount) || today.length,
    next7DaysCount: safeNumber(data.next7DaysCount) || next7Days.length,
    next30DaysCount: safeNumber(data.next30DaysCount) || next30Days.length,
    thisMonthCount: safeNumber(data.thisMonthCount) || thisMonth.length,
  };
}

export function normalizeProduct(value: unknown): ProductRow {
  const data = toRecord(value);

  return {
    id: safeString(data.id),
    name: safeString(data.name),
    category: safeString(data.category),
    status: safeString(data.status) || "active",

    available: safeNumber(data.available),
    quantityOnHand: safeNumber(data.quantityOnHand),

    reorderLevel: safeNumber(data.reorderLevel),

    onRent: safeNumber(data.onRent),
    committed: safeNumber(data.committed),
  };
}

export function normalizeOrder(value: unknown): DashboardOrder {
  const data = toRecord(value);

  return {
    id: safeString(data.id),
    status: safeString(data.status),
    productType: safeString(data.productType),
    createdAt: data.createdAt,
  };
}

export function normalizeRental(value: unknown): DashboardRental {
  const data = toRecord(value);

  return {
    id: safeString(data.id),
    patientName: safeString(data.patientName),
    equipment: safeString(data.equipment),
    monthlyAmount: safeNumber(data.monthlyAmount),
    status: safeString(data.status),
  };
}

export function normalizeMovement(value: unknown): DashboardMovement {
  const data = toRecord(value);

  return {
    id: safeString(data.id),
    productName: safeString(data.productName),
    type: safeString(data.type || data.movementType),
    quantity: safeNumber(data.quantity),
    createdAt: data.createdAt,
  };
}

export function normalizeWipEmployee(value: unknown): WipEmployeeSummary {
  const data = toRecord(value);

  return {
    employee: safeString(data.employee || data.employeeName || data.name || "Unassigned"),
    total: safeNumber(data.total),
    open: safeNumber(data.open || data.unresolved),
    completed: safeNumber(data.completed || data.resolved),
    oldestDays: safeNumber(data.oldestDays),
  };
}

export function normalizeCleanDatabaseResult(
  value: unknown
): CleanDatabaseResult {
  const data = toRecord(value);

  return {
    success: Boolean(data.success),
    deletedCollections:
      data.deletedCollections && typeof data.deletedCollections === "object"
        ? (data.deletedCollections as Record<string, number>)
        : {},
    deletedStorageFiles: safeNumber(data.deletedStorageFiles),
  };
}

function normalizeBirthdayArray(value: unknown): BirthdayItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const data = toRecord(item);

    return {
      id: safeString(data.id),
      fullName:
        safeString(data.fullName) ||
        `${safeString(data.firstName)} ${safeString(data.lastName)}`.trim() ||
        "Unknown Patient",
      phone: safeString(data.phone),
      primaryInsurance: safeString(data.primaryInsurance),
      nextAge:
        data.nextAge === null || data.nextAge === undefined
          ? undefined
          : safeNumber(data.nextAge),
      daysUntilBirthday: safeNumber(data.daysUntilBirthday),
    };
  });
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}