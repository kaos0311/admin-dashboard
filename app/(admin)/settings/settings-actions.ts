"use server";

import { revalidatePath } from "next/cache";

import type {
  AppSettings,
  CreateUserForm,
  IdentityForm,
  PasswordResetForm,
  UserRole,
  UserRow,
} from "./settings-types";

const SETTINGS_PATH = "/settings";

type ActorPayload = {
  actorUid?: string;
  actorEmail?: string;
};

type SaveAppSettingsPayload = ActorPayload & {
  settings: AppSettings;
  activeTab?: string;
};

type CreateUserPayload = ActorPayload & {
  form: CreateUserForm;
};

type SaveIdentityPayload = ActorPayload & {
  form: IdentityForm;
  target?: UserRow | null;
};

type PasswordResetPayload = ActorPayload & {
  form: PasswordResetForm;
  target?: UserRow | null;
};

type SetUserRolePayload = ActorPayload & {
  user: UserRow;
  role: UserRole;
};

type SetUserActivePayload = ActorPayload & {
  user: UserRow;
  active: boolean;
};

type DeleteUserPayload = ActorPayload & {
  user: UserRow;
};

function notWired(actionName: string): never {
  throw new Error(
    `${actionName} is not wired to Firebase Admin yet. Build-safe placeholder is working, but the real server implementation still needs to be connected.`
  );
}

function revalidateSettings(): void {
  revalidatePath(SETTINGS_PATH);
}

export async function saveAppSettingsAction(
  payload: SaveAppSettingsPayload
): Promise<AppSettings> {
  revalidateSettings();

  return {
    ...payload.settings,
    updatedBy: payload.actorEmail || payload.actorUid || "system",
  };
}

export async function saveSettingsAction(
  payload: SaveAppSettingsPayload
): Promise<AppSettings> {
  return saveAppSettingsAction(payload);
}

export async function saveIdentityAction(
  payload: SaveIdentityPayload
): Promise<IdentityForm> {
  revalidateSettings();

  return {
    uid: payload.form.uid,
    email: payload.form.email.trim(),
    displayName: payload.form.displayName.trim(),
  };
}

export async function createUserAction(
  _payload: CreateUserPayload
): Promise<void> {
  notWired("createUserAction");
}

export async function resetPasswordAction(
  _payload: PasswordResetPayload
): Promise<void> {
  notWired("resetPasswordAction");
}

export async function setUserRoleAction(
  _payload: SetUserRolePayload
): Promise<void> {
  notWired("setUserRoleAction");
}

export async function setUserActiveAction(
  _payload: SetUserActivePayload
): Promise<void> {
  notWired("setUserActiveAction");
}

export async function deleteUserFullyAction(
  _payload: DeleteUserPayload
): Promise<void> {
  notWired("deleteUserFullyAction");
}

export async function runReportsSoftResetAction(
  _payload: ActorPayload
): Promise<string[]> {
  notWired("runReportsSoftResetAction");
}

export async function runDatabaseResetAction(
  _payload: ActorPayload
): Promise<string[]> {
  notWired("runDatabaseResetAction");
}