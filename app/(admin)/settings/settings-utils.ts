import type {
  AppSettings,
  HomeScreen,
  ThemeMode,
  UserRole,
  UserRow,
} from "./settings-types";
import { initialSettings } from "./settings-constants";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "staff";
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function isHomeScreen(value: unknown): value is HomeScreen {
  return (
    value === "/dashboard" ||
    value === "/dashboard/products" ||
    value === "/dashboard/orders" ||
    value === "/dashboard/rentals" ||
    value === "/dashboard/users" ||
    value === "/dashboard/settings" ||
    value === "/dashboard/reports"
  );
}

export function normalizeUser(
  uid: string,
  data: Record<string, unknown>
): UserRow {
  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: isUserRole(data.role) ? data.role : "staff",
    active: typeof data.active === "boolean" ? data.active : true,
  };
}

export function normalizeSettings(raw: unknown): AppSettings {
  const data = isRecord(raw) ? raw : {};

  return {
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    companyPhone: typeof data.companyPhone === "string" ? data.companyPhone : "",
    companyEmail: typeof data.companyEmail === "string" ? data.companyEmail : "",
    companyAddress:
      typeof data.companyAddress === "string" ? data.companyAddress : "",
    defaultTheme: isThemeMode(data.defaultTheme) ? data.defaultTheme : "dark",
    defaultHomeScreen: isHomeScreen(data.defaultHomeScreen)
      ? data.defaultHomeScreen
      : "/dashboard",
    compactTables:
      typeof data.compactTables === "boolean" ? data.compactTables : false,
    showDashboardCounters:
      typeof data.showDashboardCounters === "boolean"
        ? data.showDashboardCounters
        : true,
    enableOrderFilters:
      typeof data.enableOrderFilters === "boolean"
        ? data.enableOrderFilters
        : true,
    enableProductFilters:
      typeof data.enableProductFilters === "boolean"
        ? data.enableProductFilters
        : true,
    enableRentalFilters:
      typeof data.enableRentalFilters === "boolean"
        ? data.enableRentalFilters
        : true,
    maintenanceMode:
      typeof data.maintenanceMode === "boolean" ? data.maintenanceMode : false,
    maintenanceMessage:
      typeof data.maintenanceMessage === "string"
        ? data.maintenanceMessage
        : initialSettings.maintenanceMessage,
    allowAdminsDuringMaintenance:
      typeof data.allowAdminsDuringMaintenance === "boolean"
        ? data.allowAdminsDuringMaintenance
        : true,
    allowedUploadTypes:
      typeof data.allowedUploadTypes === "string"
        ? data.allowedUploadTypes
        : ".csv,.pdf,.xlsx",
    maxUploadSizeMb:
      typeof data.maxUploadSizeMb === "number" ? data.maxUploadSizeMb : 25,
    pdfParsingEnabled:
      typeof data.pdfParsingEnabled === "boolean"
        ? data.pdfParsingEnabled
        : true,
    csvParsingEnabled:
      typeof data.csvParsingEnabled === "boolean"
        ? data.csvParsingEnabled
        : true,
    autoIndexAfterUpload:
      typeof data.autoIndexAfterUpload === "boolean"
        ? data.autoIndexAfterUpload
        : true,
    keepRawUploadsInStorage:
      typeof data.keepRawUploadsInStorage === "boolean"
        ? data.keepRawUploadsInStorage
        : true,
  };
}

export function stableSettingsString(value: AppSettings): string {
  return JSON.stringify(value, Object.keys(value).sort());
}