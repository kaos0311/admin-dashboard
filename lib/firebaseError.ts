type FirebaseLikeError = {
  code?: string;
  message?: string;
};

export function getFriendlyError(error: unknown, fallback?: string): string {
  const err = error as FirebaseLikeError | null;

  const code = err?.code?.toLowerCase() ?? "";
  const message = err?.message?.toLowerCase() ?? "";

  // 🔐 Permission / Auth
  if (code.includes("permission-denied") || message.includes("permission")) {
    return "You do not have permission to access this.";
  }

  if (code.includes("unauthenticated") || message.includes("auth")) {
    return "Your session expired. Please sign in again.";
  }

  // 🌐 Network / Availability
  if (code.includes("unavailable") || message.includes("unavailable")) {
    return "The server is temporarily unavailable. Please try again.";
  }

  if (
    message.includes("network") ||
    message.includes("offline") ||
    code.includes("network-request-failed")
  ) {
    return "Network problem detected. Check your connection and try again.";
  }

  if (code.includes("deadline-exceeded")) {
    return "The request took too long. Please try again.";
  }

  if (code.includes("resource-exhausted")) {
    return "Too many requests right now. Please wait a moment and try again.";
  }

  // 📦 Data issues
  if (code.includes("not-found")) {
    return "That item could not be found.";
  }

  if (code.includes("already-exists")) {
    return "That item already exists.";
  }

  if (code.includes("failed-precondition")) {
    return "This action cannot be completed right now.";
  }

  if (code.includes("invalid-argument")) {
    return "Some of the information entered is not valid.";
  }

  // 🧠 Firestore weird edge cases (you’ve seen these)
  if (code.includes("internal") || message.includes("internal")) {
    return "Unexpected system error. Please try again.";
  }

  if (message.includes("unexpected state")) {
    return "Data error detected. Please refresh and try again.";
  }

  // 🧯 Final fallback
  return fallback ?? "Something went wrong. Please try again.";
}