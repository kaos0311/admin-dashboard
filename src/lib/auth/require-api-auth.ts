/**
 * Shared authorization helper for Next.js API routes.
 *
 * Verifies a Firebase ID token from the Authorization header,
 * loads the user's Firestore document, and checks role/permissions
 * using the centralized RBAC definitions in @/lib/permissions/roles.
 *
 * Usage:
 *   import { requireApiRole, requireApiPermission } from "@/lib/auth/require-api-auth";
 *
 *   export async function GET(request: NextRequest) {
 *     const auth = await requireApiRole(request, ["admin", "manager"]);
 *     if (!auth.ok) return auth.response;
 *     // ... handler logic
 *   }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import {
  hasPermission,
  type Permission,
  type UserRole,
} from "@/lib/permissions/roles";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type ApiAuthSuccess = {
  ok: true;
  uid: string;
  email: string | null;
  role: UserRole;
};

export type ApiAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function parseRole(raw: unknown): UserRole | null {
  if (typeof raw !== "string") return null;
  const valid: UserRole[] = [
    "admin",
    "manager",
    "technician",
    "billing",
    "read-only",
    "staff",
    "tank",
  ];
  return valid.includes(raw as UserRole) ? (raw as UserRole) : null;
}

function isActiveUser(userData: Record<string, unknown>): boolean {
  return (
    userData.active !== false &&
    userData.disabled !== true &&
    userData.deleted !== true
  );
}

/* ------------------------------------------------------------------ */
/*  Core auth — verify token + fetch user + check active               */
/* ------------------------------------------------------------------ */

type RequestLike = { headers: { get(name: string): string | null } };

/**
 * Authenticate the request and return the user's uid, email, and role.
 *
 * Performs three checks in order:
 *  1. Verify the Firebase ID token from the Authorization header.
 *  2. Fetch the user's Firestore document.
 *  3. Confirm the user is active and has a valid role.
 *
 * On failure returns an appropriate 401 / 403 NextResponse.
 */
export async function requireApiAuth(
  request: RequestLike,
): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 },
      ),
    };
  }

  let decoded: { uid: string; email?: string; role?: unknown };
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid auth token" },
        { status: 401 },
      ),
    };
  }

  const uid = decoded.uid;
  const email = decoded.email ?? null;

  const userSnap = await adminDb.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const userData = userSnap.data() as Record<string, unknown>;
  if (!isActiveUser(userData)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const role = parseRole(userData.role);
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, uid, email, role };
}

/* ------------------------------------------------------------------ */
/*  Role check — require one of the specified roles                     */
/* ------------------------------------------------------------------ */

/**
 * Authenticate and require the user's role to be one of `allowedRoles`.
 * Short-circuits with 403 when the role is not allowed.
 */
export async function requireApiRole(
  request: RequestLike,
  allowedRoles: UserRole[],
): Promise<ApiAuthResult> {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}

/* ------------------------------------------------------------------ */
/*  Permission check — require all specified permissions                */
/* ------------------------------------------------------------------ */

/**
 * Authenticate and require the user's role to have *all* of the
 * specified permissions. Short-circuits with 403 when the check fails.
 */
export async function requireApiPermission(
  request: RequestLike,
  ...permissions: Permission[]
): Promise<ApiAuthResult> {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth;

  const hasAll = permissions.every((p) => hasPermission(auth.role, p));
  if (!hasAll) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}
