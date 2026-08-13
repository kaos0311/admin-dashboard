import type {
  ReceiveScannedInventoryIntakeRequest,
  ReceiveScannedInventoryIntakeResponse,
} from "./receive-scanned-inventory-intake.types";

export type FrozenScanIntakeRequest = Omit<
  ReceiveScannedInventoryIntakeRequest,
  "operationId"
> & {
  operationId: string;
};

export type ScanIntakeFailure = Extract<
  ReceiveScannedInventoryIntakeResponse,
  { ok: false }
>;

const RETRYABLE_SCAN_INTAKE_CODES = new Set([
  "unavailable",
  "deadline-exceeded",
  "cancelled",
  "aborted",
  "resource-exhausted",
]);

export function mapScanIntakeCallableErrorCode(
  code: string,
): string {
  const normalized = code.startsWith("functions/")
    ? code.slice("functions/".length)
    : code;

  switch (normalized) {
    case "unauthenticated":
    case "unauthorized":
      return "unauthorized";

    case "permission-denied":
      return "permission-denied";

    case "invalid-argument":
      return "invalid-argument";

    case "failed-precondition":
      return "failed-precondition";

    case "not-found":
      return "not-found";

    case "unavailable":
    case "deadline-exceeded":
    case "cancelled":
    case "aborted":
    case "resource-exhausted":
      return normalized;

    case "already-exists":
    case "duplicate":
      return "duplicate";

    case "internal":
    default:
      return "internal";
  }
}

export function isRetryableScanIntakeCode(
  code: string,
): boolean {
  return RETRYABLE_SCAN_INTAKE_CODES.has(code);
}

export function buildFrozenScanIntakeRequest(
  request: ReceiveScannedInventoryIntakeRequest,
  operationId: string,
): FrozenScanIntakeRequest {
  if (!operationId.trim()) {
    throw new Error(
      "Scan intake operation ID is required.",
    );
  }

  return {
    ...request,
    operationId,
  };
}

export async function executeScanIntakeWithRetry(params: {
  request: FrozenScanIntakeRequest;
  execute: (
    request: ReceiveScannedInventoryIntakeRequest,
  ) => Promise<ReceiveScannedInventoryIntakeResponse>;
  shouldRetry: (failure: ScanIntakeFailure) => boolean;
}): Promise<ReceiveScannedInventoryIntakeResponse> {
  if (!params.request.operationId.trim()) {
    throw new Error(
      "Scan intake operation ID is required.",
    );
  }

  const frozenRequest = params.request;

  while (true) {
    const result = await params.execute(frozenRequest);

    if (result.ok) {
      return result;
    }

    if (!isRetryableScanIntakeCode(result.code)) {
      return result;
    }

    if (!params.shouldRetry(result)) {
      return result;
    }
  }
}
