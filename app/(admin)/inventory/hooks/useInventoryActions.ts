"use client";

import type { FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";
import { smartMergeInventory } from "@/lib/inventory/smartMergeInventory";

import { FIRESTORE_BATCH_LIMIT } from "../lib/inventoryConstants";
import { isLowStock } from "../lib/inventoryAlerts";
import { buildSearchText, chunkArray, toSafeNumber } from "../lib/inventoryNormalize";
import { logInventoryMovement } from "../lib/inventoryMovements";
import { ensureProductFromInventory } from "../lib/inventoryProductSync";
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
  async function findInventoryByScan(rawCode: string): Promise<InventoryItem | null> {
    const clean = normalizeBarcode(rawCode);
    const upper = clean.toUpperCase();
    const fields: Array<[keyof InventoryItem, string]> = [
      ["barcode", clean],
      ["serial", clean],
      ["lotNumber", clean],
      ["sku", clean],
      ["hcpc", upper],
    ];

    for (const [field, value] of fields) {
      if (!value) continue;

      const snap = await getDocs(
        query(collection(db, "inventory"), where(field, "==", value), limit(5))
      );
      const match = snap.docs.find((item) => item.data().isDeleted !== true);

      if (match) {
        const data = match.data() as Record<string, unknown>;
        return {
          id: match.id,
          productId: String(data.productId ?? ""),
          name: String(data.name ?? ""),
          category: String(data.category ?? ""),
          sku: String(data.sku ?? ""),
          hcpc: String(data.hcpc ?? data.hcpcs ?? ""),
          barcode: String(data.barcode ?? ""),
          serial: String(data.serial ?? ""),
          lotNumber: String(data.lotNumber ?? ""),
          locationName: String(data.locationName ?? "Main Location"),
          binLocation: String(data.binLocation ?? ""),
          quantityOnHand: Number(data.quantityOnHand ?? 0),
          committed: Number(data.committed ?? 0),
          onRent: Number(data.onRent ?? 0),
          onOrder: Number(data.onOrder ?? 0),
          available: Number(data.available ?? 0),
          reorderLevel: Number(data.reorderLevel ?? 0),
          unitCost: Number(data.unitCost ?? 0),
          totalValue: Number(data.totalValue ?? 0),
          status: data.status === "inactive" ||
            data.status === "damaged" ||
            data.status === "lost" ||
            data.status === "discontinued"
            ? data.status
            : "available",
          manufacturer: String(data.manufacturer ?? ""),
          manufacturerItemId: String(data.manufacturerItemId ?? ""),
          modelNumber: String(data.modelNumber ?? ""),
          warrantyProvider: String(data.warrantyProvider ?? ""),
          warrantyStartDate: String(data.warrantyStartDate ?? ""),
          warrantyEndDate: String(data.warrantyEndDate ?? ""),
          warrantyNotes: String(data.warrantyNotes ?? ""),
          purchaseDate: String(data.purchaseDate ?? ""),
          usefulLifeMonths: Number(data.usefulLifeMonths ?? 0),
          lifecycleStatus: data.lifecycleStatus === "new" ||
            data.lifecycleStatus === "needs_service" ||
            data.lifecycleStatus === "end_of_life" ||
            data.lifecycleStatus === "retired"
            ? data.lifecycleStatus
            : "active",
          nextServiceDate: String(data.nextServiceDate ?? ""),
          lifecycleNotes: String(data.lifecycleNotes ?? ""),
          notes: String(data.notes ?? ""),
          searchText: String(data.searchText ?? ""),
          isDeleted: data.isDeleted === true,
        };
      }
    }

    return null;
  }

  async function handleScanMovement(rawCode: string, direction: "in" | "out") {
    if (!canWrite) {
      toast.error("You do not have permission to move inventory.");
      return;
    }

    const item = await findInventoryByScan(rawCode);

    if (!item) {
      toast.error("No inventory match found for that scan.");
      return;
    }

    if (direction === "out" && item.available <= 0) {
      toast.error("That item has no available stock to scan out.");
      return;
    }

    const quantityOnHand =
      direction === "in" ? item.quantityOnHand + 1 : item.quantityOnHand - 1;
    const available =
      direction === "in" ? item.available + 1 : item.available - 1;

    await updateDoc(doc(db, "inventory", item.id), {
      quantityOnHand,
      available,
      updatedAt: serverTimestamp(),
      lastScannedAt: serverTimestamp(),
      lastScanDirection: direction,
    });

    await logInventoryMovement({
      productId: item.productId,
      productName: item.name,
      barcode: item.barcode,
      serial: item.serial,
      lotNumber: item.lotNumber,
      type: direction === "in" ? "scan_in" : "scan_out",
      quantity: 1,
      sourceId: item.id,
      notes: `${direction === "in" ? "Scanned in" : "Scanned out"} by barcode/manual lookup.`,
    });

    if (direction === "in") {
      void ensureProductFromInventory({
        ...item,
        quantityOnHand,
        available,
      }).catch((error) => {
        console.error("INVENTORY PRODUCT SYNC ERROR:", error);
        toast.error("Inventory moved, but product catalog sync needs review.");
      });
    }

    toast.success(`${item.name} scanned ${direction}.`);
  }

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
      hcpc: form.hcpc.trim().toUpperCase(),
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
        const syncedProductId = await ensureProductFromInventory({
          id: form.id,
          ...payload,
          searchText,
          isDeleted: false,
        });

        await updateDoc(doc(db, "inventory", form.id), {
          ...payload,
          productId: syncedProductId ?? payload.productId,
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
          productId: syncedProductId ?? payload.productId,
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
          hcpc: payload.hcpc,
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
            payload.status === "discontinued" || payload.status === "rental_out"
              ? "inactive"
              : payload.status,
          notes: payload.notes,
          source: "inventory",
          sourceId: "manual_entry",
        });

        const syncedProductId = await ensureProductFromInventory({
          id: result.inventoryId,
          ...payload,
          searchText,
          isDeleted: false,
        });

        await updateDoc(doc(db, "inventory", result.inventoryId), {
          ...payload,
          productId: syncedProductId ?? payload.productId,
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
          productId: syncedProductId ?? payload.productId,
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
    handleScanMovement,
    handleSoftDelete,
    handleHardDelete,
    handleDiscontinue,
    handleBatchArchive,
    handleBatchDiscontinue,
  };
}


