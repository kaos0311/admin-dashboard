export type DashboardSummary = {
  totalRevenue: number;
  outstandingBalance: number;

  totalWips: number;
  openWips: number;
  completedWips: number;

  activeOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  archivedOrders: number;

  activeRentals: number;
  monthlyRentalRevenue: number;

  lowStockAlerts: number;

  importedReportRows: number;
  importedReportFiles: number;
};

export type ProductRow = {
  id: string;

  name: string;
  category: string;

  status: string;

  available: number;
  quantityOnHand: number;

  reorderLevel: number;

  onRent: number;
  committed: number;
};

export type OrderRow = {
  id: string;

  patientName: string;

  orderNumber: string;

  status: string;

  total: number;

  createdAt?: string | null;
};

export type RentalRow = {
  id: string;

  patientName: string;

  itemName: string;

  monthlyAmount: number;

  status: string;

  startedAt?: string | null;
};

export type MovementRow = {
  id: string;

  productName: string;

  movementType: string;

  quantity: number;

  performedBy: string;

  createdAt?: string | null;
};

export type WipEmployeeSummary = {
  employeeId: string;
  employeeName: string;
  employee?: string;

  openCount: number;
  completedCount: number;
  pendingCount: number;
};

export type BirthdayItem = {
  id: string;

  fullName: string;

  phone?: string;

  primaryInsurance?: string;

  birthday?: string;

  age?: number;
};
export type BirthdayAnalytics = {
  today: BirthdayItem[];
  next7Days: BirthdayItem[];
  next30Days: BirthdayItem[];
  thisMonth: BirthdayItem[];
  upcomingBirthdays: BirthdayItem[];

  todayCount: number;
  next7DaysCount: number;
  next30DaysCount: number;
  thisMonthCount: number;
};
export interface InventoryAnalytics {
  totalInventoryItems: number;

  totalInventoryValue: number;

  totalInventoryOnRent: number;

  totalInventoryCommitted: number;

  lowStockItems: ProductRow[];
}
export type CleanDatabaseResult = {
  ok?: boolean;
  success?: boolean;

  dryRun?: boolean;

  message?: string;

  deletedCollections?: string[];
  deletedStorageFiles?: number;

  deletedDocuments?: number;
  deletedReports?: number;
  deletedRows?: number;
  deletedJobs?: number;

  skipped?: string[];

  startedAt?: string | null;
  completedAt?: string | null;

  error?: string;
};
