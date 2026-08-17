"use client";

import { type FormEvent, useRef } from "react";
import toast from "react-hot-toast";

import { normalizeBarcode } from "@/lib/barcode";
import { auth } from "@/lib/firebase";
import {
  createInventoryMovement,
  createInventoryOperationId,
} from "@/lib/inventory/movements";
import { isRetryableInventoryTransactionError } from "@/hooks/useInventoryLookup";
import { receiveScannedInventoryIntake as receiveScannedInventoryIntakeOnce } from "@/lib/inventory/receive-scanned-inventory-intake";
import type {
  ReceiveScannedInventoryIntakeRequest,
  ReceiveScannedInventoryIntakeResponse,
} from "@/lib/inventory/receive-scanned-inventory-intake.types";
import {
  buildFrozenScanIntakeRequest,
  executeScanIntakeWithRetry,
} from "@/lib/inventory/scan-intake-retry";
import { smartMergeInventory } from "@/lib/inventory/smartMergeInventory";
import { InventoryRepository } from "@/repositories/firestore/inventory.repository";
import { identifyInventoryProduct } from "@/services/inventory/inventory-jarvis.service";
import { resolveInventoryScanForIntake } from "@/services/inventory/inventory-scan-adapter";

import {
  armResolvedNewSaveMovementState,
  buildSaveMovementFingerprint,
  completeSaveMovementState,
  createResolvedNewSaveMovementState,
  reconcileSaveMovementState,
  type SaveMovementState,
} from "../lib/saveMovementLifecycle";
import {
  type ManualUpsertOperationState,
  resolveManualUpsertOperation,
} from "../lib/manualUpsertOperationLifecycle";
import {
  type BatchMutationLedger,
  type BatchMutationType,
  createBatchMutationLedger,
  executeBatchMutationLedger,
  getCompletedBatchItemIds,
  hasResumableBatchMutationWork,
  summarizeBatchMutation,
} from "../lib/batchMutationLifecycle";
import {
  createDiscontinueRetryState,
  type DiscontinueRetryState,
  executeDiscontinueWithRetry,
  markDiscontinueOutcomeUncertain,
} from "../lib/discontinueLifecycle";
import {
  type ArchiveRetryState,
  createArchiveRetryState,
  executeArchiveWithRetry,
  markArchiveOutcomeUncertain,
} from "../lib/archiveLifecycle";
import {
  createHardDeleteRetryState,
  executeHardDeleteWithRetry,
  type HardDeleteRetryState,
  markHardDeleteOutcomeUncertain,
} from "../lib/hardDeleteLifecycle";
import {
  runCanonicalScanMovement,
  type ScanOutReason,
} from "../lib/scanMovementAuthority";
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

  async function receiveScannedInventoryIntake(
    request: ReceiveScannedInventoryIntakeRequest,
  ): Promise<ReceiveScannedInventoryIntakeResponse> {
    const frozenRequest = buildFrozenScanIntakeRequest(
      request,
      request.operationId ??
        createInventoryOperationId("scan-intake"),
    );

    return executeScanIntakeWithRetry({
      request: frozenRequest,
      execute: receiveScannedInventoryIntakeOnce,
      shouldRetry: (failure) => {
        return window.confirm(
          `${failure.message}\n\n` +
            "The server may have completed this Scan In even though the response was not received.\n\n" +
            "Retry this SAME Scan In now using the same operation ID?"
        );
      },
    });
  }

  const saveMovementStateRef = useRef<SaveMovementState | null>(null);

  const batchMutationLedgerRef = useRef(
    new Map<BatchMutationType, BatchMutationLedger>(),
  );
  const batchMutationInFlightRef = useRef(
    new Set<BatchMutationType>(),
  );

  const discontinueStateRef = useRef(
    new Map<string, DiscontinueRetryState>(),
  );
  const discontinueInFlightRef = useRef(new Set<string>());

  const archiveStateRef = useRef(
    new Map<string, ArchiveRetryState>(),
  );
  const archiveInFlightRef = useRef(new Set<string>());

  const hardDeleteStateRef = useRef(
    new Map<string, HardDeleteRetryState>(),
  );

  const manualUpsertOperationRef = useRef<ManualUpsertOperationState | null>(null);
  const hardDeleteInFlightRef = useRef(new Set<string>());

  async function executeSaveMovement(state: SaveMovementState): Promise<void> {
    if (state.stage === "complete") {
      return;
    }

    const request = state.request;
    const operationId = state.operationId;

    if (state.stage !== "pending" || !operationId || !request) {
      throw new Error("Inventory save movement is not ready to execute.");
    }

    try {
      const movement = await createInventoryMovement({
        ...request,
        operationId,
      });

      if (
        movement.status === "success" ||
        movement.status === "duplicate_operation"
      ) {
        saveMovementStateRef.current =
          completeSaveMovementState(state);
        return;
      }

      saveMovementStateRef.current = null;
      throw new Error(movement.message || "Inventory movement was not applied.");
    } catch (error: unknown) {
      if (!isRetryableInventoryTransactionError(error)) {
        saveMovementStateRef.current = null;
      }

      throw error;
    }
  }
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

  function omitPostUpsertAuthorityFields(
    payload: Omit<InventoryItem, "id" | "searchText" | "isDeleted">
  ): Partial<Omit<InventoryItem, "id" | "searchText" | "isDeleted">> {
    const {
      manufacturerItemId: _manufacturerItemId,
      sku: _sku,
      barcode: _barcode,
      serial: _serial,
      lotNumber: _lotNumber,
      ...metadata
    } = omitMovementFields(payload);

    return metadata;
  }

  async function createInventoryFromProductScan(rawCode: string, product: ProductScanMatch) {
    const clean = normalizeBarcode(rawCode);

    const result = await receiveScannedInventoryIntake({
      mode: "product-match",
      rawScan: rawCode,
      normalizedScan: clean,
      quantity: 1,
      locationId: "Main Location",
      productId: product.id,
    });

    if (!result.ok) {
      throw new Error(result.message || "Scanned product receive failed.");
    }

    toast.success(
      `${product.name || `Scanned product ${clean}`} scanned in from product catalog.`,
    );
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

    const result = await receiveScannedInventoryIntake({
      mode: "pending-scan",
      rawScan: rawCode,
      normalizedScan: clean,
      quantity: 1,
      locationId: "Main Location",
    });

    if (!result.ok) {
      throw new Error(result.message || "Pending scan receive failed.");
    }

    const identified = await runJarvisInventoryIdentification(result.data.inventoryItemId, clean);

    if (!identified) {
      toast.success(
        result.data.createdOrMerged === "created"
          ? "Scan intake record created for review."
          : "Existing scanned product quantity updated for review.",
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

    try {
      const result = await runCanonicalScanMovement({
        rawCode,
        direction,
        outReason: outReason as ScanOutReason | undefined,
        operationId: createInventoryOperationId("inventory-scan"),
        execute: createInventoryMovement,
        isRetryableError: isRetryableInventoryTransactionError,
        shouldRetry: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Inventory movement response was lost.";

          return window.confirm(
            `${message}\n\n` +
              "The server may have applied this scan even though the response was not received.\n\n" +
              "Retry this SAME scan now using the same operation ID?"
          );
        },
        resolveIntake: (code) =>
          resolveInventoryScanForIntake({ rawCode: code }),
        fetchInventoryById: InventoryRepository.getById,
      });

      if (result.status === "retry_declined") {
        toast.error(
          "Scan outcome is uncertain. No retry was attempted."
        );
        return false;
      }

      if (result.status === "movement_completed") {
        const { movement, inventoryItem } = result;

        if (result.enrichmentError) {
          console.error("INVENTORY SCAN ENRICHMENT FAILED", {
            inventoryItemId: movement.inventoryItemId,
            direction,
            error: result.enrichmentError,
          });
          toast.error(
            "Inventory moved, but the updated item details could not be loaded.",
          );
        }

        if (direction === "in" && movement.inventoryItemId) {
          if (inventoryItem?.pendingScanReview) {
            await runJarvisInventoryIdentification(
              movement.inventoryItemId,
              rawCode,
            );
          } else if (inventoryItem) {
            void ensureProductFromInventory(inventoryItem).catch((error) => {
              console.error("INVENTORY PRODUCT SYNC ERROR:", error);
              toast.error("Inventory moved, but product catalog sync needs review.");
            });
          }
        }

        toast.success(
          `${inventoryItem?.name ?? "Inventory"} scanned ${direction}.`,
        );
        return true;
      }

      if (result.status === "intake_fallback") {
        const scanResolution = result.scanResolution;

        if (scanResolution.kind === "product_suggestion") {
          await createInventoryFromProductScan(rawCode, {
            id: scanResolution.product.id,
            name: scanResolution.product.name,
            category: scanResolution.product.category,
            sku: scanResolution.product.sku,
            hcpcs: scanResolution.product.hcpcs,
            upc: scanResolution.product.upc,
            manufacturer: scanResolution.product.manufacturer || scanResolution.product.brand || "",
            manufacturerItemId: scanResolution.product.manufacturerItemId,
            model: scanResolution.product.model,
            defaultPurchasePrice: scanResolution.product.defaultPurchasePrice,
            reorderLevel: scanResolution.product.reorderLevel,
            status: scanResolution.product.status,
            deleted: scanResolution.product.deleted,
          });
          return true;
        }

        await createPendingScanIn(rawCode);
        return true;
      }

      if (result.movement.status === "ambiguous") {
        toast.error("Scan matches multiple inventory records. Select the item and try again.");
        return false;
      }

      if (result.movement.status === "not_found") {
        toast.error("No inventory match found for that scan.");
        return false;
      }

      toast.error(
        result.movement.message || "Inventory movement was not applied.",
      );
      return false;
    } catch (error: unknown) {
      console.error("INVENTORY SCAN UPDATE FAILED", {
        direction,
        error,
      });

      toast.error(
        error instanceof Error
          ? error.message
          : "Inventory quantity could not be updated."
      );

      return false;
    }
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

    const saveMovementFingerprint = buildSaveMovementFingerprint({
      kind: form.id ? "existing_adjustment" : "new_receive",
      inventoryItemId: form.id || undefined,
      targetQuantityOnHand: payload.quantityOnHand,
      productId: payload.productId,
      barcode: payload.barcode,
      serialNumber: payload.serial,
      lotNumber: payload.lotNumber,
    });

    let saveMovementState = reconcileSaveMovementState(
      saveMovementStateRef.current,
      saveMovementFingerprint,
    );

    saveMovementStateRef.current = saveMovementState;

    setSaving(true);

    try {
      if (form.id) {
        if (
          saveMovementState &&
          saveMovementState.context.kind !== "existing"
        ) {
          saveMovementStateRef.current = null;
          saveMovementState = null;
        }

        let quantityDelta = 0;

        if (!saveMovementState) {
          const currentItem =
            items.find((item) => item.id === form.id) ?? null;

          if (!currentItem) {
            throw new Error(
              "The inventory item being edited is no longer available in the current inventory snapshot."
            );
          }

          quantityDelta =
            payload.quantityOnHand - currentItem.quantityOnHand;
        }

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
          scanSource: pendingReview
            ? "scan_in_unmatched"
            : "inventory_review_completed",
          lowStock: isLowStock({
            id: form.id,
            ...payload,
            searchText,
            isDeleted: false,
          }),
        });

        if (saveMovementState) {
          await executeSaveMovement(saveMovementState);
        } else if (quantityDelta !== 0) {
          const nextState: SaveMovementState = {
            fingerprint: saveMovementFingerprint,
            stage: "pending",
            operationId: createInventoryOperationId("inventory-save"),
            request: {
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
            },
            context: {
              kind: "existing",
              inventoryItemId: form.id,
            },
          };

          saveMovementStateRef.current = nextState;
          saveMovementState = nextState;

          await executeSaveMovement(nextState);
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

        if (
          saveMovementState &&
          saveMovementState.context.kind !== "new"
        ) {
          saveMovementStateRef.current = null;
          saveMovementState = null;
        }

        let inventoryId: string;
        let resultAction: "created" | "merged";

        if (saveMovementState?.context.kind === "new") {
          inventoryId = saveMovementState.context.inventoryItemId;
          resultAction = saveMovementState.context.action;
        } else {
          const upsertOperation = resolveManualUpsertOperation({
            current: manualUpsertOperationRef.current,
            fingerprint: saveMovementFingerprint,
            createOperationId: () => createInventoryOperationId("manual-inventory-upsert"),
          });
          manualUpsertOperationRef.current = upsertOperation;

          const result = await smartMergeInventory({
            operationId: upsertOperation.operationId,
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
            reorderLevel: payload.reorderLevel,
            unitCost: payload.unitCost,
            notes: payload.notes,
            source: "inventory",
            sourceId: "manual_entry",
          });

          if (result.status === "ambiguous") {
            manualUpsertOperationRef.current = null;
            throw new Error(
              `Manual inventory save matched ${result.matches.length} existing inventory records. Resolve the duplicate records before saving.`,
            );
          }

          inventoryId = result.inventoryId;
          resultAction = result.action;
          manualUpsertOperationRef.current = null;

          const resolvedTargetState =
            createResolvedNewSaveMovementState({
              fingerprint: saveMovementFingerprint,
              inventoryItemId: inventoryId,
              action: resultAction,
            });

          saveMovementStateRef.current = resolvedTargetState;
          saveMovementState = resolvedTargetState;
        }

        const syncedProductId = await ensureProductFromInventory({
          id: inventoryId,
          ...payload,
          quantityOnHand: 0,
          available: 0,
          searchText,
          isDeleted: false,
        });

        await InventoryRepository.update(inventoryId, {
          ...omitPostUpsertAuthorityFields(payload),
          productId: syncedProductId ?? payload.productId,
          searchText,
          pendingScanReview: pendingReview,
          scanSource: pendingReview
            ? "scan_in_unmatched"
            : "inventory_review_completed",
          lowStock: isLowStock({
            id: inventoryId,
            ...payload,
            searchText,
            isDeleted: false,
          }),
        });

        if (initialQuantity > 0) {
          if (!saveMovementState || saveMovementState.context.kind !== "new") {
            throw new Error("Resolved inventory target is missing for initial receive.");
          }

          if (saveMovementState.stage === "target_resolved") {
            const armedState = armResolvedNewSaveMovementState({
              state: saveMovementState,
              operationId: createInventoryOperationId("inventory-save"),
              request: {
                movementType: "receive",
                inventoryItemId: inventoryId,
                productId: syncedProductId ?? payload.productId,
                barcode: payload.barcode,
                serialNumber: payload.serial,
                lotNumber: payload.lotNumber,
                quantity: initialQuantity,
                reason:
                  "Initial inventory quantity received from manual entry.",
                source: "inventory_page",
                metadata: {
                  initialAvailable,
                },
              },
            });

            saveMovementStateRef.current = armedState;
            saveMovementState = armedState;
          }

          await executeSaveMovement(saveMovementState);
        }

        await logInventoryMovement({
          productId: syncedProductId ?? payload.productId,
          productName: payload.name,
          barcode: payload.barcode,
          serial: payload.serial,
          lotNumber: payload.lotNumber,
          type:
            resultAction === "created"
              ? "inventory_created"
              : "inventory_merged",
          quantity: payload.quantityOnHand,
          sourceId: inventoryId,
          notes:
            resultAction === "created"
              ? "Inventory record created."
              : "Inventory merged with existing stock.",
        });

        toast.success(
          resultAction === "created"
            ? "Inventory added."
            : "Inventory merged with existing stock."
        );
      }

      saveMovementStateRef.current = null;
      resetForm();
    } catch (error: unknown) {
      console.error("SAVE INVENTORY ERROR:", error);

      if (!isRetryableInventoryTransactionError(error)) {
        manualUpsertOperationRef.current = null;
      }

      const pendingMovement = saveMovementStateRef.current;
      const outcomeIsUncertain =
        pendingMovement?.stage === "pending" &&
        isRetryableInventoryTransactionError(error);

      toast.error(
        outcomeIsUncertain
          ? "Inventory save outcome is uncertain. Retry Save to safely reuse the same operation."
          : "Inventory could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSoftDelete(item: InventoryItem) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (archiveInFlightRef.current.has(item.id)) {
      return;
    }

    let state = archiveStateRef.current.get(item.id);

    if (state?.outcomeUncertain) {
      const retryUncertain = window.confirm(
        `The previous archive attempt for "${item.name}" has an uncertain outcome.` +
          "\n\nThe server may already have archived this inventory record." +
          "\n\nRetry the SAME archive using the same operation ID?",
      );

      if (!retryUncertain) {
        return;
      }
    } else if (!state) {
      if (
        !window.confirm(
          `Archive "${item.name}"? This keeps history but removes it from active inventory.`,
        )
      ) {
        return;
      }

      state = createArchiveRetryState(
        {
          movementType: "archived",
          inventoryItemId: item.id,
          productId: item.productId,
          barcode: item.barcode,
          serialNumber: item.serial,
          lotNumber: item.lotNumber,
          quantity: 1,
          reason: "Inventory record archived.",
          source: "inventory_page",
        },
        createInventoryOperationId("inventory-archive"),
      );

      archiveStateRef.current.set(item.id, state);
    }

    archiveInFlightRef.current.add(item.id);

    try {
      const execution = await executeArchiveWithRetry({
        state,
        execute: createInventoryMovement,
        isRetryableError: isRetryableInventoryTransactionError,
        shouldRetry: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "The archive response was not received.";

          return window.confirm(
            `${message}\n\n` +
              "The server may already have archived this inventory record.\n\n" +
              "Retry this SAME archive now using the same operation ID?",
          );
        },
      });

      if (execution.status === "retry_declined") {
        archiveStateRef.current.set(
          item.id,
          markArchiveOutcomeUncertain(state),
        );

        toast.error(
          "Archive outcome is uncertain. Retry this same item to safely reuse the same operation.",
        );
        return;
      }

      const movement = execution.movement;

      if (
        movement.status !== "success" &&
        movement.status !== "duplicate_operation"
      ) {
        archiveStateRef.current.delete(item.id);
        toast.error(movement.message || "Archive failed.");
        return;
      }

      archiveStateRef.current.delete(item.id);
      removeSelectedId(item.id);
      toast.success("Inventory archived.");
    } catch (error: unknown) {
      archiveStateRef.current.delete(item.id);

      console.error("ARCHIVE INVENTORY ERROR:", error);
      toast.error("Archive failed.");
    } finally {
      archiveInFlightRef.current.delete(item.id);
    }
  }

  async function handleHardDelete(item: InventoryItem) {
    if (!isAdmin) {
      toast.error("Only admins can permanently delete inventory.");
      return;
    }

    if (hardDeleteInFlightRef.current.has(item.id)) {
      toast.error("Permanent delete is already in progress for this item.");
      return;
    }

    const existingState = hardDeleteStateRef.current.get(item.id);

    const confirmed = existingState?.outcomeUncertain
      ? window.confirm(
          `The previous permanent delete for "${item.name}" has an uncertain outcome.\n\n` +
            "The server may already have completed it.\n\n" +
            "Retry this SAME permanent delete now using the same operation ID?",
        )
      : window.confirm(
          `Permanently delete "${item.name}"? This is not reversible.`,
        );

    if (!confirmed) {
      return;
    }

    const state =
      existingState ??
      createHardDeleteRetryState(
        {
          movementType: "hard_delete",
          inventoryItemId: item.id,
          productId: item.productId,
          barcode: item.barcode,
          serialNumber: item.serial,
          lotNumber: item.lotNumber,
          quantity: 1,
          reason: "Inventory record permanently deleted.",
          source: "inventory_page",
        },
        createInventoryOperationId("inventory-hard-delete"),
      );

    hardDeleteStateRef.current.set(item.id, state);
    hardDeleteInFlightRef.current.add(item.id);

    try {
      const execution = await executeHardDeleteWithRetry({
        state,
        execute: createInventoryMovement,
        isRetryableError: isRetryableInventoryTransactionError,
        shouldRetry: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "The permanent-delete response was not received.";

          return window.confirm(
            `${message}\n\n` +
              "The server may already have completed this permanent delete.\n\n" +
              "Retry this SAME permanent delete now using the same operation ID?",
          );
        },
      });

      if (execution.status === "retry_declined") {
        hardDeleteStateRef.current.set(
          item.id,
          markHardDeleteOutcomeUncertain(state),
        );

        toast.error(
          "Permanent delete outcome is uncertain. Retry this same item to safely reuse the same operation.",
        );
        return;
      }

      const movement = execution.movement;

      if (
        movement.status !== "success" &&
        movement.status !== "duplicate_operation"
      ) {
        hardDeleteStateRef.current.delete(item.id);
        toast.error(movement.message || "Permanent delete failed.");
        return;
      }

      hardDeleteStateRef.current.delete(item.id);
      removeSelectedId(item.id);
      toast.success("Inventory permanently deleted.");
    } catch (error: unknown) {
      hardDeleteStateRef.current.delete(item.id);
      console.error("HARD DELETE INVENTORY ERROR:", error);
      toast.error("Permanent delete failed.");
    } finally {
      hardDeleteInFlightRef.current.delete(item.id);
    }
  }
  async function handleDiscontinue(item: InventoryItem) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (discontinueInFlightRef.current.has(item.id)) {
      return;
    }

    let state = discontinueStateRef.current.get(item.id);

    if (state?.outcomeUncertain) {
      const retryUncertain = window.confirm(
        `The previous discontinue attempt for "${item.name}" has an uncertain outcome.` +
          "\n\nThe server may already have discontinued this inventory item." +
          "\n\nRetry the SAME discontinue using the same operation ID?",
      );

      if (!retryUncertain) {
        return;
      }
    } else if (!state) {
      state = createDiscontinueRetryState(
        {
          movementType: "discontinued",
          inventoryItemId: item.id,
          productId: item.productId,
          barcode: item.barcode,
          serialNumber: item.serial,
          lotNumber: item.lotNumber,
          quantity: 1,
          reason: "Inventory item discontinued.",
          source: "inventory_page",
        },
        createInventoryOperationId("inventory-discontinue"),
      );

      discontinueStateRef.current.set(item.id, state);
    }

    discontinueInFlightRef.current.add(item.id);

    try {
      const execution = await executeDiscontinueWithRetry({
        state,
        execute: createInventoryMovement,
        isRetryableError: isRetryableInventoryTransactionError,
        shouldRetry: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "The discontinue response was not received.";

          return window.confirm(
            `${message}\n\n` +
              "The server may already have discontinued this inventory item.\n\n" +
              "Retry this SAME discontinue now using the same operation ID?",
          );
        },
      });

      if (execution.status === "retry_declined") {
        discontinueStateRef.current.set(
          item.id,
          markDiscontinueOutcomeUncertain(state),
        );

        toast.error(
          "Discontinue outcome is uncertain. Retry this same item to safely reuse the same operation.",
        );
        return;
      }

      const movement = execution.movement;

      if (
        movement.status !== "success" &&
        movement.status !== "duplicate_operation"
      ) {
        discontinueStateRef.current.delete(item.id);
        toast.error(
          movement.message || "Could not discontinue item.",
        );
        return;
      }

      discontinueStateRef.current.delete(item.id);
      removeSelectedId(item.id);
      toast.success("Item discontinued.");
    } catch (error: unknown) {
      discontinueStateRef.current.delete(item.id);

      console.error("DISCONTINUE INVENTORY ERROR:", error);
      toast.error("Could not discontinue item.");
    } finally {
      discontinueInFlightRef.current.delete(item.id);
    }
  }

  async function executeInventoryBatchMutation(
    movementType: BatchMutationType,
  ) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (
      batchMutationInFlightRef.current.has(
        movementType,
      )
    ) {
      return;
    }

    if (batchMutationInFlightRef.current.size > 0) {
      toast.error(
        "Another batch inventory action is already running.",
      );
      return;
    }

    let ledger =
      batchMutationLedgerRef.current.get(
        movementType,
      );

    const existingSummary = ledger
      ? summarizeBatchMutation(ledger)
      : null;

    if (
      ledger &&
      existingSummary &&
      hasResumableBatchMutationWork(existingSummary)
    ) {
      const label =
        movementType === "archived"
          ? "archive"
          : "discontinue";

      const resume = window.confirm(
        `A previous batch ${label} still has work to resume.` +
          `\n\nPending: ${existingSummary.pending}` +
          `\nUncertain: ${existingSummary.uncertain}` +
          "\n\nPending items have not received a definitive result. Uncertain items may already have completed on the server." +
          "\n\nResume the remaining batch work using the original operation IDs?",
      );

      if (!resume) {
        return;
      }
    } else {
      if (!selectedIds.length) {
        toast.error("Select items first.");
        return;
      }

      if (
        movementType === "archived" &&
        !window.confirm(
          `Archive ${selectedIds.length} selected item(s)?`,
        )
      ) {
        return;
      }

      const batchId =
        createInventoryOperationId(
          movementType === "archived"
            ? "inventory-batch-archive"
            : "inventory-batch-discontinue",
        );

      ledger = createBatchMutationLedger({
        batchId,
        movementType,
        requests: selectedIds.map((id) => ({
          movementType,
          inventoryItemId: id,
          quantity: 1,
          reason:
            movementType === "archived"
              ? "Batch inventory archive."
              : "Batch inventory discontinue.",
          source: "inventory_page",
        })),
        operationIdForItem: (
          _itemId,
          index,
        ) =>
          createInventoryOperationId(
            movementType === "archived"
              ? `inventory-batch-archive-${index + 1}`
              : `inventory-batch-discontinue-${index + 1}`,
          ),
      });

      batchMutationLedgerRef.current.set(
        movementType,
        ledger,
      );
    }

    batchMutationInFlightRef.current.add(
      movementType,
    );

    try {
      while (true) {
        ledger =
          await executeBatchMutationLedger({
            ledger,
            execute:
              createInventoryMovement,
            isRetryableError:
              isRetryableInventoryTransactionError,
          });

        batchMutationLedgerRef.current.set(
          movementType,
          ledger,
        );

        const completedItemIds =
          getCompletedBatchItemIds(ledger);

        for (
          const itemId of completedItemIds
        ) {
          removeSelectedId(itemId);
        }

        const summary =
          summarizeBatchMutation(ledger);

        if (summary.uncertain > 0) {
          const label =
            movementType === "archived"
              ? "Archive"
              : "Discontinue";

          const retry = window.confirm(
            `${label} batch results:` +
              `\n\nCompleted: ${summary.completed}` +
              `\nFailed: ${summary.failed}` +
              `\nUncertain: ${summary.uncertain}` +
              "\n\nRetry ONLY the uncertain items now using the same operation IDs?",
          );

          if (retry) {
            continue;
          }

          toast.error(
            `${summary.uncertain} batch item(s) have an uncertain outcome. Retry this same batch action to safely resume them.`,
          );

          return;
        }

        batchMutationLedgerRef.current.delete(
          movementType,
        );

        const actionPastTense =
          movementType === "archived"
            ? "Archived"
            : "Discontinued";

        if (summary.failed > 0) {
          toast.error(
            `${actionPastTense} ${summary.completed} of ${summary.total} selected items. ${summary.failed} item(s) failed and remain selected.`,
          );
          return;
        }

        clearSelected();

        toast.success(
          movementType === "archived"
            ? "Selected items archived."
            : "Selected items discontinued.",
        );

        return;
      }
    } catch (error: unknown) {
      console.error(
        movementType === "archived"
          ? "BATCH ARCHIVE INVENTORY ERROR:"
          : "BATCH DISCONTINUE INVENTORY ERROR:",
        error,
      );

      /*
       * Do not discard the ledger here. An unexpected
       * orchestration error after requests began must not
       * cause fresh operation IDs on the next attempt.
       */
      toast.error(
        "Batch processing stopped unexpectedly. Retry the same batch action before starting a new one.",
      );
    } finally {
      batchMutationInFlightRef.current.delete(
        movementType,
      );
    }
  }

  async function handleBatchArchive() {
    await executeInventoryBatchMutation(
      "archived",
    );
  }

  async function handleBatchDiscontinue() {
    await executeInventoryBatchMutation(
      "discontinued",
    );
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

