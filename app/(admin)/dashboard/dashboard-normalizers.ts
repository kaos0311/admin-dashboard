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

import { safeArray, safeNumber, safeString } from "./dashboard-utils";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function normalizeWipEmployee(value: unknown): WipEmployeeSummary {
  const record = asRecord(value);

  return {
    ...record,

    id: safeString(record.id),
    employeeName: safeString(record.employeeName),
    employee: safeString(record.employee),
    employeeId: safeString(record.employeeId),

    openCount: safeNumber(record.openCount),
    completedCount: safeNumber(record.completedCount),
    pendingCount: safeNumber(record.pendingCount),

    activeOrders: safeNumber(record.activeOrders),
    count: safeNumber(record.count),
  } as unknown as WipEmployeeSummary;
}

export function normalizeWipEmployeeSummary(value: unknown): WipEmployeeSummary {
  return normalizeWipEmployee(value);
}

export function normalizeDashboardSummary(value: unknown): DashboardSummary {
  const record = asRecord(value);

  return {
    ...record,
  } as unknown as DashboardSummary;
}

export function normalizeBirthdayAnalytics(value: unknown): BirthdayAnalytics {
  const record = asRecord(value);

  return {
    ...record,

    today: safeArray(record.today),
    upcoming: safeArray(record.upcoming),
    next7Days: safeNumber(record.next7Days),
    next30Days: safeNumber(record.next30Days),
    thisMonth: safeNumber(record.thisMonth),

    upcomingBirthdays: safeArray(record.upcomingBirthdays),
    birthdayPatients: safeArray(record.birthdayPatients),
    overdueBirthdays: safeArray(record.overdueBirthdays),

    totalBirthdays: safeNumber(record.totalBirthdays),
    lastUpdated: record.lastUpdated ?? null,
  } as unknown as BirthdayAnalytics;
}

export function normalizeInventoryAnalytics(value: unknown): InventoryAnalytics {
  const record = asRecord(value);

  return {
    ...record,

    lowStock: safeArray(record.lowStock),
    expiringSoon: safeArray(record.expiringSoon),
    movement: safeArray(record.movement),
  } as unknown as InventoryAnalytics;
}

export function normalizeMovement(value: unknown): MovementRow {
  const record = asRecord(value);

  return {
    ...record,

    id: safeString(record.id),
    type: safeString(record.type),
    quantity: safeNumber(record.quantity),
    createdAt: record.createdAt ?? null,
  } as unknown as MovementRow;
}

export function normalizeOrder(value: unknown): OrderRow {
  const record = asRecord(value);

  return {
    ...record,

    id: safeString(record.id),
    patientName: safeString(record.patientName),
    status: safeString(record.status),
    total: safeNumber(record.total),
    createdAt: record.createdAt ?? null,
  } as unknown as OrderRow;
}

export function normalizeProduct(value: unknown): ProductRow {
  const record = asRecord(value);

  return {
    ...record,

    id: safeString(record.id),
    name: safeString(record.name),
    sku: safeString(record.sku),
    stock: safeNumber(record.stock),
    quantity: safeNumber(record.quantity),
  } as unknown as ProductRow;
}

export function normalizeRental(value: unknown): RentalRow {
  const record = asRecord(value);

  return {
    ...record,

    id: safeString(record.id),
    patientName: safeString(record.patientName),
    equipment: safeString(record.equipment),
    monthlyAmount: safeNumber(record.monthlyAmount),
  } as unknown as RentalRow;
}