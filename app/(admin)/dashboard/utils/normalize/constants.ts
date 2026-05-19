import type {
  BirthdayAnalytics,
  DashboardSummary,
  InventoryAnalytics,
} from "../../dashboard-types";

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