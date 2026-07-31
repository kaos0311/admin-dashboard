"use client";

import type { FormEvent } from "react";
import toast from "react-hot-toast";

import { normalizeBarcode } from "@/lib/barcode";
import { auth } from "@/lib/firebase";
import { createInventoryMovement } from "@/lib/inventory/movements";
import { smartMergeInventory } from "@/lib/inventory/smartMergeInventory";
import { InventoryRepository } from "@/repositories/firestore/inventory.repository";
import { identifyInventoryProduct } from "@/services/inventory/inventory-jarvis.service";

import { isLowStock } from "../lib/inventoryAlerts";
import { buildSearchText, toSafeNumber } from "../lib/inventoryNormalize";
import { logInventoryMovement } from "../lib/inventoryMovements";
import { ensureProductFromInventory } from "../lib/inventoryProductSync";
import type { InventoryForm, InventoryItem } from "../lib/inventoryTypes";

type ProductScanMatch = {
  id: string;
  name: string;
  category: string;
  sku: string;
  hcpcs: string;
  upc: string;
  manufacturer: string;
  manufacturerItemId: string;
  model: string;
  defaultPurchasePrice: number;
  reorderLevel: number;
  status: string;
  deleted: boolean;
};

type UseInventoryActionsArgs = {
  form: InventoryForm;
  items: InventoryItem[];
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
  items,
  canWrite,
  isAdmin,
  selectedIds,
  resetForm,
  removeSelectedId,
  clearSelected,
  setSaving,
}: UseInventoryActionsArgs) {
  function omitMovementFields(
    payload: Omit<InventoryItem, "id" | "searchText" | "isDeleted">
  ): Partial<Omit<InventoryItem, "id" | "searchText" | "isDeleted">> {
    const {
      quantityOnHand: _quantityOnHand,
      available: _available,
      committed: _committed,
      onRent: _onRent,
      onOrder: _onOrder,
      totalValue: _totalValue,
      status: _status,
      lifecycleStatus: _lifecycleStatus,
      ...rest
    } = payload;

    return rest;
  }

  async function findInventoryByScan(rawCode: string): Promise<InventoryItem | null> {
    return InventoryRepository.findByScan(rawCode);
  }

  async function findProductByScan(rawCode: string): Promise<ProductScanMatch | null> {
    const product = await InventoryRepository.findProductByScan(rawCode);
    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      category: product.category,
      sku: product.sku,
      hcpcs: product.hcpcs,
      upc: product.upc,
      manufacturer: product.manufacturer || product.brand || "",
      manufacturerItemId: product.manufacturerItemId,
      model: product.model,
      defaultPurchasePrice: product.defaultPurchasePrice,
      reorderLevel: product.reorderLevel,
      status: product.status,
      deleted: product.deleted,
    };
  }

  async function createInventoryFromProductScan(rawCode: string, product: ProductScanMatch) {
    const clean = normalizeBarcode(rawCode);
    const barcode = product.upc ? normalizeBarcode(product.upc) : clean;
    const payload: Omit<InventoryItem, "id" | "searchText" | "isDeleted"> = {
      productId: product.id,
      name: product.name || `Scanned product ${clean}`,
      category: product.category || "Uncategorized",
      sku: product.sku || clean,
      hcpc: product.hcpcs.toUpperCase(),
      barcode,
      serial: "",
      lotNumber: "",
      locationName: "Main Location",
      binLocation: "",
      quantityOnHand: 0,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      available: 0,
      reorderLevel: product.reorderLevel,
      unitCost: product.defaultPurchasePrice,
      totalValue: 0,
      status: product.status === "discontinued" ? "discontinued" : "available",
      manufacturer: product.manufacturer,
      manufacturerItemId: product.manufacturerItemId,
      modelNumber: product.model,
      warrantyProvider: "",
      warrantyStartDate: "",
      warrantyEndDate: "",
      warrantyNotes: "",
      purchaseDate: "",
      usefulLifeMonths: 0,
      lifecycleStatus: "active",
      nextServiceDate: "",
      lifecycleNotes: "",
      notes: `Created automatically from product catalog scan ${clean}.`,
    };
    const searchText = buildSearchText(payload);

    const result = await smartMergeInventory({
      productId: product.id,
      name: payload.name,
      category: payload.category,
      manufacturer: payload.manufacturer,
      manufacturerItemId: payload.manufacturerItemId,
      sku: payload.sku,
      hcpc: payload.hcpc,
      barcode: payload.barcode,
      serial: "",
      lotNumber: "",
      expirationDate: "",
      locationName: payload.locationName,
      binLocation: "",
      quantityOnHand: 0,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      reorderLevel: payload.reorderLevel,
      unitCost: payload.unitCost,
      status: payload.status === "discontinued" ? "inactive" : "available",
      notes: payload.notes,
      source: "inventory_product_scan",
      sourceId: product.id,
    });

    await InventoryRepository.update(result.inventoryId, {
      ...omitMovementFields(payload),
      searchText,
      pendingScanReview: false,
      scanSource: "product_catalog_scan",
      lastScannedAt: new Date().toISOString(),
      lastScanDirection: "in",
    });

    const movement = await createInventoryMovement({
      operationId: `scan-in-product-${result.inventoryId}-${clean}`,
      movementType: "receive",
      inventoryItemId: result.inventoryId,
      productId: product.id,
      barcode: payload.barcode,
      quantity: 1,
      reason: "Scanned in from matching product catalog record.",
      source: "scanner",
      metadata: {
        productCatalogScan: true,
        mergeAction: result.action,
      },
    });

    if (
      movement.status !== "success" &&
      movement.status !== "duplicate_operation"
    ) {
      throw new Error(movement.message || "Scanned product receive failed.");
    }

    toast.success(`${payload.name} scanned in from product catalog.`);
  }

  async function runJarvisInventoryIdentification(inventoryId: string, rawCode: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Scan saved, but Jarvis identify needs a signed-in user.");
      return false;
    }

    try {
      const result = await identifyInventoryProduct({
        currentUser,
        inventoryId,
        code: normalizeBarcode(rawCode),
      });

      if (!result.ok) {
        toast("Scan saved for review. Jarvis could not identify the product.");
        return false;
      }

      toast.success(
        result.product?.name
          ? `Jarvis identified ${result.product.name}.`
          : "Jarvis identified the scanned product."
      );
      return true;
    } catch (error) {
      console.error("INVENTORY JARVIS IDENTIFY ERROR:", error);
      toast("Scan saved for review. Jarvis identify is unavailable.");
      return false;
    }
  }

  async function createPendingScanIn(rawCode: string) {
    const clean = normalizeBarcode(rawCode);
    const name = `Pending scanned item ${clean}`;
    const payload: Omit<InventoryItem, "id" | "searchText" | "isDeleted"> = {
      productId: "",
      name,
      category: "Pending Scan Review",
      sku: "",
      hcpc: "",
      barcode: "",
      serial: clean,
      lotNumber: "",
      locationName: "Main Location",
      binLocation: "",
      quantityOnHand: 0,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      available: 0,
      reorderLevel: 0,
      unitCost: 0,
      totalValue: 0,
      status: "available",
      manufacturer: "",
      manufacturerItemId: "",
      modelNumber: "",
      warrantyProvider: "",
      warrantyStartDate: "",
      warrantyEndDate: "",
      warrantyNotes: "",
      purchaseDate: "",
      usefulLifeMonths: 0,
      lifecycleStatus: "active",
      nextServiceDate: "",
      lifecycleNotes: "",
      notes: "Created automatically from an unmatched Scan In. Review and complete item details.",
    };
    const searchText = buildSearchText(payload);

    const result = await smartMergeInventory({
      productId: "",
      name,
      category: payload.category,
      manufacturer: "",
      manufacturerItemId: "",
      sku: "",
      hcpc: "",
      barcode: "",
      serial: clean,
      lotNumber: "",
      expirationDate: "",
      locationName: payload.locationName,
      binLocation: "",
      quantityOnHand: 0,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      reorderLevel: 0,
      unitCost: 0,
      status: "available",
      notes: payload.notes,
      source: "inventory_scan",
      sourceId: clean,
    });

    await InventoryRepository.update(result.inventoryId, {
      ...omitMovementFields(payload),
      productId: "",
      searchText,
      pendingScanReview: true,
      scanSource: "scan_in_unmatched",
      lastScannedAt: new Date().toISOString(),
      lastScanDirection: "in",
    });

    const movement = await createInventoryMovement({
      operationId: `scan-in-pending-${result.inventoryId}-${clean}`,
      movementType: "receive",
      inventoryItemId: result.inventoryId,
      serialNumber: clean,
      quantity: 1,
      reason: "Created pending inventory record from unmatched Scan In.",
      source: "scanner",
      metadata: {
        pendingScanReview: true,
        mergeAction: result.action,
      },
    });

    if (
      movement.status !== "success" &&
      movement.status !== "duplicate_operation"
    ) {
      throw new Error(movement.message || "Pending scan receive failed.");
    }

    const identified = await runJarvisInventoryIdentification(result.inventoryId, clean);

    if (!identified) {
      toast.success(
        result.action === "created"
          ? "Scan intake record created for review."
          : "Existing scanned product quantity updated for review."
      );
    }
  }

  async function handleScanMovement(
    rawCode: string,
    direction: "in" | "out",
    outReason?: "rental" | "purchase" | "maintenance"
  ): Promise<boolean> {
    if (!canWrite) {
      toast.error("You do not have permission to move inventory.");
      return false;
    }

    const item = await findInventoryByScan(rawCode);

    if (!item) {
      if (direction === "in") {
        const product = await findProductByScan(rawCode);

        if (product) {
          await createInventoryFromProductScan(rawCode, product);
          return true;
        }

        await createPendingScanIn(rawCode);
        return true;
      }

      toast.error("No inventory match found for that scan.");
      return false;
    }

    if (direction === "out" && item.available <= 0) {
      toast.error("That item has no available stock to scan out.");
      return false;
    }

    try {
      const movement = await createInventoryMovement({
        movementType:
          direction === "in"
            ? "receive"
            : outReason === "rental"
              ? "rental_checkout"
              : "patient_assignment",
        inventoryItemId: item.id,
        productId: item.productId,
        barcode: item.barcode || normalizeBarcode(rawCode),
        serialNumber: item.serial,
        lotNumber: item.lotNumber,
        quantity: 1,
        reason:
          direction === "in"
            ? "Scanned into inventory."
            : `Scanned out for ${outReason ?? "issue"}.`,
        source: "scanner",
        metadata: {
          rawCode,
          direction,
          outReason: outReason ?? "",
        },
      });

      if (
        movement.status !== "success" &&
        movement.status !== "duplicate_operation"
      ) {
        toast.error(movement.message || "Inventory movement was not applied.");
        return false;
      }
    } catch (error) {
      console.error("INVENTORY SCAN UPDATE FAILED", {
        itemId: item.id,
        direction,
        error,
      });

      toast.error("Inventory quantity could not be updated.");
      return false;
    }

    if (direction === "in") {
      if (item.pendingScanReview) {
        await runJarvisInventoryIdentification(item.id, rawCode);
      } else {
        void ensureProductFromInventory(item).catch((error) => {
          console.error("INVENTORY PRODUCT SYNC ERROR:", error);
          toast.error("Inventory moved, but product catalog sync needs review.");
        });
      }
    }

    toast.success(`${item.name} scanned ${direction}.`);
    return true;
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
    const pendingReview =
      payload.name.toLowerCase().startsWith("pending scanned item") ||
      payload.category === "Pending Scan Review";

    setSaving(true);

    try {
      if (form.id) {
        const currentItem = items.find((item) => item.id === form.id) ?? null;
        const quantityDelta = currentItem
          ? payload.quantityOnHand - currentItem.quantityOnHand
          : 0;
        const syncedProductId = await ensureProductFromInventory({
      id: form.id,
      ...payload,
      searchText,
      isDeleted: false,
        });

        await InventoryRepository.update(form.id, {
          ...omitMovementFields(payload),
          productId: syncedProductId ?? payload.productId,
          searchText,
          pendingScanReview: pendingReview,
          scanSource: pendingReview ? "scan_in_unmatched" : "inventory_review_completed",
          lowStock: isLowStock({
            id: form.id,
            ...payload,
            searchText,
            isDeleted: false,
          }),
        });

        if (quantityDelta !== 0) {
          const movement = await createInventoryMovement({
            movementType: "manual_adjustment",
            inventoryItemId: form.id,
            productId: syncedProductId ?? payload.productId,
            barcode: payload.barcode,
            serialNumber: payload.serial,
            lotNumber: payload.lotNumber,
            quantity: Math.abs(quantityDelta),
            quantityDelta,
            reason: "Manual inventory quantity adjustment.",
            source: "inventory_page",
          });

          if (
            movement.status !== "success" &&
            movement.status !== "duplicate_operation"
          ) {
            throw new Error(movement.message || "Quantity adjustment failed.");
          }
        }

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
        const initialQuantity = payload.quantityOnHand;
        const initialAvailable = payload.available;
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
          quantityOnHand: 0,
          committed: 0,
          onRent: 0,
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
          quantityOnHand: 0,
          available: 0,
          searchText,
          isDeleted: false,
        });

        await InventoryRepository.update(result.inventoryId, {
          ...omitMovementFields(payload),
          productId: syncedProductId ?? payload.productId,
          searchText,
          pendingScanReview: pendingReview,
          scanSource: pendingReview ? "scan_in_unmatched" : "inventory_review_completed",
          lowStock: isLowStock({
            id: result.inventoryId,
            ...payload,
            searchText,
            isDeleted: false,
          }),
        });

        if (initialQuantity > 0) {
          const movement = await createInventoryMovement({
            movementType: "receive",
            inventoryItemId: result.inventoryId,
            productId: syncedProductId ?? payload.productId,
            barcode: payload.barcode,
            serialNumber: payload.serial,
            lotNumber: payload.lotNumber,
            quantity: initialQuantity,
            reason: "Initial inventory quantity received from manual entry.",
            source: "inventory_page",
            metadata: {
              initialAvailable,
            },
          });

          if (
            movement.status !== "success" &&
            movement.status !== "duplicate_operation"
          ) {
            throw new Error(movement.message || "Initial quantity receive failed.");
          }
        }

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
      const movement = await createInventoryMovement({
        movementType: "archived",
        inventoryItemId: item.id,
        productId: item.productId,
        barcode: item.barcode,
        serialNumber: item.serial,
        lotNumber: item.lotNumber,
        quantity: 1,
        reason: "Inventory record archived.",
        source: "inventory_page",
      });

      if (movement.status !== "success" && movement.status !== "duplicate_operation") {
        toast.error(movement.message || "Archive failed.");
        return;
      }

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
      const movement = await createInventoryMovement({
        movementType: "hard_delete",
        inventoryItemId: item.id,
        productId: item.productId,
        barcode: item.barcode,
        serialNumber: item.serial,
        lotNumber: item.lotNumber,
        quantity: 1,
        reason: "Inventory record permanently deleted.",
        source: "inventory_page",
      });

      if (movement.status !== "success" && movement.status !== "duplicate_operation") {
        toast.error(movement.message || "Permanent delete failed.");
        return;
      }

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
      const movement = await createInventoryMovement({
        movementType: "discontinued",
        inventoryItemId: item.id,
        productId: item.productId,
        barcode: item.barcode,
        serialNumber: item.serial,
        lotNumber: item.lotNumber,
        quantity: 1,
        reason: "Inventory item discontinued.",
        source: "inventory_page",
      });

      if (movement.status !== "success" && movement.status !== "duplicate_operation") {
        toast.error(movement.message || "Could not discontinue item.");
        return;
      }

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
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          createInventoryMovement({
            movementType: "archived",
            inventoryItemId: id,
            quantity: 1,
            reason: "Batch inventory archive.",
            source: "inventory_page",
          })
        )
      );

      const failed = results.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" &&
            result.value.status !== "success" &&
            result.value.status !== "duplicate_operation")
      );

      if (failed.length > 0) {
        toast.error(
          `Archived ${selectedIds.length - failed.length} of ${selectedIds.length} selected items.`
        );
      } else {
        toast.success("Selected items archived.");
      }

      if (failed.length === 0) {
        clearSelected();
      }
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
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          createInventoryMovement({
            movementType: "discontinued",
            inventoryItemId: id,
            quantity: 1,
            reason: "Batch inventory discontinue.",
            source: "inventory_page",
          })
        )
      );

      const failed = results.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" &&
            result.value.status !== "success" &&
            result.value.status !== "duplicate_operation")
      );

      if (failed.length > 0) {
        toast.error(
          `Discontinued ${selectedIds.length - failed.length} of ${selectedIds.length} selected items.`
        );
      } else {
        toast.success("Selected items discontinued.");
        clearSelected();
      }
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


