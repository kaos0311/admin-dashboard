import type {
  BirthdayAnalytics,
  DashboardSummary,
  InventoryAnalytics,
} from "./dashboard-types";

export const EMPTY_SUMMARY = {} as unknown as DashboardSummary;

export const EMPTY_BIRTHDAYS = {
  today: [],
  upcoming: [],
  next7Days: 0,
  next30Days: 0,
  thisMonth: 0,
  upcomingBirthdays: [],
  birthdayPatients: [],
  overdueBirthdays: [],
  totalBirthdays: 0,
  lastUpdated: null,
} as unknown as BirthdayAnalytics;

export const EMPTY_INVENTORY_ANALYTICS = {
  lowStock: [],
  expiringSoon: [],
  movement: [],
} as unknown as InventoryAnalytics;