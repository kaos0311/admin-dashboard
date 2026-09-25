import { redirect } from "next/navigation";

import { hasPermission, type Permission } from "@/lib/permissions/roles";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

export type { UserRole } from "@/lib/permissions/roles";

/**
 * Server-side identity for protected pages and server actions.
 */
export type UserSession = {
  id: string;
  name: string | null;
  email: string | null;
  role: import("@/lib/permissions/roles").UserRole;
  isActive: boolean;
};

function toUserSession(user: SessionUser): UserSession {
  return {
    id: user.uid,
    name: user.name ?? null,
    email: user.email ?? null,
    role: user.role,
    isActive: true,
  };
}

/**
 * Require a verified server-side session.
 *
 * The `__session` cookie is verified with the Firebase Admin SDK
 * (including revocation checks) and the matching Firestore `users/{uid}`
 * document must pass the application's active/disabled/deleted checks and
 * expose a valid role. Unauthenticated users are redirected to /login.
 */
export async function requireUser(): Promise<UserSession> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return toUserSession(user);
}

/**
 * Require the session's role to be one of the given roles.
 * Redirects to /login when unauthenticated.
 * Redirects to /unauthorized when the role check fails.
 */
export async function requireRole(
  allowedRoles: import("@/lib/permissions/roles").UserRole[],
): Promise<UserSession> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return toUserSession(user);
}

/**
 * Require the session's role to have all of the given permissions.
 * Redirects to /login when unauthenticated.
 * Redirects to /unauthorized when the check fails.
 */
export async function requirePermission(
  ...permissions: Permission[]
): Promise<UserSession> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const hasAll = permissions.every((p) => hasPermission(user.role, p));

  if (!hasAll) {
    redirect("/unauthorized");
  }

  return toUserSession(user);
}
