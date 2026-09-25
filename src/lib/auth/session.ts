/**
 * Server-only session management for the AHM Admin Dashboard.
 *
 * Server components and server actions cannot read the browser's
 * Authorization header, so verified identity is bridged through a
 * Firebase session cookie (`__session`, the name Firebase recommends).
 *
 * Flow:
 *   1. Client signs in with Firebase Auth.
 *   2. Client POSTs a freshly minted ID token to `/api/auth/session`.
 *   3. The route calls `adminAuth.createSessionCookie()` and stores the
 *      result in an HttpOnly, SameSite=Lax cookie.
 *   4. `getSessionUser()` (used by `requireUser()` and friends) reads the
 *      cookie, verifies it with `adminAuth.verifySessionCookie(..., true)`
 *      (revocation check enabled), loads the Firestore `users/{uid}`
 *      document, and resolves the role using the shared RBAC in
 *      `@/lib/permissions/roles`.
 *
 * No token contents, secrets, or service-account data are ever logged.
 */

import { cookies } from "next/headers";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import {
  getRoleFromUserRecord,
  isActiveUserRecord,
  parseRole,
  resolveUserRole,
  type UserRole,
} from "@/lib/permissions/roles";

/**
 * Name of the Firebase session cookie. `__session` is Firebase's
 * recommended cookie name and is exempt from `Cache-Control`.
 */
export const SESSION_COOKIE_NAME = "__session";

/**
 * Lifetime of the session cookie / Firebase session cookie.
 * Firebase session cookies allow between 5 minutes and 14 days.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

/**
 * Verified identity loaded from the session cookie plus the Firestore
 * user document. Exposed to the rest of the app via `requireUser()`.
 */
export type SessionUser = {
  uid: string;
  email: string | null;
  role: UserRole;
  name?: string | null;
};

/**
 * Reads the `__session` cookie, verifies it against Firebase Admin,
 * loads the Firestore `users/{uid}` document, and applies the
 * application's authorization checks (active / disabled / deleted /
 * role validity).
 *
 * Returns `null` for every rejection path:
 *   - no cookie
 *   - cookie verification failure (missing / invalid / expired / revoked)
 *   - user document missing
 *   - `active === false`, `disabled === true`, or `deleted === true`
 *   - no valid role on the document or token
 *
 * Roles are always resolved from the server-verified token and the
 * Firestore document — never from client input.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return null;

  let decoded: { uid?: string; email?: string | null; role?: unknown };
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    // Missing, invalid, expired, or revoked session cookie.
    return null;
  }

  const uid = decoded.uid;
  if (!uid) return null;

  return resolveSessionUser({
    uid,
    decodedEmail: decoded.email ?? null,
    tokenRole: parseRole(decoded.role),
  });
}

/**
 * Pure resolution step used by `getSessionUser()`. Separated so it can be
 * tested without a real cookie store.
 *
 * `tokenRole` comes from a verified Firebase session token — it is
 * server-issued and cannot be spoofed by the client.
 */
export async function resolveSessionUser(params: {
  uid: string;
  decodedEmail: string | null;
  tokenRole: UserRole | null;
}): Promise<SessionUser | null> {
  const { uid, decodedEmail, tokenRole } = params;

  const userSnap = await adminDb.collection("users").doc(uid).get();

  if (!userSnap.exists) {
    return null;
  }

  const userData = userSnap.data() as Record<string, unknown>;

  if (!isActiveUserRecord(userData)) {
    return null;
  }

  const dbRole = getRoleFromUserRecord(userData);
  const role = resolveUserRole({
    tokenRole,
    dbRole,
    hasUserRecord: true,
  });
  if (!role) return null;

  const name =
    typeof userData.displayName === "string"
      ? userData.displayName
      : typeof userData.name === "string"
        ? userData.name
        : null;

  return { uid, email: decodedEmail, role, name };
}
