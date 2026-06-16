import type {
  AdminUser,
  AppSettings,
  BrightreeReferenceKey,
  BrightreeReferenceRecord,
  BrightreeReferenceSettings,
  CompanySettings,
  InventorySettings,
  PreferenceSettings,
  SecuritySettings,
  UserRole,
  UserStatus,
} from "./settings-types";

import { DEFAULT_APP_SETTINGS } from "./settings-constants";
import {
  BRIGHTREE_REFERENCE_GROUPS,
  DEFAULT_BRIGHTREE_REFERENCES,
} from "./brightree-reference-data";

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
  return value === "admin" || value === "staff" || value === "tank"
    ? value
    : "staff";
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

export function normalizeInventorySettings(
  data: Record<string, unknown> | undefined
): InventorySettings {
  const fallback = DEFAULT_APP_SETTINGS.inventory;
  const source = data ?? {};

  return {
    defaultReorderLevel: readNumber(
      source.defaultReorderLevel,
      fallback.defaultReorderLevel
    ),
    cpapSupplyReorderLevel: readNumber(
      source.cpapSupplyReorderLevel,
      fallback.cpapSupplyReorderLevel
    ),
    oxygenReorderLevel: readNumber(
      source.oxygenReorderLevel,
      fallback.oxygenReorderLevel
    ),
    rentalEquipmentReorderLevel: readNumber(
      source.rentalEquipmentReorderLevel,
      fallback.rentalEquipmentReorderLevel
    ),
    highDemandReorderLevel: readNumber(
      source.highDemandReorderLevel,
      fallback.highDemandReorderLevel
    ),
    lowStockWarningEnabled: readBoolean(
      source.lowStockWarningEnabled,
      fallback.lowStockWarningEnabled
    ),
  };
}

function makeReferenceId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `record-${index + 1}`;
}

function normalizeReferenceRecord(
  value: unknown,
  index: number
): BrightreeReferenceRecord | null {
  if (typeof value === "string") {
    const name = readString(value);
    if (!name) return null;

    return {
      id: makeReferenceId(name, index),
      name,
    };
  }

  if (typeof value !== "object" || value === null) return null;

  const source = value as Record<string, unknown>;
  const name = readString(source.name);
  if (!name) return null;

  return {
    id: readString(source.id) || makeReferenceId(name, index),
    name,
    description: readString(source.description),
    group: readString(source.group),
    address: readString(source.address),
    phone: readString(source.phone),
    fax: readString(source.fax),
    itemGroupNo: readString(source.itemGroupNo),
    paymentType: readString(source.paymentType),
  };
}

function normalizeReferenceList(
  value: unknown,
  fallback: BrightreeReferenceRecord[]
): BrightreeReferenceRecord[] {
  if (!Array.isArray(value)) return fallback;

  return value
    .map(normalizeReferenceRecord)
    .filter((record): record is BrightreeReferenceRecord => Boolean(record));
}

export function normalizeBrightreeReferences(
  data: Record<string, unknown> | undefined
): BrightreeReferenceSettings {
  const source = data ?? {};

  return BRIGHTREE_REFERENCE_GROUPS.reduce<BrightreeReferenceSettings>(
    (acc, group) => {
      acc[group.key] = normalizeReferenceList(
        source[group.key],
        DEFAULT_BRIGHTREE_REFERENCES[group.key]
      );

      return acc;
    },
    {} as BrightreeReferenceSettings
  );
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

  const inventory =
    typeof data?.inventory === "object" && data.inventory !== null
      ? (data.inventory as Record<string, unknown>)
      : undefined;

  const brightreeReferences =
    typeof data?.brightreeReferences === "object" &&
    data.brightreeReferences !== null
      ? (data.brightreeReferences as Record<BrightreeReferenceKey, unknown>)
      : undefined;

  return {
    company: normalizeCompanySettings(company),
    preferences: normalizePreferenceSettings(preferences),
    security: normalizeSecuritySettings(security),
    inventory: normalizeInventorySettings(inventory),
    brightreeReferences: normalizeBrightreeReferences(brightreeReferences),
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


