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

import { safeArray, safeNumber, safeString } from "./dashboard-utils";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function safeNullableString(value: unknown): string | null {
  const text = safeString(value);

  return text.length > 0 ? text : null;
}

function normalizeBirthdayItem(value: unknown): BirthdayItem {
  const record = asRecord(value);

  return {
    id: safeString(record.id),
    fullName:
      safeString(record.fullName) ||
      safeString(record.patientName) ||
      safeString(record.name),

    phone: safeString(record.phone),
    primaryInsurance: safeString(record.primaryInsurance),
    birthday: safeString(record.birthday),
    age: safeNumber(record.age),
  };
}

function normalizeBirthdayItems(value: unknown): BirthdayItem[] {
  return safeArray<unknown>(value).map(normalizeBirthdayItem);
}

export function normalizeWipEmployee(
  value: unknown
): WipEmployeeSummary {
  const record = asRecord(value);

  const employeeName =
    safeString(record.employeeName) ||
    safeString(record.employee) ||
    safeString(record.name) ||
    "Unassigned";

  return {
    employeeId:
      safeString(record.employeeId) ||
      safeString(record.id),

    employeeName,
    employee: safeString(record.employee),

    openCount:
      safeNumber(record.openCount) ||
      safeNumber(record.open) ||
      safeNumber(record.activeOrders) ||
      safeNumber(record.count),

    completedCount:
      safeNumber(record.completedCount) ||
      safeNumber(record.completed),

    pendingCount:
      safeNumber(record.pendingCount) ||
      safeNumber(record.pending),
  };
}

export function normalizeWipEmployeeSummary(
  value: unknown
): WipEmployeeSummary {
  return normalizeWipEmployee(value);
}

export function normalizeDashboardSummary(
  value: unknown
): DashboardSummary {
  const record = asRecord(value);

  return {
    totalRevenue: safeNumber(record.totalRevenue),
    outstandingBalance: safeNumber(
      record.outstandingBalance
    ),

    totalWips:
      safeNumber(record.totalWips) ||
      safeNumber(record.totalWip) ||
      safeNumber(record.wipTotal),

    openWips:
      safeNumber(record.openWips) ||
      safeNumber(record.openWip) ||
      safeNumber(record.open),

    completedWips:
      safeNumber(record.completedWips) ||
      safeNumber(record.completedWip) ||
      safeNumber(record.completed),

    activeOrders: safeNumber(record.activeOrders),
    deliveredOrders: safeNumber(record.deliveredOrders),
    cancelledOrders: safeNumber(record.cancelledOrders),
    archivedOrders: safeNumber(record.archivedOrders),

    activeRentals: safeNumber(record.activeRentals),
    monthlyRentalRevenue: safeNumber(
      record.monthlyRentalRevenue
    ),

    lowStockAlerts: safeNumber(record.lowStockAlerts),

    importedReportRows: safeNumber(
      record.importedReportRows
    ),

    importedReportFiles: safeNumber(
      record.importedReportFiles
    ),
  };
}

export function normalizeBirthdayAnalytics(
  value: unknown
): BirthdayAnalytics {
  const record = asRecord(value);

  const today = normalizeBirthdayItems(record.today);

  const next7Days = normalizeBirthdayItems(
    record.next7Days
  );

  const next30Days = normalizeBirthdayItems(
    record.next30Days
  );

  const thisMonth = normalizeBirthdayItems(
    record.thisMonth
  );

  const upcomingBirthdays =
    normalizeBirthdayItems(record.upcomingBirthdays)
      .length > 0
      ? normalizeBirthdayItems(record.upcomingBirthdays)
      : normalizeBirthdayItems(record.upcoming);

  return {
    today,
    next7Days,
    next30Days,
    thisMonth,
    upcomingBirthdays,

    todayCount:
      safeNumber(record.todayCount) || today.length,

    next7DaysCount:
      safeNumber(record.next7DaysCount) ||
      next7Days.length,

    next30DaysCount:
      safeNumber(record.next30DaysCount) ||
      next30Days.length,

    thisMonthCount:
      safeNumber(record.thisMonthCount) ||
      thisMonth.length,
  };
}

export function normalizeInventoryAnalytics(
  value: unknown
): InventoryAnalytics {
  const record = asRecord(value);

  return {
    totalInventoryItems:
      safeNumber(record.totalInventoryItems) ||
      safeNumber(record.totalItems),

    totalInventoryValue:
      safeNumber(record.totalInventoryValue) ||
      safeNumber(record.totalValue),

    totalInventoryOnRent:
      safeNumber(record.totalInventoryOnRent) ||
      safeNumber(record.onRent),

    totalInventoryCommitted:
      safeNumber(record.totalInventoryCommitted) ||
      safeNumber(record.committed),

    lowStockItems: safeArray<unknown>(
      record.lowStockItems ?? record.lowStock
    ).map(normalizeProduct),
  };
}

export function normalizeMovement(
  value: unknown
): MovementRow {
  const record = asRecord(value);

  return {
    id: safeString(record.id),

    productName:
      safeString(record.productName) ||
      safeString(record.name),

    movementType:
      safeString(record.movementType) ||
      safeString(record.type),

    performedBy:
      safeString(record.performedBy) ||
      safeString(record.userName) ||
      safeString(record.userEmail),

    quantity: safeNumber(record.quantity),

    createdAt: safeNullableString(record.createdAt),
  };
}

export function normalizeOrder(value: unknown): OrderRow {
  const record = asRecord(value);

  return {
    id: safeString(record.id),

    patientName:
      safeString(record.patientName) ||
      safeString(record.customerName) ||
      safeString(record.name),

    orderNumber:
      safeString(record.orderNumber) ||
      safeString(record.orderNo) ||
      safeString(record.salesOrderNumber),

    status: safeString(record.status) || "active",

    total:
      safeNumber(record.total) ||
      safeNumber(record.totalAmount) ||
      safeNumber(record.amount),

    createdAt: safeNullableString(record.createdAt),
  };
}

export function normalizeProduct(
  value: unknown
): ProductRow {
  const record = asRecord(value);

  return {
    id: safeString(record.id),

    name:
      safeString(record.name) ||
      safeString(record.productName) ||
      "Unnamed Product",

    category: safeString(record.category),

    status: safeString(record.status) || "active",

    available:
      safeNumber(record.available) ||
      safeNumber(record.stock) ||
      safeNumber(record.quantity),

    quantityOnHand:
      safeNumber(record.quantityOnHand) ||
      safeNumber(record.stock) ||
      safeNumber(record.quantity),

    reorderLevel: safeNumber(record.reorderLevel),

    onRent: safeNumber(record.onRent),

    committed: safeNumber(record.committed),
  };
}

export function normalizeRental(value: unknown): RentalRow {
  const record = asRecord(value);

  return {
    id: safeString(record.id),

    patientName:
      safeString(record.patientName) ||
      safeString(record.customerName) ||
      safeString(record.name),

    itemName:
      safeString(record.itemName) ||
      safeString(record.equipment) ||
      safeString(record.productName),

    status: safeString(record.status) || "active",

    monthlyAmount:
      safeNumber(record.monthlyAmount) ||
      safeNumber(record.monthlyRentalAmount) ||
      safeNumber(record.amount),

    startedAt: safeNullableString(
      record.startedAt ?? record.startDate
    ),
  };
}


