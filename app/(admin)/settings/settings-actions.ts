import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "@/lib/firebase";
import type {
  AppSettings,
  CreateUserForm,
  IdentityForm,
  PasswordResetForm,
  UserRole,
  UserRow,
} from "./settings-types";

export async function writeSettingsAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  action: string;
  details?: Record<string, unknown>;
  target?: UserRow | null;
}) {
  await setDoc(doc(collection(db, "auditLogs")), {
    action: params.action,
    actorUid: params.actorUid || "unknown",
    actorEmail: params.actorEmail || "unknown",
    targetUid: params.target?.uid ?? "",
    targetEmail: params.target?.email ?? "",
    details: params.details ?? {},
    createdAt: serverTimestamp(),
  });
}

export async function saveAppSettingsAction(params: {
  settings: AppSettings;
  actorUid: string;
  actorEmail: string;
  activeTab: string;
}) {
  const nextSettings: AppSettings = {
    ...params.settings,
    maxUploadSizeMb: Number(params.settings.maxUploadSizeMb) || 25,
  };

  await setDoc(
    doc(db, "settings", "app"),
    {
      ...nextSettings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "settings_updated",
    details: {
      section: params.activeTab,
      maintenanceMode: nextSettings.maintenanceMode,
    },
  });

  return nextSettings;
}

export async function runReportsSoftResetAction(params: {
  actorUid: string;
  actorEmail: string;
}) {
  const callable = httpsCallable<
    { confirmText: string },
    { ok?: boolean; deletedCollections?: string[] }
  >(functions, "softResetReports");

  const result = await callable({
    confirmText: "RESET REPORTS",
  });

  const deletedCollections = result.data.deletedCollections ?? [];

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "reports_soft_reset",
    details: { deletedCollections },
  });

  return deletedCollections;
}

export async function runDatabaseResetAction(params: {
  actorUid: string;
  actorEmail: string;
}) {
  const callable = httpsCallable<
    { confirmText: string },
    { ok?: boolean; clearedCollections?: string[] }
  >(functions, "resetOperationalDatabase");

  const result = await callable({
    confirmText: "RESET DATABASE",
  });

  const clearedCollections = result.data.clearedCollections ?? [];

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "database_reset",
    details: { clearedCollections },
  });

  return clearedCollections;
}

export async function createUserAction(params: {
  form: CreateUserForm;
  actorUid: string;
  actorEmail: string;
}) {
  const callable = httpsCallable<
    {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
    },
    { success: boolean; uid: string }
  >(functions, "adminCreateUser");

  const cleanEmail = params.form.email.trim();
  const cleanDisplayName = params.form.displayName.trim();

  const result = await callable({
    email: cleanEmail,
    password: params.form.password.trim(),
    displayName: cleanDisplayName,
    role: params.form.role,
  });

  const target: UserRow = {
    uid: result.data.uid,
    email: cleanEmail,
    displayName: cleanDisplayName,
    role: params.form.role,
    active: true,
  };

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "user_created",
    target,
    details: {
      role: params.form.role,
      displayName: cleanDisplayName,
    },
  });

  return target;
}

export async function saveIdentityAction(params: {
  form: IdentityForm;
  target: UserRow | null;
  actorUid: string;
  actorEmail: string;
}) {
  const callable = httpsCallable<
    { uid: string; email: string; displayName: string },
    { success: boolean }
  >(functions, "adminUpdateUserIdentity");

  const cleanEmail = params.form.email.trim();
  const cleanDisplayName = params.form.displayName.trim();

  await callable({
    uid: params.form.uid,
    email: cleanEmail,
    displayName: cleanDisplayName,
  });

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "user_identity_updated",
    target: params.target,
    details: {
      previousEmail: params.target?.email ?? "",
      newEmail: cleanEmail,
      newDisplayName: cleanDisplayName,
    },
  });

  return {
    email: cleanEmail,
    displayName: cleanDisplayName,
  };
}

export async function resetPasswordAction(params: {
  form: PasswordResetForm;
  target: UserRow | null;
  actorUid: string;
  actorEmail: string;
}) {
  const callable = httpsCallable<
    { uid: string; newPassword: string },
    { success: boolean }
  >(functions, "adminResetPassword");

  await callable({
    uid: params.form.uid,
    newPassword: params.form.newPassword.trim(),
  });

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "password_reset",
    target: params.target,
  });
}

export async function setUserRoleAction(params: {
  user: UserRow;
  role: UserRole;
  actorUid: string;
  actorEmail: string;
}) {
  await updateDoc(doc(db, "users", params.user.uid), {
    role: params.role,
    updatedAt: serverTimestamp(),
  });

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "role_updated",
    target: params.user,
    details: {
      previousRole: params.user.role,
      newRole: params.role,
    },
  });
}

export async function setUserActiveAction(params: {
  user: UserRow;
  active: boolean;
  actorUid: string;
  actorEmail: string;
}) {
  await updateDoc(doc(db, "users", params.user.uid), {
    active: params.active,
    updatedAt: serverTimestamp(),
  });

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: params.active ? "user_enabled" : "user_disabled",
    target: params.user,
    details: {
      previousActive: params.user.active,
      newActive: params.active,
    },
  });
}

export async function deleteUserFullyAction(params: {
  user: UserRow;
  actorUid: string;
  actorEmail: string;
}) {
  const callable = httpsCallable<{ uid: string }, { success: boolean }>(
    functions,
    "adminDeleteUserFully"
  );

  await callable({ uid: params.user.uid });

  await writeSettingsAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: "user_deleted_fully",
    target: params.user,
  });
}