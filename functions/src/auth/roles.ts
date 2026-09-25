import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

export type DashboardRole =
  | "admin"
  | "manager"
  | "technician"
  | "billing"
  | "read-only"
  | "staff"
  | "tank";

export type CallableAuthLike = {
  uid: string;
  token: Record<string, unknown>;
};

export function parseRole(value: unknown): DashboardRole | null {
  return value === "admin" ||
    value === "manager" ||
    value === "technician" ||
    value === "billing" ||
    value === "read-only" ||
    value === "staff" ||
    value === "tank"
    ? value
    : null;
}

export function isAdminRole(role: DashboardRole | null): boolean {
  return role === "admin" || role === "tank";
}

export function isStaffOrAdminRole(role: DashboardRole | null): boolean {
  return role === "admin" || role === "staff" || role === "tank";
}

function isActiveUserRecord(data: Record<string, unknown>): boolean {
  return (
    data.active !== false &&
    data.disabled !== true &&
    data.deleted !== true
  );
}

function getRoleFromUserRecord(
  data: Record<string, unknown>
): DashboardRole | null {
  const role = parseRole(data.role);
  if (role) return role;

  if (data.temporaryTankAccess === true) {
    const previousRole = parseRole(data.previousRole);
    if (previousRole === "admin" || previousRole === "tank") {
      return "tank";
    }
  }

  return null;
}

/**
 * Resolve the effective dashboard role for a callable caller.
 *
 * AUTHORITATIVE POLICY: the `users/{uid}` profile is the single source of
 * truth for dashboard authority. A custom claim is never an authority by
 * itself. A missing, disabled, deleted, or inactive profile MUST NOT grant
 * dashboard access even when a stale or elevated custom claim is present.
 *
 * Required conditions to obtain any role:
 *   1. The caller is an authenticated Firebase user.
 *   2. `users/{uid}` exists.
 *   3. The profile is active (not disabled / deleted / inactive).
 *
 * The returned role is the profile role. A custom claim does NOT elevate or
 * preserve access. This is intentionally the same authority used by
 * Firestore rules, Storage rules, and the client permission resolver.
 */
export async function resolveCallableRole(
  auth: CallableAuthLike
): Promise<DashboardRole | null> {
  const userSnap = await getFirestore().collection("users").doc(auth.uid).get();

  // No profile => no dashboard authority. A custom claim alone is never
  // sufficient. (Bootstrap is UID-pinned and writes the profile itself.)
  if (!userSnap.exists) {
    return null;
  }

  const userData = userSnap.data() as Record<string, unknown>;
  if (!isActiveUserRecord(userData)) {
    return null;
  }

  // The profile role is authoritative. We deliberately do NOT fall back to
  // `auth.token.role` here, so a stale/elevated claim cannot override a
  // downgraded, disabled, or deleted profile.
  return getRoleFromUserRecord(userData);
}

export async function requireCallableAdmin(
  auth: CallableAuthLike | undefined,
  message: string
): Promise<DashboardRole> {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = await resolveCallableRole(auth);

  if (!role || !isAdminRole(role)) {
    throw new HttpsError("permission-denied", message);
  }

  return role;
}

export async function requireCallableStaffOrAdmin(
  auth: CallableAuthLike | undefined,
  message: string
): Promise<DashboardRole> {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = await resolveCallableRole(auth);

  if (!role || !isStaffOrAdminRole(role)) {
    throw new HttpsError("permission-denied", message);
  }

  return role;
}
