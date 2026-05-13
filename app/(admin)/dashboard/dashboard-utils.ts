import {
  BirthdayAnalytics,
  DashboardSummary,
  InventoryAnalytics,
  MovementRow,
  OrderRow,
  ProductRow,
  RentalRow,
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

export const EMPTY_INVENTORY_ANALYTICS: InventoryAnalytics = {
  totalInventoryItems: 0,
  totalInventoryValue: 0,
  totalInventoryOnRent: 0,
  totalInventoryCommitted: 0,
  lowStockItems: [],
};

 export const EMPTY_BIRTHDAYS: BirthdayAnalytics = {
  today: [],
  next7Days: [],
  next30Days: [],
  thisMonth: [],
  upcomingBirthdays: [],

  todayCount: 0,
  next7DaysCount: 0,
  next30DaysCount: 0,
  thisMonthCount: 0,
};

export function normalizeDashboardSummary(
  data: Partial<DashboardSummary> | undefined
): DashboardSummary {
  return {
    ...EMPTY_SUMMARY,
    ...data,
  };
}

export function normalizeInventoryAnalytics(
  data: Partial<InventoryAnalytics> | undefined
): InventoryAnalytics {
  return {
    ...EMPTY_INVENTORY_ANALYTICS,
    ...data,
    lowStockItems: Array.isArray(data?.lowStockItems)
      ? data!.lowStockItems
      : [],
  };
}

export function normalizeBirthdayAnalytics(
  data: Partial<BirthdayAnalytics> | undefined
): BirthdayAnalytics {
  return {
    today: Array.isArray(data?.today) ? data.today : [],
    next7Days: Array.isArray(data?.next7Days) ? data.next7Days : [],
    next30Days: Array.isArray(data?.next30Days) ? data.next30Days : [],
    thisMonth: Array.isArray(data?.thisMonth) ? data.thisMonth : [],
    upcomingBirthdays: Array.isArray(data?.upcomingBirthdays)
      ? data.upcomingBirthdays
      : [],

    todayCount: safeNumber(data?.todayCount),
    next7DaysCount: safeNumber(data?.next7DaysCount),
    next30DaysCount: safeNumber(data?.next30DaysCount),
    thisMonthCount: safeNumber(data?.thisMonthCount),
  };
}

export function normalizeProduct(data: any): ProductRow {
  return {
    id: data?.id ?? "",

    name: data?.name ?? "",
    category: data?.category ?? "",

    status: data?.status ?? "active",

    available: Number(data?.available ?? 0),
    quantityOnHand: Number(data?.quantityOnHand ?? 0),

    reorderLevel: Number(data?.reorderLevel ?? 0),

    onRent: Number(data?.onRent ?? 0),
    committed: Number(data?.committed ?? 0),
  };
}

export function normalizeOrder(data: any): OrderRow {
  return {
    id: data?.id ?? "",

    patientName: data?.patientName ?? "",

    orderNumber: data?.orderNumber ?? "",

    status: data?.status ?? "pending",

    total: Number(data?.total ?? 0),

    createdAt: data?.createdAt ?? null,
  };
}

export function normalizeRental(data: any): RentalRow {
  return {
    id: data?.id ?? "",

    patientName: data?.patientName ?? "",

    itemName: data?.itemName ?? "",

    monthlyAmount: Number(data?.monthlyAmount ?? 0),

    status: data?.status ?? "active",

    startedAt: data?.startedAt ?? null,
  };
}

export function normalizeMovement(data: any): MovementRow {
  return {
    id: data?.id ?? "",

    productName: data?.productName ?? "",

    movementType: data?.movementType ?? "",

    quantity: Number(data?.quantity ?? 0),

    performedBy: data?.performedBy ?? "",

    createdAt: data?.createdAt ?? null,
  };
}

export function normalizeWipEmployee(data: any): WipEmployeeSummary {
  const employeeName = data?.employeeName ?? data?.employee ?? "Unassigned";

  return {
    employeeId: data?.employeeId ?? employeeName,
    employeeName,
    employee: data?.employee ?? employeeName,

    openCount: safeNumber(data?.openCount),
    completedCount: safeNumber(data?.completedCount),
    pendingCount: safeNumber(data?.pendingCount),
  };
}export function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatMoney(value: unknown): string {
  const amount = safeNumber(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  value?: string | number | Date | null
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function privateOrderLabel(
  value?: string | null
): string {
  if (!value) {
    return "Private Order";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "Private Order";
  }

  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `#${trimmed.slice(-4)}`;
}