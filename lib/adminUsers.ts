"use client";

import {
  httpsCallable,
  type HttpsCallableResult,
} from "firebase/functions";

import {
  auth,
  functions,
} from "@/lib/firebase";

import { getErrorMessage } from "@/lib/getErrorMessage";

export type UserRole = "admin" | "staff";

type SuccessResponse = {
  success: boolean;
};

type CreateDashboardUserInput = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
};

type CreateDashboardUserResponse = SuccessResponse & {
  uid: string;
};

type UpdateUserRoleInput = {
  uid: string;
  role: UserRole;
};

type ToggleUserInput = {
  uid: string;
};

type DeleteUserResponse = SuccessResponse & {
  uid: string;
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

async function callFunction<TInput, TResult>(
  functionName: string,
  payload: TInput
): Promise<TResult> {
  try {
    const fn = httpsCallable<TInput, TResult>(
      functions,
      functionName
    );

    const result: HttpsCallableResult<TResult> =
      await fn(payload);

    return result.data;
  } catch (error: unknown) {
    console.error(
      `[Cloud Function Error] ${functionName}:`,
      error
    );

    throw new Error(getErrorMessage(error));
  }
}

/*
|--------------------------------------------------------------------------
| AUTH TOKEN
|--------------------------------------------------------------------------
*/

export async function forceRefreshCurrentUserToken(): Promise<void> {
  if (!auth.currentUser) return;

  try {
    await auth.currentUser.getIdToken(true);
  } catch (error: unknown) {
    console.error(
      "TOKEN REFRESH ERROR:",
      error
    );

    throw new Error(getErrorMessage(error));
  }
}

/*
|--------------------------------------------------------------------------
| USERS
|--------------------------------------------------------------------------
*/

export async function createDashboardUser(
  input: CreateDashboardUserInput
): Promise<CreateDashboardUserResponse> {
  return callFunction<
    CreateDashboardUserInput,
    CreateDashboardUserResponse
  >("createDashboardUser", input);
}

export async function updateUserRole(
  input: UpdateUserRoleInput
): Promise<SuccessResponse> {
  return callFunction<
    UpdateUserRoleInput,
    SuccessResponse
  >("updateUserRole", input);
}

export async function disableDashboardUser(
  input: ToggleUserInput
): Promise<SuccessResponse> {
  return callFunction<
    ToggleUserInput,
    SuccessResponse
  >("disableDashboardUser", input);
}

export async function enableDashboardUser(
  input: ToggleUserInput
): Promise<SuccessResponse> {
  return callFunction<
    ToggleUserInput,
    SuccessResponse
  >("enableDashboardUser", input);
}

export async function deleteUserAccount(
  input: ToggleUserInput
): Promise<DeleteUserResponse> {
  return callFunction<
    ToggleUserInput,
    DeleteUserResponse
  >("deleteUserAccount", input);
}