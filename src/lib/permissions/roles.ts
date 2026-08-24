/**
 * Shared role and permission types for the application.
 *
 * This is the single source of truth for role definitions.
 * All consumers (guards, sidebars, API routes) should import from here.
 */

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every valid role in the system.
 * Existing roles are preserved; new roles extend the union.
 */
export type UserRole =
  | "admin"
  | "manager"
  | "technician"
  | "billing"
  | "read-only"
  | "staff"
  | "tank";

/**
 * Convenience list of all known roles (for iteration / dropdowns).
 */
export const ALL_ROLES: UserRole[] = [
  "admin",
  "manager",
  "technician",
  "billing",
  "read-only",
  "staff",
  "tank",
];

/**
 * Role hierarchy — higher index = more privileged.
 * Used by roleIsAtLeast() to compare roles.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  "read-only": 0,
  billing: 1,
  technician: 2,
  staff: 3,
  manager: 4,
  tank: 5,
  admin: 6,
};

/**
 * Returns true when `role` is at least as privileged as `minimum`.
 */
export function roleIsAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
}

/**
 * Narrow a raw string value into a valid UserRole.
 * Returns null when the value is not a known role.
 */
export function parseRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  if (ALL_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }
  return null;
}

export function isActiveUserRecord(data: Record<string, unknown>): boolean {
  return (
    data.active !== false &&
    data.disabled !== true &&
    data.deleted !== true
  );
}

export function getRoleFromUserRecord(
  data: Record<string, unknown>
): UserRole | null {
  const dbRole = parseRole(data.role);
  if (dbRole) return dbRole;

  if (data.temporaryTankAccess === true) {
    const previousRole = parseRole(data.previousRole);
    if (previousRole === "admin" || previousRole === "tank") {
      return "tank";
    }
  }

  return null;
}

export function resolveUserRole(params: {
  tokenRole: UserRole | null;
  dbRole: UserRole | null;
  hasUserRecord: boolean;
}): UserRole | null {
  if (params.hasUserRecord && params.dbRole) {
    return params.dbRole;
  }

  return params.tokenRole;
}

export function isAdminRole(role: UserRole | null): boolean {
  return role === "admin" || role === "tank";
}

export function isStaffRole(role: UserRole | null): boolean {
  return role === "staff";
}

/* ------------------------------------------------------------------ */
/*  Permissions                                                        */
/* ------------------------------------------------------------------ */

/**
 * Discrete action-level permissions in the system.
 * Add new entries here as the app grows.
 */
export type Permission =
  | "access:command-center"
  | "access:audit-logs"
  | "access:settings"
  | "inventory:read"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "patients:read"
  | "patients:write"
  | "reports:read"
  | "reports:upload"
  | "reports:delete"
  | "rentals:read"
  | "rentals:write"
  | "rolodex:read"
  | "rolodex:write"
  | "billing:read"
  | "billing:write"
  | "admin:users"
  | "admin:roles"
  | "audit:read";

/**
 * Permission map — which roles get which permissions.
 * New roles / permissions should be added here.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  "read-only": [
    "access:command-center",
    "inventory:read",
    "orders:read",
    "patients:read",
    "reports:read",
    "rentals:read",
    "rolodex:read",
  ],

  billing: [
    "access:command-center",
    "inventory:read",
    "orders:read",
    "orders:write",
    "patients:read",
    "reports:read",
    "rentals:read",
    "rolodex:read",
    "billing:read",
    "billing:write",
  ],

  technician: [
    "access:command-center",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "patients:read",
    "patients:write",
    "reports:read",
    "reports:upload",
    "rentals:read",
    "rentals:write",
    "rolodex:read",
    "rolodex:write",
  ],

  staff: [
    "access:command-center",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "patients:read",
    "patients:write",
    "reports:read",
    "reports:upload",
    "rentals:read",
    "rentals:write",
    "rolodex:read",
    "rolodex:write",
  ],

  manager: [
    "access:command-center",
    "access:settings",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "patients:read",
    "patients:write",
    "reports:read",
    "reports:upload",
    "reports:delete",
    "rentals:read",
    "rentals:write",
    "rolodex:read",
    "rolodex:write",
    "billing:read",
    "audit:read",
  ],

  tank: [
    "access:command-center",
    "access:audit-logs",
    "access:settings",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "patients:read",
    "patients:write",
    "reports:read",
    "reports:upload",
    "reports:delete",
    "rentals:read",
    "rentals:write",
    "rolodex:read",
    "rolodex:write",
    "billing:read",
    "billing:write",
    "admin:users",
    "admin:roles",
    "audit:read",
  ],

  admin: [
    "access:command-center",
    "access:audit-logs",
    "access:settings",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "patients:read",
    "patients:write",
    "reports:read",
    "reports:upload",
    "reports:delete",
    "rentals:read",
    "rentals:write",
    "rolodex:read",
    "rolodex:write",
    "billing:read",
    "billing:write",
    "admin:users",
    "admin:roles",
    "audit:read",
  ],
};

export const COMMAND_CENTER_ROLES: UserRole[] = ALL_ROLES.filter((role) =>
  ROLE_PERMISSIONS[role].includes("access:command-center")
);

/**
 * Check whether a given role has a specific permission.
 */
export function hasPermission(
  role: UserRole | null,
  permission: Permission,
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Check whether a given role has *all* of the specified permissions.
 */
export function hasAllPermissions(
  role: UserRole | null,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check whether a given role has *any* of the specified permissions.
 */
export function hasAnyPermission(
  role: UserRole | null,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
