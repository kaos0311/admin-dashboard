"use client";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import {
  allocateInventoryToOrder,
  findProductByBarcode,
  restoreInventoryFromOrder,
} from "@/lib/inventory";
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

      const payload = buildSmartOrderPayload(form);

      const orderRef = await addDoc(collection(db, "orders"), {
        ...payload,
        createdBy: getCurrentUserLabel(),
        createdByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await allocateInventoryToOrder({
        productId: form.productId.trim(),
        quantity: Number(form.quantity),
        sourceId: orderRef.id,
        notes: `Order for ${form.patientName.trim()}`,
      });

      await updateDoc(orderRef, {
        inventoryAllocated: true,
        inventoryAllocationSourceId: orderRef.id,
        inventoryRestored: false,
        needsReview: payload.reviewReasons.length > 0,
        updatedAt: serverTimestamp(),
      });

      onComplete();
      await loadOrders("refresh");

      toast.success("Order created and inventory allocated.");
    } catch (error: unknown) {
      console.error("CREATE ORDER ERROR:", error);
      setCreateError(
        error instanceof Error ? error.message : "Failed to create order."
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

      await updateDoc(doc(db, "orders", editingOrderId), {
        ...payload,
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      setOrders((prev) =>
        prev.map((order) =>
          order.id === editingOrderId
            ? normalizeOrder(order.id, {
                ...order,
                ...payload,
                updatedAt: new Date(),
              })
            : order
        )
      );

      onComplete();
      toast.success("Order updated.");
    } catch (error: unknown) {
      console.error("UPDATE ORDER ERROR:", error);
      setEditError(
        error instanceof Error ? error.message : "Failed to update order."
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
          : order
      )
    );
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    const previousOrders = orders;
    const currentOrder = orders.find((order) => order.id === orderId);

    try {
      applyLocalStatusUpdate(orderId, status);

      const nextOrder = currentOrder
        ? normalizeOrder(orderId, { ...currentOrder, status })
        : null;

      await updateDoc(doc(db, "orders", orderId), {
        status,
        needsReview: nextOrder?.needsReview ?? false,
        reviewReasons: nextOrder?.reviewReasons ?? [],
        smartRouteTargets: nextOrder?.smartRouteTargets ?? [],
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      if (
        currentOrder &&
        status === "cancelled" &&
        currentOrder.productId &&
        currentOrder.inventoryAllocated === true &&
        currentOrder.inventoryRestored !== true
      ) {
        await restoreInventoryFromOrder({
          productId: currentOrder.productId,
          quantity: currentOrder.quantity,
          sourceId: orderId,
          notes: `Order cancelled for ${currentOrder.patientName}`,
        });

        await updateDoc(doc(db, "orders", orderId), {
          inventoryRestored: true,
          updatedAt: serverTimestamp(),
        });
      }

      if (tab !== "all" && tab !== status) {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success(`Order marked ${status}.`);
    } catch (error: unknown) {
      console.error("UPDATE ORDER STATUS ERROR:", error);
      setOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to update order status."
      );
    }
  }

  async function archiveOrder(orderId: string): Promise<void> {
    const previousOrders = orders;

    try {
      applyLocalStatusUpdate(orderId, "archived");

      await updateDoc(doc(db, "orders", orderId), {
        status: "archived",
        needsReview: false,
        reviewReasons: ["archived"],
        archivedAt: serverTimestamp(),
        archivedBy: getCurrentUserLabel(),
        archivedByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      if (tab !== "all" && tab !== "archived") {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success("Order archived.");
    } catch (error: unknown) {
      console.error("ARCHIVE ORDER ERROR:", error);
      setOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to archive order."
      );
    }
  }

  async function restoreOrder(orderId: string): Promise<void> {
    const previousOrders = orders;
    const currentOrder = orders.find((order) => order.id === orderId);

    try {
      applyLocalStatusUpdate(orderId, "processing");

      if (currentOrder?.productId && currentOrder.inventoryAllocated !== true) {
        await allocateInventoryToOrder({
          productId: currentOrder.productId,
          quantity: currentOrder.quantity,
          sourceId: orderId,
          notes: `Order restored for ${currentOrder.patientName}`,
        });
      }

      const nextOrder = currentOrder
        ? normalizeOrder(orderId, {
            ...currentOrder,
            status: "processing",
            inventoryAllocated: true,
            inventoryRestored: false,
          })
        : null;

      await updateDoc(doc(db, "orders", orderId), {
        status: "processing",
        inventoryAllocated: true,
        inventoryAllocationSourceId: orderId,
        inventoryRestored: false,
        needsReview: nextOrder?.needsReview ?? false,
        reviewReasons: nextOrder?.reviewReasons ?? [],
        smartRouteTargets: nextOrder?.smartRouteTargets ?? [],
        restoredAt: serverTimestamp(),
        restoredBy: getCurrentUserLabel(),
        restoredByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      if (tab !== "all" && tab !== "processing") {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success("Order restored.");
    } catch (error: unknown) {
      console.error("RESTORE ORDER ERROR:", error);
      setOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to restore order."
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