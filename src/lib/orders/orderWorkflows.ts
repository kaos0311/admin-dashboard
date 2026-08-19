import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";

export type OrderWorkflowAction = "create" | "cancel" | "restore";

export type OrderWorkflowRequest = {
  operationId: string;
  action: OrderWorkflowAction;
  orderId?: string;
  productId: string;
  quantity: number;
  patientName?: string;
  patientAddress?: string;
  productType?: string;
  purchaseCost?: number;
  barcode?: string;
  phone?: string;
  facilityName?: string;
  notes?: string;
};

export type OrderWorkflowResult =
  | {
      status: "success";
      operationId: string;
      workflowType: string;
      movementIds?: string[];
      orderId?: string;
      orderStatus?: string;
      inventoryAllocated?: boolean;
      inventoryRestored?: boolean;
      allocations?: Array<{ inventoryItemId: string; quantity: number; movementId?: string }>;
      restoredQuantity?: number;
      metadata?: Record<string, unknown>;
    }
  | {
      status: "duplicate_operation";
      operationId: string;
      workflowType: string;
      message?: string;
      movementIds?: string[];
      orderId?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      status: "not_found";
      operationId: string;
      workflowType: string;
      message?: string;
    }
  | {
      status: "invalid";
      operationId: string;
      workflowType: string;
      message?: string;
    }
  | {
      status: "permission_denied";
      operationId: string;
      workflowType: string;
      message?: string;
    };

function generateOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createOrderOperationId(): string {
  return generateOperationId();
}

export async function submitOrderWorkflow(
  request: Omit<OrderWorkflowRequest, "operationId"> & {
    operationId?: string;
  }
): Promise<OrderWorkflowResult> {
  const callable = httpsCallable<
    OrderWorkflowRequest,
    OrderWorkflowResult
  >(functions, "orderWorkflowCallable");

  const operationId = request.operationId ?? createOrderOperationId();
  const result = await callable({
    ...request,
    operationId,
  });

  return result.data;
}

export async function createOrder(
  params: Omit<OrderWorkflowRequest, "action" | "operationId"> & {
    operationId?: string;
  }
): Promise<OrderWorkflowResult> {
  return submitOrderWorkflow({
    ...params,
    action: "create",
    operationId: params.operationId,
  });
}

export async function cancelOrder(
  params: Omit<OrderWorkflowRequest, "action"> & {
    operationId?: string;
  }
): Promise<OrderWorkflowResult> {
  return submitOrderWorkflow({
    ...params,
    action: "cancel",
    operationId: params.operationId,
  });
}

export async function restoreOrder(
  params: Omit<OrderWorkflowRequest, "action"> & {
    operationId?: string;
  }
): Promise<OrderWorkflowResult> {
  return submitOrderWorkflow({
    ...params,
    action: "restore",
    operationId: params.operationId,
  });
}
