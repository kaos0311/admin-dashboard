import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";
import { createInventoryOperationId } from "./movements";
import { mapScanIntakeCallableErrorCode } from "./scan-intake-retry";
import type {
  ReceiveScannedInventoryIntakeRequest,
  ReceiveScannedInventoryIntakeResponse,
  ReceiveScannedInventoryIntakeResult,
} from "./receive-scanned-inventory-intake.types";

export async function receiveScannedInventoryIntake(
  request: ReceiveScannedInventoryIntakeRequest,
): Promise<ReceiveScannedInventoryIntakeResponse> {
  try {
    const operationId = request.operationId ?? createInventoryOperationId("scan-intake");
    const callable = httpsCallable<
      ReceiveScannedInventoryIntakeRequest,
      ReceiveScannedInventoryIntakeResult
    >(functions, "receiveScannedInventoryIntakeCallable");
    const result = await callable({
      ...request,
      operationId,
    });
    const data = result.data;
    if (!data || data.status !== "success") {
      return {
        ok: false,
        code: "internal",
        message: "Invalid server response shape.",
      };
    }
    return { ok: true, data };
  } catch (err: unknown) {
    let code = "internal";
    let message = "An unexpected error occurred.";

    if (err && typeof err === "object") {
      const fbErr = err as { code?: string; message?: string; details?: unknown };
      if (fbErr.code && typeof fbErr.code === "string") {
        code = mapScanIntakeCallableErrorCode(fbErr.code);
        message = fbErr.message || fbErr.code;
      }
    }

    if (err instanceof Error && code === "internal") {
      message = err.message;
    }

    return { ok: false, code, message };
  }
}
