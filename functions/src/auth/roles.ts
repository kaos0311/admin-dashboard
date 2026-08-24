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

export async function resolveCallableRole(
  auth: CallableAuthLike
): Promise<DashboardRole | null> {
  const tokenRole = parseRole(auth.token.role);
  const userSnap = await getFirestore().collection("users").doc(auth.uid).get();

  if (!userSnap.exists) {
    return tokenRole;
  }

  const userData = userSnap.data() as Record<string, unknown>;
  if (!isActiveUserRecord(userData)) {
    return null;
  }

  return getRoleFromUserRecord(userData) ?? tokenRole;
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