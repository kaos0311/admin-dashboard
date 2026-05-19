"use client";

import type { FormEvent } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import toast from "react-hot-toast";

import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";
import { smartMergeInventory } from "@/lib/inventory/smartMergeInventory";

import { FIRESTORE_BATCH_LIMIT } from "../lib/inventoryConstants";
import { isLowStock } from "../lib/inventoryAlerts";
import { buildSearchText, chunkArray, toSafeNumber } from "../lib/inventoryNormalize";
import { logInventoryMovement } from "../lib/inventoryMovements";
import type { InventoryForm, InventoryItem } from "../lib/inventoryTypes";

type UseInventoryActionsArgs = {
  form: InventoryForm;
  canWrite: boolean;
  isAdmin: boolean;
  selectedIds: string[];

  resetForm: () => void;
  removeSelectedId: (id: string) => void;
  clearSelected: () => void;
  setSaving: (value: boolean) => void;
};

export function useInventoryActions({
  form,
  canWrite,
  isAdmin,
  selectedIds,
  resetForm,
  removeSelectedId,
  clearSelected,
  setSaving,
}: UseInventoryActionsArgs) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canWrite) {
      toast.error("You do not have permission to save inventory.");
      return;
    }

    const quantityOnHand = toSafeNumber(form.quantityOnHand);
    const committed = toSafeNumber(form.committed);
    const onRent = toSafeNumber(form.onRent);
    const onOrder = toSafeNumber(form.onOrder);
    const reorderLevel = toSafeNumber(form.reorderLevel);
    const unitCost = toSafeNumber(form.unitCost);
    const usefulLifeMonths = toSafeNumber(form.usefulLifeMonths);

    const available = quantityOnHand - committed - onRent;
    const totalValue = quantityOnHand * unitCost;

    if (!form.name.trim()) {
      toast.error("Item name is required.");
      return;
    }

    if (!form.category.trim()) {
      toast.error("Category is required.");
      return;
    }

    if (
      quantityOnHand < 0 ||
      committed < 0 ||
      onRent < 0 ||
      onOrder < 0 ||
      reorderLevel < 0 ||
      unitCost < 0 ||
      usefulLifeMonths < 0
    ) {
      toast.error("Numbers cannot be negative.");
      return;
    }

    if (available < 0) {
      toast.error(
        "Available stock cannot be negative. Check committed and rental counts."
      );
      return;
    }

    const normalizedBarcode = form.barcode.trim()
      ? normalizeBarcode(form.barcode)
      : "";

    const payload: Omit<InventoryItem, "id" | "searchText" | "isDeleted"> = {
      productId: form.productId.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      sku: form.sku.trim(),
      barcode: normalizedBarcode,
      serial: form.serial.trim(),
      lotNumber: form.lotNumber.trim(),
      locationName: form.locationName.trim() || "Main Location",
      binLocation: form.binLocation.trim(),
      quantityOnHand,
      committed,
      onRent,
      onOrder,
      available,
      reorderLevel,
      unitCost,
      totalValue,
      status: form.status,
      manufacturer: form.manufacturer.trim(),
      manufacturerItemId: form.manufacturerItemId.trim(),
      modelNumber: form.modelNumber.trim(),
      warrantyProvider: form.warrantyProvider.trim(),
      warrantyStartDate: form.warrantyStartDate,
      warrantyEndDate: form.warrantyEndDate,
      warrantyNotes: form.warrantyNotes.trim(),
      purchaseDate: form.purchaseDate,
      usefulLifeMonths,
      lifecycleStatus: form.lifecycleStatus,
      nextServiceDate: form.nextServiceDate,
      lifecycleNotes: form.lifecycleNotes.trim(),
      notes: form.notes.trim(),
    };

    const searchText = buildSearchText(payload);

    setSaving(true);

    try {
      if (form.id) {
        await updateDoc(doc(db, "inventory", form.id), {
          ...payload,
          searchText,
          isDeleted: false,
          lowStock: isLowStock({
            id: form.id,
            ...payload,
            searchText,
            isDeleted: false,
          }),
          updatedAt: serverTimestamp(),
        });

        await logInventoryMovement({
          productId: payload.productId,
          productName: payload.name,
          barcode: payload.barcode,
          serial: payload.serial,
          lotNumber: payload.lotNumber,
          type: "inventory_update",
          quantity: payload.quantityOnHand,
          sourceId: form.id,
          notes: "Inventory record updated.",
        });

        toast.success("Inventory updated.");
      } else {
        const result = await smartMergeInventory({
          productId: payload.productId,
          name: payload.name,
          category: payload.category,
          manufacturer: payload.manufacturer,
          manufacturerItemId: payload.manufacturerItemId,
          sku: payload.sku,
          barcode: payload.barcode,
          serial: payload.serial,
          lotNumber: payload.lotNumber,
          expirationDate: "",
          locationName: payload.locationName,
          binLocation: payload.binLocation,
          quantityOnHand: payload.quantityOnHand,
          committed: payload.committed,
          onRent: payload.onRent,
          onOrder: payload.onOrder,
          reorderLevel: payload.reorderLevel,
          unitCost: payload.unitCost,
          status:
            payload.status === "discontinued" ? "inactive" : payload.status,
          notes: payload.notes,
          source: "inventory",
          sourceId: "manual_entry",
        });

        await updateDoc(doc(db, "inventory", result.inventoryId), {
          ...payload,
          searchText,
          isDeleted: false,
          lowStock: isLowStock({
            id: result.inventoryId,
            ...payload,
            searchText,
            isDeleted: false,
          }),
          updatedAt: serverTimestamp(),
        });

        await logInventoryMovement({
          productId: payload.productId,
          productName: payload.name,
          barcode: payload.barcode,
          serial: payload.serial,
          lotNumber: payload.lotNumber,
          type:
            result.action === "created"
              ? "inventory_created"
              : "inventory_merged",
          quantity: payload.quantityOnHand,
          sourceId: result.inventoryId,
          notes:
            result.action === "created"
              ? "Inventory record created."
              : "Inventory merged with existing stock.",
        });

        toast.success(
          result.action === "created"
            ? "Inventory added."
            : "Inventory merged with existing stock."
        );
      }

      resetForm();
    } catch (error: unknown) {
      console.error("SAVE INVENTORY ERROR:", error);
      toast.error("Inventory could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSoftDelete(item: InventoryItem) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (
      !window.confirm(
        `Archive "${item.name}"? This keeps history but removes it from active inventory.`
      )
    ) {
      return;
    }

    try {
      await updateDoc(doc(db, "inventory", item.id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logInventoryMovement({
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        serial: item.serial,
        lotNumber: item.lotNumber,
        type: "inventory_soft_delete",
        quantity: item.quantityOnHand,
        sourceId: item.id,
        notes: "Inventory record archived.",
      });

      removeSelectedId(item.id);
      toast.success("Inventory archived.");
    } catch (error: unknown) {
      console.error("ARCHIVE INVENTORY ERROR:", error);
      toast.error("Archive failed.");
    }
  }

  async function handleHardDelete(item: InventoryItem) {
    if (!isAdmin) {
      toast.error("Only admins can permanently delete inventory.");
      return;
    }

    if (
      !window.confirm(
        `Permanently delete "${item.name}"? This is not reversible.`
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "inventory", item.id));

      await logInventoryMovement({
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        serial: item.serial,
        lotNumber: item.lotNumber,
        type: "inventory_hard_delete",
        quantity: item.quantityOnHand,
        sourceId: item.id,
        notes: "Inventory record permanently deleted.",
      });

      removeSelectedId(item.id);
      toast.success("Inventory permanently deleted.");
    } catch (error: unknown) {
      console.error("HARD DELETE INVENTORY ERROR:", error);
      toast.error("Permanent delete failed.");
    }
  }

  async function handleDiscontinue(item: InventoryItem) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    try {
      await updateDoc(doc(db, "inventory", item.id), {
        status: "discontinued",
        lifecycleStatus: "retired",
        updatedAt: serverTimestamp(),
      });

      await logInventoryMovement({
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        serial: item.serial,
        lotNumber: item.lotNumber,
        type: "inventory_discontinued",
        quantity: item.quantityOnHand,
        sourceId: item.id,
        notes: "Inventory item discontinued.",
      });

      toast.success("Item discontinued.");
    } catch (error: unknown) {
      console.error("DISCONTINUE INVENTORY ERROR:", error);
      toast.error("Could not discontinue item.");
    }
  }

  async function handleBatchArchive() {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (!selectedIds.length) {
      toast.error("Select items first.");
      return;
    }

    if (!window.confirm(`Archive ${selectedIds.length} selected item(s)?`)) {
      return;
    }

    try {
      const chunks = chunkArray(selectedIds, FIRESTORE_BATCH_LIMIT);

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach((id) => {
          batch.update(doc(db, "inventory", id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      await logInventoryMovement({
        productId: "",
        productName: "Batch inventory archive",
        barcode: "",
        serial: "",
        lotNumber: "",
        type: "inventory_batch_archive",
        quantity: selectedIds.length,
        sourceId: "batch",
        affectedIds: selectedIds,
        notes: `${selectedIds.length} inventory records archived.`,
      });

      clearSelected();
      toast.success("Selected items archived.");
    } catch (error: unknown) {
      console.error("BATCH ARCHIVE INVENTORY ERROR:", error);
      toast.error("Batch archive failed.");
    }
  }

  async function handleBatchDiscontinue() {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (!selectedIds.length) {
      toast.error("Select items first.");
      return;
    }

    try {
      const chunks = chunkArray(selectedIds, FIRESTORE_BATCH_LIMIT);

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach((id) => {
          batch.update(doc(db, "inventory", id), {
            status: "discontinued",
            lifecycleStatus: "retired",
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      await logInventoryMovement({
        productId: "",
        productName: "Batch inventory discontinue",
        barcode: "",
        serial: "",
        lotNumber: "",
        type: "inventory_batch_discontinue",
        quantity: selectedIds.length,
        sourceId: "batch",
        affectedIds: selectedIds,
        notes: `${selectedIds.length} inventory records discontinued.`,
      });

      clearSelected();
      toast.success("Selected items discontinued.");
    } catch (error: unknown) {
      console.error("BATCH DISCONTINUE INVENTORY ERROR:", error);
      toast.error("Batch discontinue failed.");
    }
  }

  return {
    handleSubmit,
    handleSoftDelete,
    handleHardDelete,
    handleDiscontinue,
    handleBatchArchive,
    handleBatchDiscontinue,
  };
}