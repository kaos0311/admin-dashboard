import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) {
  initializeApp();
}

type Role = "admin" | "staff";

type UpdateUserRolePayload = {
  uid?: string;
  role?: Role;
};

type UserUidPayload = {
  uid?: string;
};

function assertAdmin(request: Parameters<Parameters<typeof onCall>[0]>[0]) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const role = request.auth.token.role;

  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  return request.auth.uid;
}

function requireUid(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "A valid uid is required.");
  }

  return value.trim();
}

function requireRole(value: unknown): Role {
  if (value !== "admin" && value !== "staff") {
    throw new HttpsError("invalid-argument", "Role must be admin or staff.");
  }

  return value;
}

export const updateUserRole = onCall<UpdateUserRolePayload>(async (request) => {
  const actorUid = assertAdmin(request);
  const uid = requireUid(request.data?.uid);
  const role = requireRole(request.data?.role);

  await getAuth().setCustomUserClaims(uid, { role });

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

  return {
    ok: true,
    uid,
    role,
  };
});

export const disableDashboardUser = onCall<UserUidPayload>(async (request) => {
  const actorUid = assertAdmin(request);
  const uid = requireUid(request.data?.uid);

  if (uid === actorUid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot disable your own account."
    );
  }

  await getAuth().updateUser(uid, {
    disabled: true,
  });

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

  return {
    ok: true,
    uid,
    disabled: true,
  };
});

export const enableDashboardUser = onCall<UserUidPayload>(async (request) => {
  const actorUid = assertAdmin(request);
  const uid = requireUid(request.data?.uid);

  await getAuth().updateUser(uid, {
    disabled: false,
  });

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

  return {
    ok: true,
    uid,
    disabled: false,
  };
});

export const deleteUserAccount = onCall<UserUidPayload>(async (request) => {
  const actorUid = assertAdmin(request);
  const uid = requireUid(request.data?.uid);

  if (uid === actorUid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot delete your own account."
    );
  }

  await getAuth().deleteUser(uid);

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

  return {
    ok: true,
    uid,
    deleted: true,
  };
});
