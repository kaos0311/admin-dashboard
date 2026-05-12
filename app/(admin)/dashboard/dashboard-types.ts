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

export type DashboardInventoryAnalytics = {
  totalProducts: number;

  lowStockProducts: number;
  outOfStockProducts: number;

  totalInventoryValue: number;

  totalInventoryAvailable: number;
  totalInventoryOnRent: number;
  totalInventoryCommitted: number;

  lowStockItems: ProductRow[];
};

export type BirthdayItem = {
  id: string;

  fullName: string;

  phone?: string;

  primaryInsurance?: string;

  nextAge?: number;

  daysUntilBirthday: number;
};

export type BirthdayAnalytics = {
  today: BirthdayItem[];
  next7Days: BirthdayItem[];
  next30Days: BirthdayItem[];
  thisMonth: BirthdayItem[];

  todayCount: number;
  next7DaysCount: number;
  next30DaysCount: number;
  thisMonthCount: number;
};

export type DashboardOrder = {
  id: string;

  status: string;

  productType?: string;

  createdAt?: unknown;
};

export type DashboardRental = {
  id: string;

  patientName?: string;

  equipment?: string;

  monthlyAmount?: number;

  status: string;
};

export type DashboardMovement = {
  id: string;

  productName?: string;

  type?: string;

  quantity: number;

  createdAt?: unknown;
};

export type WipEmployeeSummary = {
  employee: string;

  total: number;

  open: number;

  completed: number;

  oldestDays: number;
};

export type CleanDatabaseResult = {
  success?: boolean;

  deletedCollections?: Record<string, number>;

  deletedStorageFiles?: number;
};