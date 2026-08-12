export function isRetryableFirestoreError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === 4 ||
    code === 8 ||
    code === 10 ||
    code === 13 ||
    code === 14 ||
    code === "deadline-exceeded" ||
    code === "resource-exhausted" ||
    code === "aborted" ||
    code === "internal" ||
    code === "unavailable" ||
    message.includes("deadline") ||
    message.includes("aborted") ||
    message.includes("unavailable") ||
    message.includes("rate") ||
    message.includes("quota")
  );
}

function getErrorCode(error: unknown): string | number | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return (error as { code?: string | number }).code;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}
