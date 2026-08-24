import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSessionUser, mockRedirect } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import {
  requirePermission,
  requireRole,
  requireUser,
} from "./require-user";

function mockSession(role = "admin") {
  mockGetSessionUser.mockResolvedValue({
    uid: "user-1",
    email: "user@example.com",
    name: "Test User",
    role,
  });
}

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when authentication is missing", async () => {
    mockGetSessionUser.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("redirect:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("returns the verified user session", async () => {
    mockSession("manager");

    await expect(requireUser()).resolves.toEqual({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      role: "manager",
      isActive: true,
    });
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an explicitly permitted role", async () => {
    mockSession("manager");

    await expect(requireRole(["admin", "manager"])).resolves.toMatchObject({
      id: "user-1",
      role: "manager",
    });
  });

  it("redirects to unauthorized for a denied role", async () => {
    mockSession("technician");

    await expect(requireRole(["admin", "manager"])).rejects.toThrow(
      "redirect:/unauthorized",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/unauthorized");
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a role with the required permission", async () => {
    mockSession("admin");

    await expect(requirePermission("inventory:write")).resolves.toMatchObject({
      id: "user-1",
      role: "admin",
    });
  });

  it("redirects to unauthorized when permission is denied", async () => {
    mockSession("read-only");

    await expect(requirePermission("inventory:write")).rejects.toThrow(
      "redirect:/unauthorized",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/unauthorized");
  });
});
