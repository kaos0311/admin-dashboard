import { FirebaseError } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app } from "@/lib/firebase";

export type UserRole = "admin" | "staff" | "tank";

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

export type ResetUserPasswordPayload = {
  uid: string;
  newPassword: string;
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

const CALLABLE_TIMEOUT_MS = 30_000;

function cleanMessage(message: string): string {
  return message
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "")
    .trim();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return cleanMessage(error.message || "Firebase request failed.");
  }

  if (error instanceof Error) {
    return cleanMessage(error.message);
  }

  return "An unexpected error occurred.";
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = CALLABLE_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `The server did not respond within ${Math.round(
            timeoutMs / 1000
          )} seconds. Please try again.`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function verifyCurrentUser(): Promise<void> {
  const auth = getAuth(app);
  const currentUser = auth.currentUser;

  console.log("[adminUsers] Current auth state", {
    uid: currentUser?.uid ?? null,
    email: currentUser?.email ?? null,
  });

  if (!currentUser) {
    throw new Error(
      "Your session is no longer active. Refresh the page and sign in again."
    );
  }

  const tokenResult = await withTimeout(
    currentUser.getIdTokenResult(true),
    15_000
  );

  console.log("[adminUsers] Current token claims", tokenResult.claims);
}

async function callFunction<TPayload, TResult>(
  functionName: string,
  payload: TPayload
): Promise<TResult> {
  console.log(`[adminUsers] Preparing ${functionName}`, payload);

  try {
    await verifyCurrentUser();

    const callable = httpsCallable<TPayload, TResult>(
      functions,
      functionName
    );

    console.log(`[adminUsers] Calling ${functionName}`);

    const response = await withTimeout(callable(payload));

    console.log(`[adminUsers] ${functionName} succeeded`, response.data);

    return response.data;
  } catch (error) {
    console.error(`[adminUsers] ${functionName} failed`, error);

    if (error instanceof FirebaseError) {
      console.error(`[adminUsers] ${functionName} Firebase details`, {
        code: error.code,
        message: error.message,
        customData: error.customData,
        stack: error.stack,
      });
    }

    throw new Error(getErrorMessage(error));
  }
}

export async function createDashboardUser(
  payload: CreateDashboardUserPayload
): Promise<CreateDashboardUserResult> {
  return callFunction<
    CreateDashboardUserPayload,
    CreateDashboardUserResult
  >("createDashboardUser", payload);
}

export async function updateUserRole(
  payload: UpdateUserRolePayload
): Promise<CloudFunctionResult> {
  return callFunction<UpdateUserRolePayload, CloudFunctionResult>(
    "updateUserRole",
    payload
  );
}

export async function enableDashboardUser(
  payload: UserActionPayload
): Promise<CloudFunctionResult> {
  return callFunction<UserActionPayload, CloudFunctionResult>(
    "enableDashboardUser",
    payload
  );
}

export async function disableDashboardUser(
  payload: UserActionPayload
): Promise<CloudFunctionResult> {
  return callFunction<UserActionPayload, CloudFunctionResult>(
    "disableDashboardUser",
    payload
  );
}

export async function deleteUserAccount(
  payload: UserActionPayload
): Promise<CloudFunctionResult> {
  return callFunction<UserActionPayload, CloudFunctionResult>(
    "deleteUserAccount",
    payload
  );
}

export async function resetUserPassword(
  payload: ResetUserPasswordPayload
): Promise<CloudFunctionResult> {
  return callFunction<
    ResetUserPasswordPayload,
    CloudFunctionResult
  >("resetUserPassword", payload);
}