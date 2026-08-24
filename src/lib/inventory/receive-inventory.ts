/**
 * Client API module for receiveInventoryByBarcode.
 *
 * This module provides a typed wrapper around the Firebase Functions callable
 * that handles:
 * - operationId lifecycle (generate once, reuse for retries, clear on definitive response)
 * - Discriminated response handling (success / not_found / duplicate)
 * - Callable error handling (unauthenticated, permission-denied, invalid-argument, etc.)
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type {
  ReceiveInventoryRequest,
  ReceiveInventoryResult,
  ReceiveInventoryResponse,
} from "@/lib/inventory/receive-inventory.types";

/**
 * Generate a UUID v4 using crypto.randomUUID() with fallback.
 */
function generateOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Map a Firebase Functions error code to a user-facing message.
 */
function mapCallableError(code: string): string {
  switch (code) {
    case "functions/unauthenticated":
      return "unauthorized";
    case "functions/permission-denied":
      return "permission-denied";
    case "functions/invalid-argument":
      return "invalid-argument";
    case "functions/failed-precondition":
      return "failed-precondition";
    case "functions/unavailable":
      return "unavailable";
    case "functions/internal":
      return "internal";
    case "functions/already-exists":
      return "duplicate";
    default:
      return "internal";
  }
}

/**
 * Typed wrapper around the receiveInventoryByBarcode callable.
 *
 * Separates callable-level transport errors from business-logic responses.
 *
 * Returns a ReceiveInventoryResponse:
 * - ok === true:  the callable completed; inspect `data.status` (success / not_found / duplicate)
 * - ok === false: the callable itself failed; use `code` and `message` for error display
 */
export async function receiveInventoryByBarcode(
  request: ReceiveInventoryRequest,
): Promise<ReceiveInventoryResponse> {
  try {
    const callable = httpsCallable<
      ReceiveInventoryRequest,
      ReceiveInventoryResult
    >(functions, "receiveInventoryByBarcode");
    const result = await callable(request);
    const data = result.data;

    // Validate that response is a proper discriminated union
    if (!data || typeof data.status !== "string") {
      return {
        ok: false,
        code: "internal",
        message: "Invalid server response shape.",
      };
    }

    return { ok: true, data };
  } catch (err: unknown) {
    // Extract the Firebase Functions error code
    let code = "internal";
    let message = "An unexpected error occurred.";

    if (err && typeof err === "object") {
      const fbErr = err as { code?: string; message?: string; details?: unknown };
      if (fbErr.code && typeof fbErr.code === "string") {
        code = mapCallableError(fbErr.code);
        message = fbErr.message || fbErr.code;
      }
    }

    if (err instanceof Error && code === "internal") {
      message = err.message;
    }

    return { ok: false, code, message };
  }
}

// ──────────────────────────────────────────────
// operationId lifecycle manager
// ──────────────────────────────────────────────

/**
 * Manages the lifecycle of an operationId for idempotent submissions.
 *
 * - Generates a new operationId when `start()` is called (user confirms operation).
 * - Returns the same operationId on `get()` without generating a new one,
 *   so automatic retries share the same id.
 * - Clears the operationId when `complete()` is called (definitive response received).
 * - Clears the operationId when `reset()` is called (user cancels or starts a new flow).
 */
export class OperationIdManager {
  private currentId: string | null = null;

  /**
   * Start a new operation. Generates a fresh UUID.
   * Call this when the user confirms an operation.
   */
  start(): string {
    this.currentId = generateOperationId();
    return this.currentId;
  }

  /**
   * Get the current operationId without generating a new one.
   * Returns null if no operation has been started.
   */
  get(): string | null {
    return this.currentId;
  }

  /**
   * Mark the current operation as complete.
   * Call this after a definitive response (success, not_found, duplicate, or terminal error).
   * Resets the operationId so the next confirmation generates a fresh one.
   */
  complete(): void {
    this.currentId = null;
  }

  /**
   * Reset the operationId. Call this when the user cancels or scans a new barcode.
   */
  reset(): void {
    this.currentId = null;
  }
}
