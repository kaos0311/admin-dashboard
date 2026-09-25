/**
 * AppError — shared server-side error model.
 *
 * Design per OBSERVABILITY_AUDIT.md §9. Server-side variant keeps the same
 * shape as the client module and adds `toHttpsError()` mapping for callable
 * boundaries. `originalError` lives here only (server-side) and is NEVER
 * serialized to the client.
 */

import { HttpsError } from "firebase-functions/v2/https";

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

export type HttpsErrorCode =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss"
  | "unauthenticated";

const CATEGORY_TO_HTTPS_CODE: Record<AppErrorCategory, HttpsErrorCode> = {
  AUTH: "unauthenticated",
  PERMISSION: "permission-denied",
  USER_MANAGEMENT: "permission-denied",
  VALIDATION: "invalid-argument",
  NOT_FOUND: "not-found",
  CONFLICT: "already-exists",
  DATABASE: "internal",
  FIREBASE: "internal",
  NETWORK: "unavailable",
  INVENTORY: "failed-precondition",
  MOVEMENT: "failed-precondition",
  SCAN: "internal",
  SYSTEM: "internal",
  UNKNOWN: "unknown",
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

  toClientPayload(): AppErrorClientPayload {
    return {
      code: this.code,
      category: this.category,
      userMessage: this.userMessage,
      operation: this.operation,
      correlationId: this.correlationId,
    };
  }

  toHttpsError(): HttpsError {
    return new HttpsError(
      CATEGORY_TO_HTTPS_CODE[this.category],
      this.userMessage,
      this.toClientPayload(),
    );
  }
}

export function categorizeHttpsCode(code: string): AppErrorCategory {
  if (code.includes("permission-denied")) return "PERMISSION";
  if (code.includes("unauthenticated")) return "AUTH";
  if (code.includes("not-found")) return "NOT_FOUND";
  if (code.includes("already-exists")) return "CONFLICT";
  if (code.includes("invalid-argument") || code.includes("failed-precondition")) {
    return "VALIDATION";
  }
  if (code.includes("unavailable") || code.includes("deadline-exceeded")) return "NETWORK";
  if (code.includes("resource-exhausted")) return "FIREBASE";
  return "UNKNOWN";
}
