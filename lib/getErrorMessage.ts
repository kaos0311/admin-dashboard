export function getErrorMessage(err: unknown): string {
  if (!err) {
    return "Unknown error.";
  }

  if (typeof err === "string" && err.trim()) {
    return err.trim();
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  if (typeof err === "object" && err !== null) {
    const maybeError = err as {
      code?: string;
      message?: string;
    };

    const code = maybeError.code;

    const firebaseMessages: Record<string, string> = {
      /*
      |--------------------------------------------------------------------------
      | CLOUD FUNCTIONS
      |--------------------------------------------------------------------------
      */

      "functions/internal":
        "Something went wrong. Try again.",

      "functions/permission-denied":
        "You do not have permission to perform this action.",

      "functions/unauthenticated":
        "Your session expired. Please sign in again.",

      "functions/unavailable":
        "Service temporarily unavailable. Try again shortly.",

      "functions/not-found":
        "Requested resource was not found.",

      "functions/already-exists":
        "That record already exists.",

      "functions/invalid-argument":
        "Invalid request data.",

      "functions/resource-exhausted":
        "System resource limit reached. Try again later.",

      "functions/deadline-exceeded":
        "The request took too long to complete.",

      /*
      |--------------------------------------------------------------------------
      | FIRESTORE
      |--------------------------------------------------------------------------
      */

      "permission-denied":
        "Access denied.",

      unauthenticated:
        "Please sign in again.",

      unavailable:
        "Database temporarily unavailable.",

      cancelled:
        "Operation cancelled.",

      aborted:
        "Operation aborted. Please retry.",

      "already-exists":
        "This record already exists.",

      "not-found":
        "Requested document not found.",

      "failed-precondition":
        "Operation failed due to missing requirements.",

      "invalid-argument":
        "Invalid data provided.",

      "deadline-exceeded":
        "The request timed out.",

      "resource-exhausted":
        "Too many requests or writes. Slow down and retry.",

      internal:
        "Internal system error occurred.",

      /*
      |--------------------------------------------------------------------------
      | FIREBASE AUTH
      |--------------------------------------------------------------------------
      */

      "auth/invalid-email":
        "Invalid email address.",

      "auth/user-not-found":
        "No account exists with that email.",

      "auth/wrong-password":
        "Incorrect password.",

      "auth/invalid-credential":
        "Invalid login credentials.",

      "auth/email-already-in-use":
        "That email address is already in use.",

      "auth/weak-password":
        "Password is too weak.",

      "auth/too-many-requests":
        "Too many attempts. Try again later.",

      "auth/network-request-failed":
        "Network connection error.",

      "auth/requires-recent-login":
        "Please sign in again to continue.",
    };

    if (code && firebaseMessages[code]) {
      return firebaseMessages[code];
    }

    if (
      typeof maybeError.message === "string" &&
      maybeError.message.trim()
    ) {
      return maybeError.message.trim();
    }
  }

  return "Unexpected error occurred.";
}