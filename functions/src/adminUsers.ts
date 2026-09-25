import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { resolveCallableRole } from "./auth/roles.js";
import { writeAuditEntry } from "./audit/writeAuditEntry.js";
import { enforceCallableRateLimit } from "./security/rateLimit.js";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

type DashboardRole = "admin" | "staff" | "tank";

type CreateDashboardUserInput = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  role?: unknown;
};

function isAdminRole(value: unknown): boolean {
  return value === "admin" || value === "tank";
}

async function requireAdmin(request: {
  auth?: { uid?: string; token?: Record<string, unknown> };
}) {
  if (!request.auth?.uid) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can create dashboard users."
    );
  }

  // AUTHORITATIVE POLICY:
  // The users/{uid} active profile is the single source of truth. The
  // custom claim is never an authority by itself. A stale or elevated
  // admin claim MUST NOT grant admin authority when the profile is
  // missing, disabled, deleted, inactive, or has a lower role.
  const role = await resolveCallableRole({
    uid: request.auth.uid,
    token: request.auth.token ?? {},
  });

  if (!role || !isAdminRole(role)) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can create dashboard users."
    );
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown): DashboardRole {
  if (value === "admin" || value === "staff" || value === "tank") {
    return value;
  }

  return "staff";
}

function validatePayload(data: CreateDashboardUserInput) {
  const email = cleanString(data.email).toLowerCase();
  const password = cleanString(data.password);
  const displayName = cleanString(data.displayName);
  const role = normalizeRole(data.role);

  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  if (!email.includes("@")) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  if (!password || password.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 8 characters."
    );
  }

  return {
    email,
    password,
    displayName,
    role,
  };
}

function mapAuthError(error: unknown): HttpsError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  console.error("createDashboardUser failed:", error);

  switch (code) {
    case "auth/email-already-exists":
      return new HttpsError(
        "already-exists",
        "That email address already exists."
      );

    case "auth/invalid-email":
      return new HttpsError("invalid-argument", "Invalid email address.");

    case "auth/invalid-password":
    case "auth/weak-password":
      return new HttpsError(
        "invalid-argument",
        "Password is invalid or too weak."
      );

    case "auth/uid-already-exists":
      return new HttpsError(
        "already-exists",
        "That user account already exists."
      );

    case "auth/insufficient-permission":
      return new HttpsError(
        "permission-denied",
        "The function service account does not have permission to manage users."
      );

    default:
      return new HttpsError(
        "internal",
        "Unable to create dashboard user. Check function logs."
      );
  }
}

export const createDashboardUser = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "admin");

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    await requireAdmin(request);

    const { email, password, displayName, role } = validatePayload(
      request.data ?? {}
    );

    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: displayName || undefined,
        emailVerified: false,
        disabled: false,
      });

      // AUTHORITATIVE PROFILE FIRST:
      // Firestore is the source of truth for dashboard authority. The user
      // is created with an active profile before the claim mirror is set so
      // a failed claim sync can never produce a user with a role claim but
      // no authoritative profile.
      await db.collection("users").doc(userRecord.uid).set(
        {
          uid: userRecord.uid,
          email,
          displayName,
          role,
          disabled: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: request.auth.uid,
        },
        { merge: true }
      );

      // CLAIM MIRROR SECOND:
      // The custom claim is a mirror of the authoritative profile role. A
      // failed claim sync here does not change effective authorization -
      // enforcement layers read the profile. We report the partial failure
      // so the operator can retry reconciliation.
      let claimSynced = true;
      try {
        await auth.setCustomUserClaims(userRecord.uid, {
          role,
        });
      } catch {
        claimSynced = false;
      }

      await writeAuditEntry({
        action: "user_created",
        performedByUid: request.auth.uid,
        performedByEmail: String(request.auth.token?.email ?? ""),
        targetUid: userRecord.uid,
        targetEmail: email,
        details: { displayName, role, claimSynced },
        success: true,
      });

      return {
        success: true,
        uid: userRecord.uid,
        email,
        displayName,
        role,
        claimSynced,
      };
    } catch (error) {
      throw mapAuthError(error);
    }
  }
);
