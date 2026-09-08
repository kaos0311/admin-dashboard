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

type Role = "admin" | "staff" | "tank";

type UpdateUserRolePayload = {
  uid?: string;
  role?: Role;
};

type UserUidPayload = {
  uid?: string;
};

type ResetUserPasswordPayload = {
  uid?: string;
  newPassword?: string;
};

function isAdminRole(value: unknown): boolean {
  return value === "admin" || value === "tank";
}

async function assertAdmin(request: Parameters<Parameters<typeof onCall>[0]>[0]) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // AUTHORITATIVE POLICY:
  // The users/{uid} active profile is the single source of truth. A stale
  // or elevated custom claim CANNOT grant admin authority when the profile
  // is missing, disabled, deleted, inactive, or has a lower role.
  const role = await resolveCallableRole({
    uid: request.auth.uid,
    token: request.auth.token,
  });

  if (!role || !isAdminRole(role)) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  return request.auth.uid;
}

/**
 * SAFE ORDERING FOR ROLE / STATUS CHANGES:
 *
 * Firebase Auth custom claims and Firestore writes are separate services and
 * CANNOT be made atomic. We therefore choose the authoritative Firestore
 * users/{uid} profile as the source of truth and always write it FIRST.
 *
 * - PRIVILEGE REDUCTION: the profile is lowered/disabled/deleted first.
 *   If the claim sync afterwards fails, enforcement is ALREADY reduced and
 *   the stale claim is never trusted by rules, storage, or callables.
 * - PRIVILEGE GRANT: the profile is raised first. If the claim sync fails,
 *   the user has the granted authority via the profile (the intended state)
 *   and no layer is fooled into granting more than the profile says.
 *
 * In every case the claim is a MIRROR. A failed claim sync never creates
 * dangerous authority because no enforcement layer trusts the claim.
 */
function requireUid(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "A valid uid is required.");
  }

  return value.trim();
}

function requireRole(value: unknown): Role {
  if (value !== "admin" && value !== "staff" && value !== "tank") {
    throw new HttpsError(
      "invalid-argument",
      "Role must be admin, staff, or tank."
    );
  }

  return value;
}

function requirePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 8 characters."
    );
  }

  return value;
}

export const updateUserRole = onCall<UpdateUserRolePayload>(async (request) => {
  await enforceCallableRateLimit(request, "admin");
  const actorUid = await assertAdmin(request);
  const uid = requireUid(request.data?.uid);
  const role = requireRole(request.data?.role);
  const actorEmail = String(request.auth?.token?.email ?? "");

  // 1. Authoritative profile FIRST. Enforcement immediately reflects the
  //    new role on all layers that grant dashboard authority.
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        role,
        disabled: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );

  // 2. Mirror claim second. A failed claim sync is a partial sync failure,
  //    not an authorization change - enforcement already matches the profile.
  let claimSynced = true;
  try {
    await getAuth().setCustomUserClaims(uid, { role });
  } catch {
    claimSynced = false;
  }

  await writeAuditEntry({
    action: "user_role_updated",
    performedByUid: actorUid,
    performedByEmail: actorEmail,
    targetUid: uid,
    details: { newRole: role, claimSynced },
    success: true,
  });

  return {
    ok: true,
    uid,
    role,
    claimSynced,
  };
});

export const disableDashboardUser = onCall<UserUidPayload>(async (request) => {
  await enforceCallableRateLimit(request, "admin");
  const actorUid = await assertAdmin(request);
  const uid = requireUid(request.data?.uid);
  const actorEmail = String(request.auth?.token?.email ?? "");

  if (uid === actorUid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot disable your own account."
    );
  }

  // 1. Authoritative profile FIRST: marking disabled immediately revokes
  //    dashboard authority across rules, storage, and callables.
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        disabled: true,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );

  // 2. Mirror claim second. If this fails, the stale claim is not trusted.
  let claimSynced = true;
  try {
    await getAuth().updateUser(uid, {
      disabled: true,
    });
  } catch {
    claimSynced = false;
  }

  await writeAuditEntry({
    action: "user_status_updated",
    performedByUid: actorUid,
    performedByEmail: actorEmail,
    targetUid: uid,
    details: { newStatus: "disabled", claimSynced },
    success: true,
  });

  return {
    ok: true,
    uid,
    disabled: true,
    claimSynced,
  };
});

export const enableDashboardUser = onCall<UserUidPayload>(async (request) => {
  await enforceCallableRateLimit(request, "admin");
  const actorUid = await assertAdmin(request);
  const uid = requireUid(request.data?.uid);
  const actorEmail = String(request.auth?.token?.email ?? "");

  // 1. Re-enable the authoritative profile first.
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        disabled: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );

  // 2. Mirror claim second.
  let claimSynced = true;
  try {
    await getAuth().updateUser(uid, {
      disabled: false,
    });
  } catch {
    claimSynced = false;
  }

  await writeAuditEntry({
    action: "user_status_updated",
    performedByUid: actorUid,
    performedByEmail: actorEmail,
    targetUid: uid,
    details: { newStatus: "active", claimSynced },
    success: true,
  });

  return {
    ok: true,
    uid,
    disabled: false,
    claimSynced,
  };
});

export const deleteUserAccount = onCall<UserUidPayload>(async (request) => {
  await enforceCallableRateLimit(request, "admin");
  const actorUid = await assertAdmin(request);
  const uid = requireUid(request.data?.uid);
  const actorEmail = String(request.auth?.token?.email ?? "");

  if (uid === actorUid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot delete your own account."
    );
  }

  // 1. Authoritative profile FIRST: tombstone it. The user is immediately
  //    denied dashboard authority even if the claim sync fails.
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        deleted: true,
        disabled: true,
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: actorUid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );

  // 2. Mirror claim second. If this fails, the stale claim is never trusted.
  let claimSynced = true;
  try {
    await getAuth().deleteUser(uid);
  } catch {
    claimSynced = false;
  }

  await writeAuditEntry({
    action: "user_deleted",
    performedByUid: actorUid,
    performedByEmail: actorEmail,
    targetUid: uid,
    details: { deleted: true, claimSynced },
    success: true,
  });

  return {
    ok: true,
    uid,
    deleted: true,
    claimSynced,
  };
});

export const resetUserPassword = onCall<ResetUserPasswordPayload>(
  async (request) => {
    await enforceCallableRateLimit(request, "admin");
    const actorUid = await assertAdmin(request);
    const uid = requireUid(request.data?.uid);
    const newPassword = requirePassword(request.data?.newPassword);
    const actorEmail = String(request.auth?.token?.email ?? "");

    await getAuth().updateUser(uid, {
      password: newPassword,
    });

    await getFirestore()
      .collection("users")
      .doc(uid)
      .set(
        {
          passwordResetAt: FieldValue.serverTimestamp(),
          passwordResetBy: actorUid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actorUid,
        },
        { merge: true }
      );

    await writeAuditEntry({
      action: "user_password_reset",
      performedByUid: actorUid,
      performedByEmail: actorEmail,
      targetUid: uid,
      success: true,
    });

    return {
      ok: true,
      uid,
    };
  }
);
