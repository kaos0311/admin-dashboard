"use client";

import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import { OrderRepository } from "@/repositories/firestore/order.repository";
import { findProductByBarcode } from "@/lib/inventory";
import { createOrder as createOrderWorkflow, cancelOrder as cancelOrderWorkflow, restoreOrder as restoreOrderWorkflow, createOrderOperationId } from "@/lib/orders/orderWorkflows";
import { normalizeBarcode } from "@/lib/barcode";

import { initialFormState } from "../lib/orderConstants";
import { normalizeOrder } from "../lib/orderNormalize";
import {
  buildSmartOrderPayload,
  validateOrderForm,
} from "../lib/orderValidation";
import type { OrderFormState, OrderRow, OrderStatus } from "../lib/orderTypes";

function getCurrentUserLabel(): string {
  return (
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    auth.currentUser?.uid ||
    "Unknown user"
  );
}

import React from "react";

export function useOrderMutations({
  orders,
  setOrders,
  tab,
  loadOrders,
}: {
  orders: OrderRow[];
  setOrders: React.Dispatch<React.SetStateAction<OrderRow[]>>;
  tab: OrderStatus | "all";
  loadOrders: (mode?: "initial" | "refresh" | "more") => Promise<void>;
}) {
  const createOperationIdRef = React.useRef<string | null>(null);
  async function fillProductFromBarcode(
    barcode: string,
    mode: "create" | "edit",
    setCreateForm: React.Dispatch<React.SetStateAction<OrderFormState>>,
    setEditForm: React.Dispatch<React.SetStateAction<OrderFormState>>
  ): Promise<void> {
    const clean = normalizeBarcode(barcode);

    if (!clean) {
      toast.error("Barcode is required.");
      return;
    }

    const product = await findProductByBarcode(clean);

    if (!product) {
      toast.error("No inventory item found for that barcode.");
      return;
    }

    const apply = (prev: OrderFormState): OrderFormState => ({
      ...prev,
      productId: product.id,
      productType: product.name,
      purchaseCost: String(product.price ?? 0),
      barcode: product.barcode ?? clean,
    });

    if (mode === "create") setCreateForm(apply);
    else setEditForm(apply);

    toast.success(`Loaded inventory item: ${product.name}`);
  }

  async function createOrder({
    form,
    setCreating,
    setCreateError,
    onComplete,
  }: {
    form: OrderFormState;
    setCreating: (value: boolean) => void;
    setCreateError: (value: string) => void;
    onComplete: () => void;
  }): Promise<void> {
    const validationError = validateOrderForm(form);

    if (validationError) {
      setCreateError(validationError);
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const operationId =
        createOperationIdRef.current ?? createOrderOperationId();
      createOperationIdRef.current = operationId;

      const payload = buildSmartOrderPayload(form);

      const orderResult = await createOrderWorkflow({
        operationId,
        productId: form.productId.trim(),
        quantity: Number(form.quantity),
        patientName: form.patientName.trim(),
        patientAddress: form.patientAddress.trim(),
        productType: form.productType.trim(),
        purchaseCost: Number(form.purchaseCost),
        barcode: form.barcode.trim(),
        phone: form.phone.trim(),
        facilityName: form.facilityName.trim(),
        notes: form.notes.trim(),
      });

      if (orderResult.status === "success") {
        createOperationIdRef.current = null;

        const orderId = orderResult.orderId;
        if (!orderId) {
          throw new Error("Order created but no order ID returned.");
        }

        const newOrder = normalizeOrder(orderId, {
          ...payload,
          status: orderResult.orderStatus ?? "processing",
          inventoryAllocated: orderResult.inventoryAllocated ?? true,
          inventoryRestored: orderResult.inventoryRestored ?? false,
          inventoryAllocations: orderResult.allocations ?? [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        setOrders((prev) => [...prev, newOrder]);

        onComplete();
        await loadOrders("refresh");

        toast.success("Order created and inventory allocated.");
      } else if (orderResult.status === "duplicate_operation") {
        createOperationIdRef.current = null;
        toast.success("Order already created.");
        onComplete();
        await loadOrders("refresh");
      } else {
        createOperationIdRef.current = null;
        throw new Error(orderResult.message || "Failed to create order.");
      }
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("already used with different")
      ) {
        createOperationIdRef.current = null;
      }
      console.error("CREATE ORDER ERROR:", error);
      setCreateError(
        error instanceof Error ? error.message : "Failed to create order.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveEditOrder({
    editingOrderId,
    editForm,
    setEditing,
    setEditError,
    onComplete,
  }: {
    editingOrderId: string | null;
    editForm: OrderFormState;
    setEditing: (value: boolean) => void;
    setEditError: (value: string) => void;
    onComplete: () => void;
  }): Promise<void> {
    if (!editingOrderId) {
      setEditError("No order selected.");
      return;
    }

    const validationError = validateOrderForm(editForm);

    if (validationError) {
      setEditError(validationError);
      return;
    }

    try {
      setEditing(true);
      setEditError("");

      const payload = buildSmartOrderPayload(editForm);

      const currentOrder = orders.find((order) => order.id === editingOrderId);

      await OrderRepository.update(editingOrderId, {
        ...payload,
        inventoryAllocated: currentOrder?.inventoryAllocated ?? false,
        inventoryRestored: currentOrder?.inventoryRestored ?? false,
        inventoryAllocationSourceId: currentOrder?.inventoryAllocationSourceId ?? "",
        status: currentOrder?.status ?? payload.status,
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
      });

      setOrders((prev) =>
        prev.map((order) =>
          order.id === editingOrderId
            ? normalizeOrder(order.id, {
                ...order,
                ...payload,
                inventoryAllocated: order.inventoryAllocated,
                inventoryRestored: order.inventoryRestored,
                inventoryAllocationSourceId: order.inventoryAllocationSourceId,
                status: order.status,
                updatedAt: new Date(),
              })
            : order,
        ),
      );

      onComplete();
      toast.success("Order updated.");
    } catch (error: unknown) {
      console.error("UPDATE ORDER ERROR:", error);
      setEditError(
        error instanceof Error ? error.message : "Failed to update order.",
      );
    } finally {
      setEditing(false);
    }
  }

  function applyLocalStatusUpdate(orderId: string, status: OrderStatus) {
    const now = new Date();

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? normalizeOrder(order.id, {
              ...order,
              status,
              updatedAt: now,
            })
          : order,
      ),
    );
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    const previousOrders = orders;
    const currentOrder = orders.find((order) => order.id === orderId);

    try {
      if (
        status === "cancelled" &&
        currentOrder?.productId &&
        currentOrder.inventoryAllocated === true &&
        currentOrder.inventoryRestored !== true
      ) {
        const cancelResult = await cancelOrderWorkflow({
          operationId: `cancel-${orderId}`,
          orderId,
          productId: currentOrder.productId,
          quantity: currentOrder.quantity,
          patientName: currentOrder.patientName,
        });

        if (cancelResult.status !== "success" && cancelResult.status !== "duplicate_operation") {
          throw new Error(cancelResult.message || "Failed to cancel order inventory.");
        }
      }

      applyLocalStatusUpdate(orderId, status);

      const nextOrder = currentOrder
        ? normalizeOrder(orderId, { ...currentOrder, status })
        : null;

      await OrderRepository.update(orderId, {
        status,
        needsReview: nextOrder?.needsReview ?? false,
        reviewReasons: nextOrder?.reviewReasons ?? [],
        smartRouteTargets: nextOrder?.smartRouteTargets ?? [],
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
      });

      if (tab !== "all" && tab !== status) {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success(`Order marked ${status}.`);
    } catch (error: unknown) {
      console.error("UPDATE ORDER STATUS ERROR:", error);
      setOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to update order status.",
      );
    }
  }

  async function archiveOrder(orderId: string): Promise<void> {
    const previousOrders = orders;

    try {
      applyLocalStatusUpdate(orderId, "archived");

      await OrderRepository.update(orderId, {
        status: "archived",
        needsReview: false,
        reviewReasons: ["archived"],
        archivedAt: new Date(),
        archivedBy: getCurrentUserLabel(),
        archivedByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
      });

      if (tab !== "all" && tab !== "archived") {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success("Order archived.");
    } catch (error: unknown) {
      console.error("ARCHIVE ORDER ERROR:", error);
      setOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to archive order.",
      );
    }
  }

  async function restoreOrder(orderId: string): Promise<void> {
    const previousOrders = orders;
    const currentOrder = orders.find((order) => order.id === orderId);

    try {
      applyLocalStatusUpdate(orderId, "processing");

      const restoreResult = await restoreOrderWorkflow({
        operationId: `restore-${orderId}`,
        orderId,
        productId: currentOrder?.productId ?? "",
        quantity: currentOrder?.quantity ?? 1,
        patientName: currentOrder?.patientName,
      });

      if (restoreResult.status !== "success" && restoreResult.status !== "duplicate_operation") {
        throw new Error(restoreResult.message || "Failed to restore order.");
      }

      const nextOrder = currentOrder
        ? normalizeOrder(orderId, {
            ...currentOrder,
            status: "processing",
            inventoryAllocated: true,
            inventoryRestored: false,
          })
        : null;

      await OrderRepository.update(orderId, {
        status: "processing",
        inventoryAllocated: true,
        inventoryAllocationSourceId: orderId,
        inventoryRestored: false,
        needsReview: nextOrder?.needsReview ?? false,
        reviewReasons: nextOrder?.reviewReasons ?? [],
        smartRouteTargets: nextOrder?.smartRouteTargets ?? [],
        restoredAt: new Date(),
        restoredBy: getCurrentUserLabel(),
        restoredByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
      });

      if (tab !== "all" && tab !== "processing") {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success("Order restored.");
    } catch (error: unknown) {
      console.error("RESTORE ORDER ERROR:", error);
      setOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to restore order.",
      );
    }
  }

  return {
    initialFormState,
    fillProductFromBarcode,
    createOrder,
    saveEditOrder,
    updateStatus,
    archiveOrder,
    restoreOrder,
  };
}