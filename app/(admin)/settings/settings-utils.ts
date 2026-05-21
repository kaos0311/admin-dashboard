import type {
  AdminUser,
  AppSettings,
  CompanySettings,
  PreferenceSettings,
  SecuritySettings,
  UserRole,
  UserStatus,
} from "./settings-types";

import { DEFAULT_APP_SETTINGS } from "./settings-constants";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function normalizeRole(value: unknown): UserRole {
  return value === "admin" || value === "staff" ? value : "staff";
}

function normalizeStatus(value: unknown): UserStatus {
  return value === "active" || value === "disabled" || value === "pending"
    ? value
    : "active";
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);

  if (typeof value === "object" && value !== null) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObject((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function getErrorMessage(
  error: unknown,
  fallback = "An unknown error occurred."
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function normalizeCompanySettings(
  data: Record<string, unknown> | undefined
): CompanySettings {
  const fallback = DEFAULT_APP_SETTINGS.company;
  const source = data ?? {};

  return {
    companyName: readString(source.companyName) || fallback.companyName,
    legalName: readString(source.legalName) || fallback.legalName,
    phone: readString(source.phone),
    fax: readString(source.fax),
    email: readString(source.email),
    website: readString(source.website) || fallback.website,
    addressLine1: readString(source.addressLine1),
    addressLine2: readString(source.addressLine2),
    city: readString(source.city),
    state: readString(source.state),
    zip: readString(source.zip),
    timezone: readString(source.timezone) || fallback.timezone,
  };
}

export function normalizePreferenceSettings(
  data: Record<string, unknown> | undefined
): PreferenceSettings {
  const fallback = DEFAULT_APP_SETTINGS.preferences;
  const source = data ?? {};

  return {
    defaultDashboardRoute:
      readString(source.defaultDashboardRoute) ||
      fallback.defaultDashboardRoute,
    compactTables: readBoolean(source.compactTables, fallback.compactTables),
    enableAnimations: readBoolean(
      source.enableAnimations,
      fallback.enableAnimations
    ),
    showPhiWarnings: readBoolean(
      source.showPhiWarnings,
      fallback.showPhiWarnings
    ),
    requireDeleteConfirmations: readBoolean(
      source.requireDeleteConfirmations,
      fallback.requireDeleteConfirmations
    ),
    autoRefreshMinutes: readNumber(
      source.autoRefreshMinutes,
      fallback.autoRefreshMinutes
    ),
  };
}

export function normalizeSecuritySettings(
  data: Record<string, unknown> | undefined
): SecuritySettings {
  const fallback = DEFAULT_APP_SETTINGS.security;
  const source = data ?? {};

  return {
    maintenanceMode: readBoolean(
      source.maintenanceMode,
      fallback.maintenanceMode
    ),
    requireAdminForReportsReset: readBoolean(
      source.requireAdminForReportsReset,
      fallback.requireAdminForReportsReset
    ),
    requireAdminForUserManagement: readBoolean(
      source.requireAdminForUserManagement,
      fallback.requireAdminForUserManagement
    ),
    auditSettingsChanges: readBoolean(
      source.auditSettingsChanges,
      fallback.auditSettingsChanges
    ),
    sessionTimeoutMinutes: readNumber(
      source.sessionTimeoutMinutes,
      fallback.sessionTimeoutMinutes
    ),
    allowStaffExports: readBoolean(
      source.allowStaffExports,
      fallback.allowStaffExports
    ),
  };
}

export function normalizeAppSettings(
  data: Record<string, unknown> | undefined
): AppSettings {
  const company =
    typeof data?.company === "object" && data.company !== null
      ? (data.company as Record<string, unknown>)
      : undefined;

  const preferences =
    typeof data?.preferences === "object" && data.preferences !== null
      ? (data.preferences as Record<string, unknown>)
      : undefined;

  const security =
    typeof data?.security === "object" && data.security !== null
      ? (data.security as Record<string, unknown>)
      : undefined;

  return {
    company: normalizeCompanySettings(company),
    preferences: normalizePreferenceSettings(preferences),
    security: normalizeSecuritySettings(security),
    updatedAt: data?.updatedAt,
    updatedBy: readString(data?.updatedBy),
  };
}

export function normalizeAdminUser(
  id: string,
  data: Record<string, unknown>
): AdminUser {
  const status = normalizeStatus(data.status);
  const disabled =
    typeof data.disabled === "boolean" ? data.disabled : status === "disabled";

  const active =
    typeof data.active === "boolean" ? data.active : !disabled;

  return {
    id,
    uid: readString(data.uid) || id,
    email: readString(data.email),
    displayName: readString(data.displayName) || readString(data.name),
    role: normalizeRole(data.role),
    status: active ? "active" : "disabled",
    active,
    disabled,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastLoginAt: data.lastLoginAt,
  };
}

export const normalizeUser = normalizeAdminUser;

export const normalizeSettings = normalizeAppSettings;

export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function stableSettingsString(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

export function hasSettingsChanged(
  current: AppSettings,
  saved: AppSettings
): boolean {
  return stableSettingsString(current) !== stableSettingsString(saved);
}