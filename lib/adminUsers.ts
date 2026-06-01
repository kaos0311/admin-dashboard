import { FirebaseError } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app } from "@/lib/firebase";

export type UserRole = "admin" | "staff";

export type CreateDashboardUserPayload = {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
};

export type UpdateUserRolePayload = {
  uid: string;
  role: UserRole;
};

export type UserActionPayload = {
  uid: string;
};

export type CloudFunctionResult = {
  success: boolean;
  message?: string;
};

export type CreateDashboardUserResult = {
  success: boolean;
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
};

const functions = getFunctions(app, "us-central1");

function cleanMessage(message: string): string {
  return message
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "")
    .trim();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return cleanMessage(error.message);
  }

  if (error instanceof Error) {
    return cleanMessage(error.message);
  }

  return "An unexpected error occurred.";
}

async function callFunction<TPayload, TResult>(
  name: string,
  payload: TPayload
): Promise<TResult> {
  try {
    const callable = httpsCallable<TPayload, TResult>(
      functions,
      name
    );

    const result = await callable(payload);

    return result.data;
  } catch (error) {
    console.error(`[Cloud Function Error] ${name}:`, error);

    throw new Error(getErrorMessage(error));
  }
}

export async function createDashboardUser(
  payload: CreateDashboardUserPayload
): Promise<CreateDashboardUserResult> {
  return callFunction<
    CreateDashboardUserPayload,
    CreateDashboardUserResult
  >("createDashboardUser", {
    ...payload,
    email: payload.email.trim().toLowerCase(),
    displayName: payload.displayName?.trim() ?? "",
  });
}

export async function updateUserRole(
  payload: UpdateUserRolePayload
): Promise<CloudFunctionResult> {
  return callFunction<
    UpdateUserRolePayload,
    CloudFunctionResult
  >("updateUserRole", payload);
}

export async function disableDashboardUser(
  payload: UserActionPayload
): Promise<CloudFunctionResult> {
  return callFunction<
    UserActionPayload,
    CloudFunctionResult
  >("disableDashboardUser", payload);
}

export async function enableDashboardUser(
  payload: UserActionPayload
): Promise<CloudFunctionResult> {
  return callFunction<
    UserActionPayload,
    CloudFunctionResult
  >("enableDashboardUser", payload);
}

export async function deleteUserAccount(
  payload: UserActionPayload
): Promise<CloudFunctionResult> {
  return callFunction<
    UserActionPayload,
    CloudFunctionResult
  >("deleteUserAccount", payload);
}

export async function forceRefreshCurrentUserToken(): Promise<void> {
  const auth = getAuth(app);

  if (!auth.currentUser) {
    return;
  }

  await auth.currentUser.getIdToken(true);
}

