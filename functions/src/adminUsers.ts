import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

type DashboardRole = "admin" | "staff";

type CreateDashboardUserInput = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  role?: unknown;
};

function requireAdmin(request: { auth?: { token?: Record<string, unknown> } }) {
  const role = request.auth?.token?.role;

  if (role !== "admin") {
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
  if (value === "admin" || value === "staff") {
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
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    requireAdmin(request);

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

      await auth.setCustomUserClaims(userRecord.uid, {
        role,
      });

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

      await db.collection("auditLogs").add({
        action: "dashboard_user_created",
        targetUid: userRecord.uid,
        targetEmail: email,
        role,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        uid: userRecord.uid,
        email,
        displayName,
        role,
      };
    } catch (error) {
      throw mapAuthError(error);
    }
  }
);