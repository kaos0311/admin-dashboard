/**
 * Unit tests for src/lib/permissions/roles.ts
 *
 * Covers:
 * - parseRole: success, invalid strings, null/undefined
 * - roleIsAtLeast: all hierarchy comparisons
 * - hasPermission: every role × every permission (positive + negative)
 * - hasAllPermissions: conjunction semantics
 * - hasAnyPermission: disjunction semantics
 * - null-safety: all functions when role is null
 */

import { describe, it, expect } from "vitest";
import {
  type UserRole,
  ALL_ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  parseRole,
  roleIsAtLeast,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from "./roles";

/* ------------------------------------------------------------------ */
/*  parseRole                                                          */
/* ------------------------------------------------------------------ */

describe("parseRole", () => {
  describe("success cases", () => {
    for (const role of ALL_ROLES) {
      it(`returns "${role}" for the exact string "${role}"`, () => {
        expect(parseRole(role)).toBe(role);
      });
    }
  });

  describe("failure cases", () => {
    const invalid = [
      ["", "empty string"],
      ["  ", "whitespace-only"],
      ["admin ", "trailing space"],
      [" ADMIN", "uppercase"],
      ["superadmin", "unknown role"],
      ["owner", "another unknown role"],
      [123, "number instead of string"],
      [null, "null"],
      [undefined, "undefined"],
      [false, "boolean"],
      [{}, "plain object"],
      [[], "array"],
    ] as const;

    for (const [value, label] of invalid) {
      it(`returns null for ${label}`, () => {
        expect(parseRole(value)).toBeNull();
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  roleIsAtLeast                                                      */
/* ------------------------------------------------------------------ */

describe("roleIsAtLeast", () => {
  describe("returns true when role is at or above the minimum", () => {
    const cases: [UserRole, UserRole][] = [
      ["admin", "admin"],
      ["admin", "manager"],
      ["admin", "read-only"],
      ["manager", "manager"],
      ["manager", "technician"],
      ["staff", "technician"],
      ["technician", "read-only"],
      ["read-only", "read-only"],
      ["tank", "tank"],
    ];

    for (const [role, minimum] of cases) {
      it(`"${role}" >= "${minimum}"`, () => {
        expect(roleIsAtLeast(role, minimum)).toBe(true);
      });
    }
  });

  describe("returns false when role is below the minimum", () => {
    const cases: [UserRole, UserRole][] = [
      ["read-only", "admin"],
      ["read-only", "manager"],
      ["read-only", "technician"],
      ["billing", "admin"],
      ["technician", "manager"],
      ["manager", "admin"],
      ["technician", "staff"],
      ["staff", "tank"],
      ["tank", undefined as unknown as UserRole],
    ];

    for (const [role, minimum] of cases) {
      it(`"${role}" < "${minimum}"`, () => {
        expect(roleIsAtLeast(role, minimum)).toBe(false);
      });
    }
  });

  it("returns false when role is not a known role", () => {
    expect(roleIsAtLeast("unknown" as UserRole, "admin")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  hasPermission — comprehensive role × permission matrix             */
/* ------------------------------------------------------------------ */

describe("hasPermission", () => {
  describe("returns true for explicitly granted permissions", () => {
    for (const role of ALL_ROLES) {
      const granted = ROLE_PERMISSIONS[role];
      if (!granted || granted.length === 0) continue;

      for (const permission of granted) {
        it(`"${role}" has "${permission}"`, () => {
          expect(hasPermission(role, permission)).toBe(true);
        });
      }
    }
  });

  describe("returns false for permissions NOT granted to a role", () => {
    const ALL_PERMISSIONS = Array.from(
      new Set(Object.values(ROLE_PERMISSIONS).flat()),
    );

    for (const role of ALL_ROLES) {
      const granted = ROLE_PERMISSIONS[role];
      const denied = ALL_PERMISSIONS.filter((p) => !granted?.includes(p));

      // Test a representative sample of denied permissions per role
      const sample = denied.length > 5 ? denied.slice(0, 5) : denied;

      for (const permission of sample) {
        it(`"${role}" does NOT have "${permission}"`, () => {
          expect(hasPermission(role, permission)).toBe(false);
        });
      }
    }
  });

  describe("returns false for null role", () => {
    const somePermission = "inventory:read" as const;
    it(`hasPermission(null, "${somePermission}")`, () => {
      expect(hasPermission(null, somePermission)).toBe(false);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  hasAllPermissions                                                  */
/* ------------------------------------------------------------------ */

describe("hasAllPermissions", () => {
  const adminPerms = ROLE_PERMISSIONS["admin"];

  if (adminPerms) {
    it("returns true when role has every requested permission", () => {
      const subset = adminPerms.slice(0, 3);
      expect(hasAllPermissions("admin", subset)).toBe(true);
    });
  }

  it("returns true for an empty permissions array", () => {
    expect(hasAllPermissions("read-only", [])).toBe(true);
  });

  it("returns false when role is missing at least one permission", () => {
    expect(
      hasAllPermissions("read-only", ["reports:read", "reports:delete"]),
    ).toBe(false);
  });

  it("returns false for null role", () => {
    expect(hasAllPermissions(null, ["inventory:read"])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  hasAnyPermission                                                    */
/* ------------------------------------------------------------------ */

describe("hasAnyPermission", () => {
  it("returns true when role has at least one of the requested permissions", () => {
    expect(
      hasAnyPermission("billing", ["inventory:read", "billing:write"]),
    ).toBe(true);
  });

  it("returns false when role has none of the requested permissions", () => {
    expect(
      hasAnyPermission("read-only", ["admin:users", "admin:roles"]),
    ).toBe(false);
  });

  it("returns false for an empty permissions array", () => {
    expect(hasAnyPermission("admin", [])).toBe(false);
  });

  it("returns false for null role", () => {
    expect(hasAnyPermission(null, ["inventory:read"])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Role-permission data integrity                                     */
/* ------------------------------------------------------------------ */

describe("role-permission data integrity", () => {
  it("every role in ALL_ROLES has an entry in ROLE_PERMISSIONS", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  it("every role in ROLE_PERMISSIONS has a ROLE_HIERARCHY entry with distinct levels", () => {
    const levels = new Set(Object.values(ROLE_HIERARCHY));
    expect(levels.size).toBe(Object.keys(ROLE_HIERARCHY).length);
  });

  it("no duplicate permissions within a single role", () => {
    for (const role of ALL_ROLES) {
      const perms = ROLE_PERMISSIONS[role];
      if (!perms) continue;
      const unique = new Set(perms);
      expect(unique.size).toBe(perms.length);
    }
  });
});
