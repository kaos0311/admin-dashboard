/**
 * Centralized authorization helper for inventory Cloud Functions.
 *
 * Every callable inventory function **must** use `requireStaffOrAdmin`
 * to verify the caller is authenticated, active, and has the correct role.
 *
 * This follows the same pattern as the client-side `requireApiAuth`
 * in `src/lib/auth/require-api-auth.ts` but for the Firebase Functions
 * callable context (where the ID token is already verified by the
 * Functions framework).
 */

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

import { resolveCallableRole } from "../auth/roles.js";

/** Known roles that are allowed to access inventory functions. */
const ALLOWED_ROLES = new Set(["admin", "staff", "tank"]);

/**
 * Valid roles that are authorized for inventory operations.
 * Excludes manager, technician, billing, read-only.
 */
function isAllowedRole(role: unknown): role is string {
  return typeof role === "string" && ALLOWED_ROLES.has(role);
}

/**
 * Verify the caller is authenticated, active, and staff-or-admin.
 *
 * Throws appropriate HttpsError on failure — never returns `undefined`
 * for an authorized caller. The returned uid is always valid.
 */
export async function requireStaffOrAdmin(
  request: CallableRequest,
): Promise<{ uid: string; email: string; role: string }> {
  // 1. Must be authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to access inventory.",
    );
  }

  const uid = request.auth.uid;
  const email = String(
    (request.auth.token as Record<string, unknown>)?.email ?? uid,
  );

  const role = await resolveCallableRole({
    uid,
    token: request.auth.token as Record<string, unknown>,
  });

  if (!isAllowedRole(role)) {
    throw new HttpsError(
      "permission-denied",
      "Insufficient permissions for inventory operations.",
    );
  }

  return { uid, email, role };
}
