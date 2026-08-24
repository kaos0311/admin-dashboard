/**
 * AppError — shared client-side error model.
 *
 * Design per OBSERVABILITY_AUDIT.md §9. Never serialize `metadata` or
 * `originalError` to the browser; only `toClientPayload()` may cross the
 * transport boundary.
 */

export type AppErrorSource =
  | "client"
  | "server-action"
  | "api-route"
  | "callable"
  | "repository"
  | "service"
  | "firebase";

export type AppErrorCategory =
  | "AUTH"
  | "PERMISSION"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE"
  | "FIREBASE"
  | "NETWORK"
  | "INVENTORY"
  | "MOVEMENT"
  | "SCAN"
  | "USER_MANAGEMENT"
  | "SYSTEM"
  | "UNKNOWN";

export type AppErrorSeverity = "debug" | "info" | "warning" | "error" | "critical";

export type AppErrorClientPayload = {
  code: string;
  category: AppErrorCategory;
  userMessage: string;
  operation: string;
  correlationId?: string;
};

export class AppError extends Error {
  readonly code: string;
  readonly category: AppErrorCategory;
  readonly userMessage: string;
  readonly operation: string;
  readonly severity: AppErrorSeverity;
  readonly source: AppErrorSource;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
  readonly originalError?: unknown;

  constructor(input: {
    code: string;
    category: AppErrorCategory;
    userMessage: string;
    operation: string;
    severity?: AppErrorSeverity;
    source: AppErrorSource;
    correlationId?: string;
    metadata?: Record<string, unknown>;
    originalError?: unknown;
  }) {
    super(input.userMessage);
    this.name = "AppError";
    this.code = input.code;
    this.category = input.category;
    this.userMessage = input.userMessage;
    this.operation = input.operation;
    this.severity = input.severity ?? "error";
    this.source = input.source;
    this.correlationId = input.correlationId;
    this.timestamp = new Date().toISOString();
    this.metadata = input.metadata;
    this.originalError = input.originalError;
  }

  /**
   * The ONLY representation safe to send to the browser. Metadata, stacks,
   * and original errors are deliberately excluded.
   */
  toClientPayload(): AppErrorClientPayload {
    return {
      code: this.code,
      category: this.category,
      userMessage: this.userMessage,
      operation: this.operation,
      correlationId: this.correlationId,
    };
  }
}

/**
 * Unify Firebase/Https error codes into a stable AppErrorCategory.
 * Used by client boundaries when converting SDK errors.
 */
export function categorizeFirebaseCode(code: string): AppErrorCategory {
  if (code.includes("permission-denied") || code.includes("unauthenticated")) {
    return code.includes("admin") ? "USER_MANAGEMENT" : "PERMISSION";
  }
  if (code.includes("not-found")) return "NOT_FOUND";
  if (code.includes("already-exists") || code.includes("aborted")) return "CONFLICT";
  if (code.includes("invalid-argument") || code.includes("failed-precondition")) {
    return "VALIDATION";
  }
  if (code.includes("unavailable") || code.includes("deadline-exceeded")) return "NETWORK";
  if (code.includes("resource-exhausted")) return "FIREBASE";
  return "UNKNOWN";
}
