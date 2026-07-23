import { redirect } from "next/navigation";
import { parseRole, type Permission, hasPermission } from "@/lib/permissions/roles";

export type { UserRole } from "@/lib/permissions/roles";

export type UserSession = {
  id: string;
  name: string;
  email: string;
  role: import("@/lib/permissions/roles").UserRole;
  isActive: boolean;
};

export async function requireUser(): Promise<UserSession> {
  // Temporary guard until full auth is wired in.
  // This keeps protected pages compiling while we stabilize the app.
  return {
    id: "dev-user",
    name: "Development User",
    email: "dev@advancedhomemedical.local",
    role: "admin",
    isActive: true,
  };
}

/**
 * Require the session's role to be one of the given roles.
 * Redirects to /unauthorized when the check fails.
 */
export async function requireRole(allowedRoles: import("@/lib/permissions/roles").UserRole[]): Promise<UserSession> {
  const user = await requireUser();

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Require the session's role to have all of the given permissions.
 * Redirects to /unauthorized when the check fails.
 */
export async function requirePermission(...permissions: Permission[]): Promise<UserSession> {
  const user = await requireUser();

  const hasAll = permissions.every((p) => hasPermission(user.role, p));

  if (!hasAll) {
    redirect("/unauthorized");
  }

  return user;
}
