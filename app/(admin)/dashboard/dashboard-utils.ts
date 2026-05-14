import type {
  BirthdayAnalytics,
  BirthdayItem,
  DashboardSummary,
  InventoryAnalytics,
  MovementRow,
  OrderRow,
  ProductRow,
  RentalRow,
  WipEmployeeSummary,
} from "./dashboard-types";

type UnknownRecord = Record<string, unknown>;

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

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(data: UnknownRecord, key: string, fallback = ""): string {
  const value = data[key];

  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function getNullableString(data: UnknownRecord, key: string): string | null {
  const value = data[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    isRecord(value) &&
    typeof value.seconds === "number" &&
    Number.isFinite(value.seconds)
  ) {
    return new Date(value.seconds * 1000).toISOString();
  }

  return null;
}

export function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function safeArray<T>(
  value: unknown,
  normalizer: (item: unknown) => T
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizer);
}

function normalizeBirthdayItem(data: unknown): BirthdayItem {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),
    fullName:
      getString(source, "fullName") ||
      getString(source, "patientName") ||
      getString(source, "name") ||
      "Unknown Patient",

    phone: getString(source, "phone") || undefined,
    primaryInsurance: getString(source, "primaryInsurance") || undefined,
    birthday:
      getNullableString(source, "birthday") ||
      getNullableString(source, "dateOfBirth") ||
      undefined,

    age: safeNumber(source.age) || undefined,
  };
}

export function normalizeDashboardSummary(
  data: Partial<DashboardSummary> | undefined
): DashboardSummary {
  const source = isRecord(data) ? data : {};

  return {
    totalRevenue: safeNumber(source.totalRevenue),
    outstandingBalance: safeNumber(source.outstandingBalance),

    totalWips: safeNumber(source.totalWips),
    openWips: safeNumber(source.openWips),
    completedWips: safeNumber(source.completedWips),

    activeOrders: safeNumber(source.activeOrders),
    deliveredOrders: safeNumber(source.deliveredOrders),
    cancelledOrders: safeNumber(source.cancelledOrders),
    archivedOrders: safeNumber(source.archivedOrders),

    activeRentals: safeNumber(source.activeRentals),
    monthlyRentalRevenue: safeNumber(source.monthlyRentalRevenue),

    lowStockAlerts: safeNumber(source.lowStockAlerts),

    importedReportRows: safeNumber(source.importedReportRows),
    importedReportFiles: safeNumber(source.importedReportFiles),
  };
}

export function normalizeInventoryAnalytics(
  data: Partial<InventoryAnalytics> | undefined
): InventoryAnalytics {
  const source = isRecord(data) ? data : {};

  return {
    totalInventoryItems: safeNumber(source.totalInventoryItems),
    totalInventoryValue: safeNumber(source.totalInventoryValue),
    totalInventoryOnRent: safeNumber(source.totalInventoryOnRent),
    totalInventoryCommitted: safeNumber(source.totalInventoryCommitted),

    lowStockItems: safeArray(source.lowStockItems, normalizeProduct),
  };
}

export function normalizeBirthdayAnalytics(
  data: Partial<BirthdayAnalytics> | undefined
): BirthdayAnalytics {
  const source = isRecord(data) ? data : {};

  const today = safeArray(source.today, normalizeBirthdayItem);
  const next7Days = safeArray(source.next7Days, normalizeBirthdayItem);
  const next30Days = safeArray(source.next30Days, normalizeBirthdayItem);
  const thisMonth = safeArray(source.thisMonth, normalizeBirthdayItem);
  const upcomingBirthdays = safeArray(
    source.upcomingBirthdays,
    normalizeBirthdayItem
  );

  return {
    today,
    next7Days,
    next30Days,
    thisMonth,
    upcomingBirthdays,

    todayCount: safeNumber(source.todayCount) || today.length,
    next7DaysCount: safeNumber(source.next7DaysCount) || next7Days.length,
    next30DaysCount: safeNumber(source.next30DaysCount) || next30Days.length,
    thisMonthCount: safeNumber(source.thisMonthCount) || thisMonth.length,
  };
}

export function normalizeProduct(data: unknown): ProductRow {
  const source = isRecord(data) ? data : {};

  const quantityOnHand =
    safeNumber(source.quantityOnHand) ||
    safeNumber(source.quantity) ||
    safeNumber(source.stock);

  const onRent = safeNumber(source.onRent);
  const committed = safeNumber(source.committed);

  const available =
    safeNumber(source.available) || Math.max(quantityOnHand - onRent - committed, 0);

  return {
    id: getString(source, "id"),

    name:
      getString(source, "name") ||
      getString(source, "productName") ||
      getString(source, "itemName") ||
      "Unnamed Product",

    category: getString(source, "category", "Uncategorized"),

    status: getString(source, "status", "active"),

    available,
    quantityOnHand,

    reorderLevel: safeNumber(source.reorderLevel),

    onRent,
    committed,
  };
}

export function normalizeOrder(data: unknown): OrderRow {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    patientName:
      getString(source, "patientName") ||
      getString(source, "customerName") ||
      "Unknown Patient",

    orderNumber:
      getString(source, "orderNumber") ||
      getString(source, "orderId") ||
      getString(source, "id"),

    status: getString(source, "status", "pending"),

    total:
      safeNumber(source.total) ||
      safeNumber(source.totalAmount) ||
      safeNumber(source.amount),

    createdAt:
      getNullableString(source, "createdAt") ||
      getNullableString(source, "createdDate"),
  };
}

export function normalizeRental(data: unknown): RentalRow {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    patientName:
      getString(source, "patientName") ||
      getString(source, "customerName") ||
      "Unknown Patient",

    itemName:
      getString(source, "itemName") ||
      getString(source, "productName") ||
      getString(source, "name") ||
      "Rental Item",

    monthlyAmount:
      safeNumber(source.monthlyAmount) ||
      safeNumber(source.monthlyRentalAmount) ||
      safeNumber(source.amount),

    status: getString(source, "status", "active"),

    startedAt:
      getNullableString(source, "startedAt") ||
      getNullableString(source, "startDate") ||
      getNullableString(source, "createdAt"),
  };
}

export function normalizeMovement(data: unknown): MovementRow {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    productName:
      getString(source, "productName") ||
      getString(source, "itemName") ||
      getString(source, "name") ||
      "Unknown Product",

    movementType:
      getString(source, "movementType") ||
      getString(source, "type") ||
      "movement",

    quantity: safeNumber(source.quantity),

    performedBy:
      getString(source, "performedBy") ||
      getString(source, "userEmail") ||
      getString(source, "actorEmail") ||
      "Unknown",

    createdAt:
      getNullableString(source, "createdAt") ||
      getNullableString(source, "date"),
  };
}

export function normalizeWipEmployee(data: unknown): WipEmployeeSummary {
  const source = isRecord(data) ? data : {};

  const employeeName =
    getString(source, "employeeName") ||
    getString(source, "employee") ||
    getString(source, "name") ||
    "Unassigned";

  return {
    employeeId:
      getString(source, "employeeId") ||
      getString(source, "id") ||
      employeeName,

    employeeName,
    employee: getString(source, "employee", employeeName),

    openCount: safeNumber(source.openCount ?? source.open),
    completedCount: safeNumber(source.completedCount ?? source.completed),
    pendingCount: safeNumber(source.pendingCount ?? source.pending),
  };
}

export function formatMoney(value: unknown): string {
  const amount = safeNumber(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value?: string | number | Date | null): string {
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

export function privateOrderLabel(value?: string | null): string {
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