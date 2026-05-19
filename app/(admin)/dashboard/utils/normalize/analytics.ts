import type {
  DashboardSummary,
  InventoryAnalytics,
} from "../../dashboard-types";
import { isRecord, safeArray, safeNumber } from "./core";
import { normalizeProduct } from "./products";

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