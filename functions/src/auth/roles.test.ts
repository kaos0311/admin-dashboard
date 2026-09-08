/**
 * Focused unit tests for the authoritative role resolution path.
 *
 * AUTHORITATIVE POLICY: the users/{uid} active profile is the single source
 * of truth for dashboard authority. A custom claim is never an authority by
 * itself. These tests prove that a stale or elevated custom claim does NOT
 * grant access when the profile is missing, disabled, deleted, inactive, or
 * has a lower role.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";

const mockUserStore = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
}));

vi.mock("firebase-admin/firestore", () => {
  const db = {
    collection: (_collectionName: string) => {
      const doc = (uid: string) => ({
        get: vi.fn(async () => {
          const data = mockUserStore.users.get(uid);
          return {
            exists: Boolean(data),
            id: uid,
            data: () => data,
          };
        }),
      });
      return { doc };
    },
  };

  return {
    getFirestore: vi.fn(() => db),
    FieldValue: {
      serverTimestamp: vi.fn(() => "server-timestamp"),
    },
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError {
    code: string;
    message: string;
    constructor(code: string, message: string) {
      this.code = code;
      this.message = message;
    }
  },
}));

import {
  isAdminRole,
  isStaffOrAdminRole,
  parseRole,
  requireCallableAdmin,
  requireCallableStaffOrAdmin,
  resolveCallableRole,
} from "./roles.js";
import {
  requireStaffOrAdmin,
  requireTank,
} from "../inventory/auth.js";

function seedUser(uid: string, data: Record<string, unknown>) {
  mockUserStore.users.set(uid, data);
}

type AuthedRequest = {
  auth?: { uid: string; token: Record<string, unknown> };
  data: Record<string, unknown>;
};

function asCallableRequest(input: AuthedRequest): CallableRequest {
  return input as unknown as CallableRequest;
}

describe("parseRole", () => {
  it("accepts known dashboard roles", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("staff")).toBe("staff");
    expect(parseRole("tank")).toBe("tank");
  });

  it("rejects unknown roles", () => {
    expect(parseRole("superuser")).toBeNull();
    expect(parseRole("")).toBeNull();
    expect(parseRole(null)).toBeNull();
    expect(parseRole(123)).toBeNull();
  });
});

describe("isAdminRole / isStaffOrAdminRole", () => {
  it("treats admin and tank as admin roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("tank")).toBe(true);
    expect(isAdminRole("staff")).toBe(false);
  });

  it("treats admin, staff, and tank as staff-or-admin roles", () => {
    expect(isStaffOrAdminRole("admin")).toBe(true);
    expect(isStaffOrAdminRole("staff")).toBe(true);
    expect(isStaffOrAdminRole("tank")).toBe(true);
    expect(isStaffOrAdminRole("billing")).toBe(false);
    expect(isStaffOrAdminRole(null)).toBe(false);
  });
});

describe("resolveCallableRole — authoritative profile", () => {
  beforeEach(() => {
    mockUserStore.users.clear();
  });

  it("admin claim + no profile => denied (null)", async () => {
    seedUser("other-user", { role: "admin", active: true });

    const role = await resolveCallableRole({
      uid: "no-profile-user",
      token: { role: "admin" },
    });

    expect(role).toBeNull();
  });

  it("staff claim + no profile => denied (null)", async () => {
    seedUser("other-user", { role: "staff", active: true });

    const role = await resolveCallableRole({
      uid: "no-profile-user",
      token: { role: "staff" },
    });

    expect(role).toBeNull();
  });

  it("admin claim + profile staff => staff (claim cannot elevate)", async () => {
    seedUser("downgraded-user", { role: "staff", active: true, disabled: false, deleted: false });

    const role = await resolveCallableRole({
      uid: "downgraded-user",
      token: { role: "admin" },
    });

    expect(role).toBe("staff");
  });

  it("staff claim + profile admin => admin (profile is authoritative)", async () => {
    seedUser("elevated-user", { role: "admin", active: true, disabled: false, deleted: false });

    const role = await resolveCallableRole({
      uid: "elevated-user",
      token: { role: "staff" },
    });

    expect(role).toBe("admin");
  });

  it("admin claim + disabled profile => denied (null)", async () => {
    seedUser("disabled-user", { role: "admin", active: true, disabled: true, deleted: false });

    const role = await resolveCallableRole({
      uid: "disabled-user",
      token: { role: "admin" },
    });

    expect(role).toBeNull();
  });

  it("admin claim + deleted profile => denied (null)", async () => {
    seedUser("deleted-user", { role: "admin", active: true, disabled: false, deleted: true });

    const role = await resolveCallableRole({
      uid: "deleted-user",
      token: { role: "admin" },
    });

    expect(role).toBeNull();
  });

  it("admin claim + inactive profile (active=false) => denied (null)", async () => {
    seedUser("inactive-user", { role: "admin", active: false, disabled: false, deleted: false });

    const role = await resolveCallableRole({
      uid: "inactive-user",
      token: { role: "admin" },
    });

    expect(role).toBeNull();
  });

  it("matching active admin profile => admin", async () => {
    seedUser("active-admin", { role: "admin", active: true, disabled: false, deleted: false });

    const role = await resolveCallableRole({
      uid: "active-admin",
      token: { role: "admin" },
    });

    expect(role).toBe("admin");
  });

  it("matching active staff profile => staff", async () => {
    seedUser("active-staff", { role: "staff", active: true, disabled: false, deleted: false });

    const role = await resolveCallableRole({
      uid: "active-staff",
      token: { role: "staff" },
    });

    expect(role).toBe("staff");
  });

  it("unauthorized role on active profile => returns the profile role (not elevated)", async () => {
    seedUser("billing-user", { role: "billing", active: true, disabled: false, deleted: false });

    const role = await resolveCallableRole({
      uid: "billing-user",
      token: { role: "admin" },
    });

    expect(role).toBe("billing");
  });

  it("temporaryTankAccess grants tank only when no explicit role is present", async () => {
    seedUser("temp-tank", {
      temporaryTankAccess: true,
      previousRole: "admin",
      active: true,
      disabled: false,
      deleted: false,
    });

    const role = await resolveCallableRole({
      uid: "temp-tank",
      token: { role: "staff" },
    });

    expect(role).toBe("tank");
  });

  it("an explicit staff role takes precedence over temporaryTankAccess", async () => {
    seedUser("explicit-staff-temp-tank", {
      role: "staff",
      temporaryTankAccess: true,
      previousRole: "admin",
      active: true,
      disabled: false,
      deleted: false,
    });

    const role = await resolveCallableRole({
      uid: "explicit-staff-temp-tank",
      token: { role: "admin" },
    });

    expect(role).toBe("staff");
  });

  it("temporaryTankAccess only grants tank for a previous admin/tank role", async () => {
    seedUser("temp-tank-staff-history", {
      temporaryTankAccess: true,
      previousRole: "staff",
      active: true,
      disabled: false,
      deleted: false,
    });

    const role = await resolveCallableRole({
      uid: "temp-tank-staff-history",
      token: { role: "admin" },
    });

    expect(role).toBeNull();
  });
});

describe("requireCallableAdmin / requireCallableStaffOrAdmin guards", () => {
  beforeEach(() => {
    mockUserStore.users.clear();
  });

  it("requireCallableAdmin denies when unauthenticated", async () => {
    await expect(
      requireCallableAdmin(undefined, "Admin access required."),
    ).rejects.toThrow(HttpsError);
  });

  it("requireCallableAdmin denies admin claim + missing profile", async () => {
    seedUser("other", { role: "admin", active: true });

    await expect(
      requireCallableAdmin(
        { uid: "no-profile", token: { role: "admin" } },
        "Admin access required.",
      ),
    ).rejects.toThrow(HttpsError);
  });

  it("requireCallableAdmin denies admin claim + staff profile", async () => {
    seedUser("staff-profile", { role: "staff", active: true });

    await expect(
      requireCallableAdmin(
        { uid: "staff-profile", token: { role: "admin" } },
        "Admin access required.",
      ),
    ).rejects.toThrow(/Admin access required/);
  });

  it("requireCallableAdmin allows a matching active admin profile", async () => {
    seedUser("real-admin", { role: "admin", active: true });

    const role = await requireCallableAdmin(
      { uid: "real-admin", token: { role: "admin" } },
      "Admin access required.",
    );

    expect(role).toBe("admin");
  });

  it("requireCallableStaffOrAdmin denies staff claim + missing profile", async () => {
    seedUser("other", { role: "staff", active: true });

    await expect(
      requireCallableStaffOrAdmin(
        { uid: "no-profile", token: { role: "staff" } },
        "Staff access required.",
      ),
    ).rejects.toThrow(HttpsError);
  });

  it("requireCallableStaffOrAdmin allows a matching active staff profile", async () => {
    seedUser("real-staff", { role: "staff", active: true });

    const role = await requireCallableStaffOrAdmin(
      { uid: "real-staff", token: { role: "staff" } },
      "Staff access required.",
    );

    expect(role).toBe("staff");
  });
});

describe("inventory guards — requireStaffOrAdmin / requireTank", () => {
  beforeEach(() => {
    mockUserStore.users.clear();
  });

  it("requireStaffOrAdmin denies admin claim + missing profile", async () => {
    seedUser("other", { role: "admin", active: true });

    const request = {
      auth: { uid: "no-profile", token: { role: "admin", email: "x@y.com" } },
      data: {},
    };

    await expect(
      requireStaffOrAdmin(asCallableRequest(request)),
    ).rejects.toThrow(HttpsError);
  });

  it("requireStaffOrAdmin denies admin claim + disabled profile", async () => {
    seedUser("disabled-user", { role: "admin", active: true, disabled: true });

    const request = {
      auth: { uid: "disabled-user", token: { role: "admin", email: "x@y.com" } },
      data: {},
    };

    await expect(
      requireStaffOrAdmin(asCallableRequest(request)),
    ).rejects.toThrow(HttpsError);
  });

  it("requireStaffOrAdmin denies admin claim + staff profile (claim cannot elevate)", async () => {
    seedUser("staff-user", { role: "staff", active: true });

    const request = {
      auth: { uid: "staff-user", token: { role: "admin", email: "x@y.com" } },
      data: {},
    };

    const result = await requireStaffOrAdmin(
      asCallableRequest(request),
    );

    expect(result.role).toBe("staff");
  });

  it("requireStaffOrAdmin allows a matching active admin profile", async () => {
    seedUser("admin-user", { role: "admin", active: true });

    const request = {
      auth: { uid: "admin-user", token: { role: "admin", email: "x@y.com" } },
      data: {},
    };

    const result = await requireStaffOrAdmin(
      asCallableRequest(request),
    );

    expect(result.role).toBe("admin");
  });

  it("requireStaffOrAdmin allows a matching active staff profile", async () => {
    seedUser("staff-user", { role: "staff", active: true });

    const request = {
      auth: { uid: "staff-user", token: { role: "staff", email: "x@y.com" } },
      data: {},
    };

    const result = await requireStaffOrAdmin(
      asCallableRequest(request),
    );

    expect(result.role).toBe("staff");
  });

  it("requireTank denies a stale admin claim without tank profile", async () => {
    seedUser("admin-user", { role: "admin", active: true });

    const request = {
      auth: { uid: "admin-user", token: { role: "admin", email: "x@y.com" } },
      data: {},
    };

    await expect(
      requireTank(asCallableRequest(request)),
    ).rejects.toThrow(HttpsError);
  });

  it("requireTank allows a matching active tank profile", async () => {
    seedUser("tank-user", { role: "tank", active: true });

    const request = {
      auth: { uid: "tank-user", token: { role: "tank", email: "x@y.com" } },
      data: {},
    };

    const result = await requireTank(
      asCallableRequest(request),
    );

    expect(result.role).toBe("tank");
  });
});
