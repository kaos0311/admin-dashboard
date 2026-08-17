"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Bug,
  CheckCircle2,
  ClipboardList,
  History,
  PackageCheck,
  PackagePlus,
  PackageX,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/scanning/BarcodeScannerInput";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { hasPermission } from "@/lib/permissions/roles";
import {
  getInventoryTransactionErrorCode,
  getMatchedFieldLabel,
  type InventoryLookupItem,
  type InventoryLookupMatchedField,
  isRetryableInventoryTransactionError,
  type TransactionResult,
  useInventoryLookup,
} from "@/hooks/useInventoryLookup";
import { createInventoryMovement } from "@/lib/inventory/movements";
import { equipmentCheckInByBarcodeWorkflow } from "@/lib/domainWorkflows";
import { OperationIdManager } from "@/lib/inventory/receive-inventory";
import { buttons, glass, tiles, typography } from "@/theme";

type TransactionMode =
  | "lookup"
  | "receive"
  | "issue"
  | "rental_checkout"
  | "equipment_check_in"
  | "retail_sale"
  | "transfer"
  | "cycle_count";

const TRANSACTION_LABELS: Record<TransactionMode, string> = {
  lookup: "Lookup",
  receive: "Receive Stock",
  issue: "Distribute / Issue",
  rental_checkout: "Rental Check-Out",
  equipment_check_in: "Equipment Check-In",
  retail_sale: "Retail Sale",
  transfer: "Transfer Location",
  cycle_count: "Cycle Count",
};

const TRANSACTION_ICONS: Record<TransactionMode, React.ReactNode> = {
  lookup: <Search className="h-4 w-4" />,
  receive: <PackagePlus className="h-4 w-4" />,
  issue: <PackageX className="h-4 w-4" />,
  rental_checkout: <PackageCheck className="h-4 w-4" />,
  equipment_check_in: <RotateCcw className="h-4 w-4" />,
  retail_sale: <ShoppingCart className="h-4 w-4" />,
  transfer: <ArrowLeftRight className="h-4 w-4" />,
  cycle_count: <ClipboardList className="h-4 w-4" />,
};

interface RecentScan {
  barcode: string;
  productName: string | null;
  transaction: TransactionMode;
  status: "success" | "not_found" | "duplicate" | "failed";
  timestamp: number;
}

/** Matched field badges shown in the result UI. */
function MatchedFieldBadge({ field }: { field: InventoryLookupMatchedField }) {
  const colors: Record<InventoryLookupMatchedField, string> = {
    barcode: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    serial: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    lotNumber: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    sku: "bg-green-500/20 text-green-300 border-green-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[field]}`}
    >
      Matched by {getMatchedFieldLabel(field)}
    </span>
  );
}

function MatchedFieldsList({
  fields,
}: {
  fields: InventoryLookupMatchedField[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => (
        <MatchedFieldBadge key={f} field={f} />
      ))}
    </div>
  );
}

export default function ScannerPage() {
  const {
    loading: authLoading,
    user,
    role,
    canAccessCommandCenter,
  } = useAuthRole();

  const canWrite =
    canAccessCommandCenter &&
    hasPermission(role, "inventory:write");
  const { lookupByBarcode, executeTransaction, loading: txLoading, error: txError, reset: resetTx } = useInventoryLookup();

  const [transactionMode, setTransactionMode] = useState<TransactionMode>("lookup");
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
  const [lastRawScan, setLastRawScan] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryLookupItem | null>(null);
  const [matchedFields, setMatchedFields] = useState<InventoryLookupMatchedField[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<Array<{ item: InventoryLookupItem; matchedFields: InventoryLookupMatchedField[] }>>([]);
  const [unknownBarcode, setUnknownBarcode] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "scanning" | "found" | "not_found" | "duplicate">("idle");
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Diagnostic panel state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<{
    rawScan: string;
    normalizedScan: string;
    responseTimeMs: number;
    matchedField: string | null;
    matchedDocId: string | null;
    lookupStatus: string;
    authUid: string | null;
  } | null>(null);

  // Transaction form state
  const [quantity, setQuantity] = useState("1");
  const [toLocation, setToLocation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const scannerRef = useRef<BarcodeScannerInputHandle>(null);
  const processingRef = useRef(false);
  const diagnosticToggleRef = useRef(false);

  // operationId lifecycle manager (PHASE 2 — reused for retries)
  const operationIdManagerRef = useRef(new OperationIdManager());
  // Track the latest operationId we sent so we don't reuse a stale one on double-click
  const pendingOperationIdRef = useRef<string | null>(null);

  // Auto-focus scanner on mount
  useEffect(() => {
    if (!authLoading && canWrite) {
      const timer = setTimeout(() => {
        scannerRef.current?.focusScanner();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authLoading, canWrite]);

  /** Refocus the scanner input after a brief delay to let state settle. */
  const refocusScanner = useCallback(() => {
    setTimeout(() => scannerRef.current?.focusScanner(), 100);
  }, []);

  const addRecentScan = useCallback(
    (scan: RecentScan) => {
      setRecentScans((prev) => [scan, ...prev].slice(0, 50));
    },
    [],
  );

  const handleScan = useCallback(
    async (barcode: string) => {
      // Prevent duplicate submission while a lookup is already in-flight
      if (processingRef.current) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[BarcodeScanner] Blocked duplicate scan while processing:", barcode);
        }
        return;
      }

      processingRef.current = true;
      const scanStartTime = Date.now();

      // Dev logging
      if (process.env.NODE_ENV === "development") {
        console.warn("[BarcodeScanner] Raw scan received:", barcode);
        console.warn("[BarcodeScanner] Normalized value:", barcode.trim());
      }

      // Reset any stale operationId when a new scan starts
      operationIdManagerRef.current.reset();
      pendingOperationIdRef.current = null;

      setLastScannedBarcode(barcode);
      setLastRawScan(barcode);
      setLookupState("scanning");
      setTransactionResult(null);
      setSelectedItem(null);
      setMatchedFields([]);
      setDuplicateMatches([]);
      setUnknownBarcode(false);
      setShowConfirmation(false);
      setConfirming(false);
      setLookupError(null);
      resetTx();

      const result = await lookupByBarcode(barcode);
      const responseTimeMs = Date.now() - scanStartTime;

      processingRef.current = false;

      // Handle null result (error / network failure)
      if (!result) {
        setLookupState("not_found");
        setUnknownBarcode(true);
        setLookupError(txError || "Lookup failed. Check your connection.");
        addRecentScan({
          barcode,
          productName: null,
          transaction: transactionMode,
          status: "not_found",
          timestamp: Date.now(),
        });
        setDiagnosticData({
          rawScan: barcode,
          normalizedScan: barcode.trim(),
          responseTimeMs,
          matchedField: null,
          matchedDocId: null,
          lookupStatus: "error",
          authUid: user?.uid ?? null,
        });
        refocusScanner();
        return;
      }

      // --- Handle discriminated response ---
      switch (result.status) {
        case "found": {
          setLookupState("found");
          setSelectedItem(result.item);
          setMatchedFields(result.matchedFields);
          setShowConfirmation(transactionMode !== "lookup");
          addRecentScan({
            barcode,
            productName: result.item.name,
            transaction: transactionMode,
            status: "success",
            timestamp: Date.now(),
          });
          setDiagnosticData({
            rawScan: barcode,
            normalizedScan: barcode.trim(),
            responseTimeMs,
            matchedField: result.matchedFields.join(", "),
            matchedDocId: result.item.id,
            lookupStatus: "found",
            authUid: user?.uid ?? null,
          });
          break;
        }
        case "not_found": {
          setLookupState("not_found");
          setUnknownBarcode(true);
          addRecentScan({
            barcode,
            productName: null,
            transaction: transactionMode,
            status: "not_found",
            timestamp: Date.now(),
          });
          setDiagnosticData({
            rawScan: barcode,
            normalizedScan: result.normalizedBarcode,
            responseTimeMs,
            matchedField: null,
            matchedDocId: null,
            lookupStatus: "not_found",
            authUid: user?.uid ?? null,
          });
          break;
        }
        case "duplicate": {
          setLookupState("duplicate");
          setDuplicateMatches(result.matches);
          addRecentScan({
            barcode,
            productName: null,
            transaction: transactionMode,
            status: "duplicate",
            timestamp: Date.now(),
          });
          setDiagnosticData({
            rawScan: barcode,
            normalizedScan: result.normalizedBarcode,
            responseTimeMs,
            matchedField: `${result.matches.length} documents matched`,
            matchedDocId: null,
            lookupStatus: "duplicate",
            authUid: user?.uid ?? null,
          });
          break;
        }
        default:
          setLookupState("not_found");
          setUnknownBarcode(true);
          setLookupError("Unexpected server response.");
      }

      // Auto-clear and refocus for next scan
      refocusScanner();
    },
    [addRecentScan, lookupByBarcode, refocusScanner, resetTx, transactionMode, txError, user?.uid],
  );

  /**
   * Handle confirmation of a transaction.
   *
   * Receive and Retail Sale use the canonical movement callable with a stable
   * operationId. Issue, Transfer, and Cycle Count continue through the
   * compatibility transaction callables.
   */
  const handleConfirmTransaction = useCallback(async () => {
    if (!selectedItem || !lastScannedBarcode) return;

    // Prevent double-click / repeated Enter from submitting again
    // while a confirmation is already in-flight
    if (confirming) return;

    setConfirming(true);

    if (transactionMode === "rental_checkout") {
      const message = "Rental check-out requires a rental and patient context. Use the Rentals workflow.";
      setConfirming(false);
      setShowConfirmation(false);
      setTransactionResult({
        success: false,
        transactionId: "",
        inventoryItemId: selectedItem.id,
        productName: selectedItem.name,
        quantityBefore: null,
        quantityChange: null,
        quantityAfter: null,
        status: "failed",
        message,
      });
      addRecentScan({
        barcode: lastScannedBarcode,
        productName: selectedItem.name,
        transaction: "rental_checkout",
        status: "failed",
        timestamp: Date.now(),
      });
      operationIdManagerRef.current.reset();
      pendingOperationIdRef.current = null;
      toast.error(message);
    } else if (transactionMode === "equipment_check_in") {
      let operationId = operationIdManagerRef.current.get();
      if (!operationId) {
        operationId = operationIdManagerRef.current.start();
      }
      pendingOperationIdRef.current = operationId;

      try {
        const result = await equipmentCheckInByBarcodeWorkflow({
          operationId,
          barcode: lastScannedBarcode,
          rawScan: lastRawScan,
          reason: "Scanner equipment check-in.",
        });

        setConfirming(false);
        setShowConfirmation(false);

        const success =
          result.status === "success" ||
          result.status === "duplicate_operation";

        setTransactionResult({
          success,
          transactionId: result.movementIds?.[0] ?? "",
          inventoryItemId: selectedItem.id,
          productName: selectedItem.name,
          quantityBefore: null,
          quantityChange: null,
          quantityAfter: null,
          status: result.status === "duplicate_operation" ? "duplicate" : result.status,
          message: success ? undefined : result.message,
        });

        addRecentScan({
          barcode: lastScannedBarcode,
          productName: selectedItem.name,
          transaction: "equipment_check_in",
          status: success ? "success" : "failed",
          timestamp: Date.now(),
        });

        operationIdManagerRef.current.complete();
        pendingOperationIdRef.current = null;

        if (success) {
          toast.success(
            result.status === "duplicate_operation"
              ? `${selectedItem.name}: Check-in already recorded`
              : `${selectedItem.name}: Checked in`
          );
        } else {
          toast.error(result.message || "Equipment check-in failed.");
        }
      } catch (error: unknown) {
        const retryable = isRetryableInventoryTransactionError(error);
        const errorCode = getInventoryTransactionErrorCode(error);
        const message =
          error instanceof Error ? error.message : "Equipment check-in failed.";

        setConfirming(false);
        setTransactionResult({
          success: false,
          transactionId: "",
          inventoryItemId: selectedItem.id,
          productName: selectedItem.name,
          quantityBefore: null,
          quantityChange: null,
          quantityAfter: null,
          status: "failed",
          message,
          errorCode,
          retryable,
        });

        if (retryable) {
          setShowConfirmation(true);
          toast.error(`${message} Retry will reuse the same operation.`);
          return;
        }

        operationIdManagerRef.current.complete();
        pendingOperationIdRef.current = null;
        setShowConfirmation(false);
        toast.error(message);
        return;
      }
    } else if (transactionMode === "receive" || transactionMode === "retail_sale") {
      // ── NEW DIRECT CALLABLE PATH (PHASE 1) ─────────────
      // Start an operationId if we don't already have one pending.
      // If we're retrying after a network failure, the existing operationId
      // is reused so the server can detect the duplicate.
      let operationId = operationIdManagerRef.current.get();
      if (!operationId) {
        operationId = operationIdManagerRef.current.start();
      }
      pendingOperationIdRef.current = operationId;

      const movementQuantity = parseInt(quantity, 10) || 1;
      const isRetailSale = transactionMode === "retail_sale";

      let movement;

      try {
        movement = await createInventoryMovement({
          operationId,
          barcode: lastScannedBarcode,
          quantity: movementQuantity,
          movementType: isRetailSale ? "retail_sale" : "receive",
          source: "scanner",
          reason: isRetailSale
            ? "Inventory scanner retail sale."
            : "Inventory scanner receive.",
          metadata: {
            rawScan: lastRawScan || "",
            scannerSource: "tera_hid_scanner",
          },
        });
      } catch (error: unknown) {
        const retryable = isRetryableInventoryTransactionError(error);
        const errorCode = getInventoryTransactionErrorCode(error);
        const message =
          error instanceof Error ? error.message : "Transaction failed.";

        setConfirming(false);

        setTransactionResult({
          success: false,
          transactionId: "",
          inventoryItemId: selectedItem.id,
          productName: selectedItem.name,
          quantityBefore: null,
          quantityChange: null,
          quantityAfter: null,
          status: "failed",
          message,
          errorCode,
          retryable,
        });

        if (retryable) {
          setShowConfirmation(true);
          toast.error(`${message} Retry will reuse the same operation.`);
          return;
        }

        operationIdManagerRef.current.complete();
        pendingOperationIdRef.current = null;
        setShowConfirmation(false);
        toast.error(message);
        return;
      }

      // Clear confirming state
      setConfirming(false);
      setShowConfirmation(false);

      switch (movement.status) {
          case "success":
          case "duplicate_operation": {
            // Build a TransactionResult from the discriminated response
            const txResult: TransactionResult = {
              success: true,
              transactionId: movement.movementId ?? "",
              inventoryItemId: movement.inventoryItemId ?? selectedItem.id,
              productName: selectedItem.name,
              quantityBefore: movement.quantityBefore ?? null,
              quantityChange: movement.quantityDelta ?? (isRetailSale ? -movementQuantity : movementQuantity),
              quantityAfter: movement.quantityAfter ?? null,
              status: movement.status === "success" ? "success" : "duplicate",
            };
            setTransactionResult(txResult);

            addRecentScan({
              barcode: lastScannedBarcode,
              productName: selectedItem.name,
              transaction: transactionMode,
              status: "success",
              timestamp: Date.now(),
            });

            toast.success(
              movement.status === "success"
                ? `${selectedItem.name}: ${isRetailSale ? "Retail sale recorded" : "Received"}`
                : `${selectedItem.name}: ${isRetailSale ? "Retail sale already recorded" : "Receive already recorded"}`
            );
            break;
          }
          case "not_found": {
            setTransactionResult({
              success: false,
              transactionId: "",
              inventoryItemId: null,
              productName: null,
              quantityBefore: null,
              quantityChange: null,
              quantityAfter: null,
              status: "not_found",
              message: `Barcode ${lastScannedBarcode} not found in inventory.`,
            });

            addRecentScan({
              barcode: lastScannedBarcode,
              productName: null,
              transaction: transactionMode,
              status: "not_found",
              timestamp: Date.now(),
            });

            toast.error("Barcode not found in inventory.");
            break;
          }
          case "ambiguous": {
            setTransactionResult({
              success: false,
              transactionId: "",
              inventoryItemId: null,
              productName: null,
              quantityBefore: null,
              quantityChange: null,
              quantityAfter: null,
              status: "duplicate",
              message: `Barcode matches ${movement.matches?.length ?? 0} items. Select one and try again.`,
            });

            addRecentScan({
              barcode: lastScannedBarcode,
              productName: null,
              transaction: transactionMode,
              status: "duplicate",
              timestamp: Date.now(),
            });

            toast.error("Duplicate barcode match.");
            break;
          }
          case "invalid":
          case "permission_denied":
          default: {
            const message = movement.message || "Transaction failed.";

            setTransactionResult({
              success: false,
              transactionId: "",
              inventoryItemId: null,
              productName: null,
              quantityBefore: null,
              quantityChange: null,
              quantityAfter: null,
              status: "failed",
              message,
            });

            addRecentScan({
              barcode: lastScannedBarcode,
              productName: null,
              transaction: transactionMode,
              status: "failed",
              timestamp: Date.now(),
            });

            toast.error(message);
            break;
          }
        }

      operationIdManagerRef.current.complete();
      pendingOperationIdRef.current = null;
    } else {
      // Issue, Cycle Count, and Transfer share the same logical-operation
      // lifecycle as Receive: generate once and retain across uncertain retries.
      let operationId = operationIdManagerRef.current.get();

      if (!operationId) {
        operationId = operationIdManagerRef.current.start();
      }

      pendingOperationIdRef.current = operationId;

      const result = await executeTransaction(
        transactionMode as "issue" | "cycle_count" | "transfer",
        {
          barcode: lastScannedBarcode,
          operationId,
          quantity: parseInt(quantity, 10),
          toLocation:
            transactionMode === "transfer" ? toLocation : undefined,
          source: "tera_hid_scanner",
          rawScan: lastRawScan,
        },
      );

      setTransactionResult(result);
      setConfirming(false);

      if (result.retryable) {
        // The server may have committed even though the response was lost.
        // Keep the confirmation and operationId alive so retry is idempotent.
        setShowConfirmation(true);

        toast.error(
          `${result.message || "Transaction failed."} Retry will reuse the same operation.`,
        );

        return;
      }

      // A definitive response ends this logical operation.
      operationIdManagerRef.current.complete();
      pendingOperationIdRef.current = null;
      setShowConfirmation(false);

      addRecentScan({
        barcode: lastScannedBarcode,
        productName: selectedItem.name,
        transaction: transactionMode,
        status: result.success ? "success" : "failed",
        timestamp: Date.now(),
      });

      if (result.success) {
        toast.success(
          `${selectedItem.name}: ${
            transactionMode === "issue"
              ? "Issued"
              : transactionMode === "cycle_count"
                ? "Counted"
                : "Transferred"
          }`,
        );
      } else {
        toast.error(result.message || "Transaction failed.");
      }
    }

    // Clear transaction result after 10 seconds
    setTimeout(() => setTransactionResult(null), 10000);

    // Refocus scanner after mutation
    refocusScanner();
  }, [
    addRecentScan,
    confirming,
    executeTransaction,
    lastScannedBarcode,
    lastRawScan,
    quantity,
    refocusScanner,
    selectedItem,
    toLocation,
    transactionMode,
  ]);

  const handleModeChange = useCallback((mode: TransactionMode) => {
    setTransactionMode(mode);
    setLookupState("idle");
    setSelectedItem(null);
    setMatchedFields([]);
    setDuplicateMatches([]);
    setUnknownBarcode(false);
    setShowConfirmation(false);
    setTransactionResult(null);
    setLookupError(null);
    setDiagnosticData(null);
    processingRef.current = false;
    operationIdManagerRef.current.reset();
    pendingOperationIdRef.current = null;
    resetTx();
  }, [resetTx]);

  const toggleDiagnostics = useCallback(() => {
    diagnosticToggleRef.current = !diagnosticToggleRef.current;
    setShowDiagnostics(diagnosticToggleRef.current);
  }, []);

  if (authLoading) {
    return (
      <main className={`${glass.page}`}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className={typography.bodyMuted}>Loading...</p>
        </div>
      </main>
    );
  }

  if (!canWrite) {
    return (
      <main className={`${glass.page} ${tiles.alert}`}>
        <div className="flex min-h-[60vh] items-center justify-center">
          Scanner access denied.
        </div>
      </main>
    );
  }

  const isReceive = transactionMode === "receive";
  const isRetailSale = transactionMode === "retail_sale";

  return (
    <main className={`${glass.page} relative min-h-screen`}>
      <div className={glass.shell}>
        {/* Page header */}
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className="flex items-start gap-4">
            <div className={tiles.compact}>
              <ScanLine className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={typography.pageTitle}>Barcode Scanner</h1>
              <p className={`mt-2 ${typography.bodyMuted}`}>
                Scan barcodes to look up inventory, receive stock, issue items,
                perform cycle counts, or transfer between locations.
              </p>
              <div className={`mt-3 inline-flex items-center gap-2 ${tiles.system}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Tera HID scanner detected — ready
              </div>
            </div>
            {/* Diagnostic toggle — only in development */}
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={toggleDiagnostics}
                className={`${buttons.secondary} flex items-center gap-2 text-xs`}
                title="Toggle diagnostic panel"
              >
                <Bug className="h-4 w-4" />
                Diagnostics
              </button>
            )}
          </div>
        </section>

        {/* Diagnostic panel — development only */}
        {showDiagnostics && diagnosticData && process.env.NODE_ENV === "development" && (
          <section className={`${glass.panel} border border-yellow-500/30 p-4`}>
            <div className="mb-2 flex items-center gap-2">
              <Bug className="h-4 w-4 text-yellow-400" />
              <h2 className={`${typography.sectionTitle} text-yellow-300`}>
                Scan Diagnostics
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
              <div>
                <span className="text-gray-500">Raw scan:</span>
                <span className="ml-2 text-white">{diagnosticData.rawScan}</span>
              </div>
              <div>
                <span className="text-gray-500">Normalized:</span>
                <span className="ml-2 text-white">{diagnosticData.normalizedScan}</span>
              </div>
              <div>
                <span className="text-gray-500">Response time:</span>
                <span className="ml-2 text-white">{diagnosticData.responseTimeMs}ms</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className="ml-2 text-white">{diagnosticData.lookupStatus}</span>
              </div>
              <div>
                <span className="text-gray-500">Matched field:</span>
                <span className="ml-2 text-white">{diagnosticData.matchedField ?? "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">Doc ID:</span>
                <span className="ml-2 text-white">{diagnosticData.matchedDocId ?? "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">Auth UID:</span>
                <span className="ml-2 text-white">{diagnosticData.authUid ?? "-"}</span>
              </div>
            </div>
          </section>
        )}

        {/* Transaction mode selector */}
        <section className={`${glass.panel} p-4 sm:p-5`}>
          <label className={`${typography.bodyStrong} mb-3 block`}>
            Transaction Type
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.entries(TRANSACTION_LABELS) as [TransactionMode, string][]).map(
              ([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  className={`${buttons.secondary} ${
                    transactionMode === mode
                      ? "ring-2 ring-[var(--color-accent)] bg-[var(--color-accent)]/10"
                      : ""
                  } flex items-center gap-2 px-3 py-2 text-sm`}
                >
                  {TRANSACTION_ICONS[mode]}
                  <span className="truncate">{label}</span>
                </button>
              ),
            )}
          </div>
        </section>

        {/* Barcode scanner input */}
        <BarcodeScannerInput
          ref={scannerRef}
          onScan={handleScan}
          showStatus={true}
          showSubmitButton={true}
          autoFocus={true}
          audioFeedback={false}
          placeholder="Scan or type barcode..."
        />

        {/* Lookup result area */}
        <section className={`${glass.panel} min-h-[200px] p-4 sm:p-5`}>
          {lookupState === "idle" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ScanLine className="mb-3 h-12 w-12 text-gray-500" />
              <p className={typography.bodyMuted}>
                Scan a barcode to begin
              </p>
              <p className={`mt-2 ${typography.smallMuted} max-w-md`}>
                The scanner input above is ready. Point your Tera scanner at a
                barcode and pull the trigger.
              </p>
            </div>
          )}

          {lookupState === "scanning" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
              <p className={typography.bodyMuted}>Looking up barcode...</p>
            </div>
          )}

          {unknownBarcode && lookupState === "not_found" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle className="mb-3 h-12 w-12 text-red-400" />
              <p className={`${typography.bodyStrong} text-red-400`}>
                Barcode Not Found
              </p>
              <p className={`mt-2 ${typography.bodyMuted} max-w-md`}>
                No inventory item matches{" "}
                <code className="rounded bg-gray-800 px-2 py-0.5 font-mono text-sm">
                  {lastScannedBarcode}
                </code>
                . The barcode was recorded in scan history but no inventory
                changes were made.
              </p>
              {lookupError && (
                <p className="mt-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {lookupError}
                </p>
              )}
            </div>
          )}

          {lookupState === "duplicate" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-300">
                    Multiple items match this barcode
                  </p>
                  <p className={`mt-1 ${typography.bodyMuted}`}>
                    The barcode{" "}
                    <code className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-sm">
                      {lastScannedBarcode}
                    </code>{" "}
                    matched {duplicateMatches.length} inventory items. Select the
                    correct one or refine the scan.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {duplicateMatches.map((match, index) => (
                  <button
                    key={`${match.item.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedItem(match.item);
                      setMatchedFields(match.matchedFields);
                      setDuplicateMatches([]);
                      setLookupState("found");
                      if (transactionMode !== "lookup") {
                        setShowConfirmation(true);
                      }
                    }}
                    className={`${glass.panel} w-full p-4 text-left transition hover:bg-gray-800/50`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold">{match.item.name || "Unnamed item"}</p>
                      <MatchedFieldsList fields={match.matchedFields} />
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${typography.bodyMuted}`}>
                      <span>SKU: {match.item.sku || "-"}</span>
                      <span>Category: {match.item.category || "-"}</span>
                      <span>Location: {match.item.locationName || "-"}</span>
                      <span>Qty: {match.item.quantityOnHand ?? 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedItem && lookupState === "found" && (
            <div className="space-y-4">
              {/* Product match card */}
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <p className="font-semibold text-green-300">
                    Product Found
                  </p>
                </div>

                {/* Matched fields display */}
                {matchedFields.length > 0 && (
                  <div className="mb-4">
                    <MatchedFieldsList fields={matchedFields} />
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-lg font-bold">{selectedItem.name || "Unnamed Item"}</p>
                    <p className={`mt-1 ${typography.bodyMuted}`}>
                      {selectedItem.manufacturer || "Unknown manufacturer"}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>SKU:</span>
                      <span>{selectedItem.sku || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>Category:</span>
                      <span>{selectedItem.category || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>Location:</span>
                      <span>{selectedItem.locationName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>Current Qty:</span>
                      <span className="font-semibold">
                        {selectedItem.quantityOnHand ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>Available:</span>
                      <span className="font-semibold">
                        {selectedItem.available ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>Status:</span>
                      <span>{selectedItem.status || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={typography.bodyMuted}>Lifecycle:</span>
                      <span>{selectedItem.lifecycleStatus || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Receive warning banner */}
              {isReceive && selectedItem && lookupState === "found" && !showConfirmation && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-semibold text-amber-300">
                      Receiving inventory will increase on-hand quantity.
                    </p>
                    <p className={`mt-1 text-sm ${typography.bodyMuted}`}>
                      Current: {selectedItem.quantityOnHand} → After: {selectedItem.quantityOnHand + Math.max(1, parseInt(quantity, 10) || 1)}
                    </p>
                  </div>
                </div>
              )}

              {/* Confirmation form for mutations */}
              {showConfirmation && transactionMode !== "lookup" && (
                <div className={`${glass.inset} space-y-4 p-4`}>
                  <p className="font-semibold">
                    Confirm {TRANSACTION_LABELS[transactionMode]}
                  </p>

                  {transactionMode === "transfer" && (
                    <div>
                      <label className={typography.bodyStrong}>Destination Location</label>
                      <input
                        type="text"
                        value={toLocation}
                        onChange={(e) => setToLocation(e.target.value)}
                        className={`${glass.input} mt-1 w-full`}
                        placeholder="e.g., Warehouse B, Shelf 4"
                      />
                    </div>
                  )}

                  {(isReceive || isRetailSale || transactionMode === "issue" || transactionMode === "cycle_count") && (
                    <div>
                      <label className={typography.bodyStrong}>
                        {transactionMode === "cycle_count" ? "Actual Count" : "Quantity"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className={`${glass.input} mt-1 w-full`}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleConfirmTransaction}
                      disabled={txLoading || confirming || (transactionMode === "transfer" && !toLocation.trim())}
                      className={`${buttons.primary} flex-1`}
                    >
                      {confirming ? "Processing..." : `Confirm ${TRANSACTION_LABELS[transactionMode]}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfirmation(false);
                        setLookupState("idle");
                        operationIdManagerRef.current.reset();
                        pendingOperationIdRef.current = null;
                        refocusScanner();
                      }}
                      className={buttons.secondary}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction result */}
              {transactionResult && (
                <div
                  className={`rounded-lg border p-4 ${
                    transactionResult.success
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {transactionResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400" />
                    )}
                    <p
                      className={`font-semibold ${
                        transactionResult.success ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {transactionResult.success ? "Transaction Complete" : "Transaction Failed"}
                    </p>
                  </div>
                  {transactionResult.success && transactionResult.quantityBefore !== null && (
                    <div className={`mt-2 grid grid-cols-3 gap-3 text-sm ${typography.bodyMuted}`}>
                      <div>
                        <span>Before:</span>
                        <span className="ml-1 font-semibold">
                          {transactionResult.quantityBefore}
                        </span>
                      </div>
                      <div>
                        <span>Change:</span>
                        <span className="ml-1 font-semibold">
                          {transactionResult.quantityChange ?? 0 > 0
                            ? `+${transactionResult.quantityChange}`
                            : transactionResult.quantityChange}
                        </span>
                      </div>
                      <div>
                        <span>After:</span>
                        <span className="ml-1 font-semibold">
                          {transactionResult.quantityAfter}
                        </span>
                      </div>
                    </div>
                  )}
                  {!transactionResult.success && transactionResult.message && (
                    <p className={`mt-2 text-sm ${typography.bodyMuted}`}>
                      {transactionResult.message}
                    </p>
                  )}
                </div>
              )}

              {/* Lookup-only mode hint */}
              {transactionMode === "lookup" && selectedItem && (
                <p className={`text-sm ${typography.smallMuted}`}>
                  Lookup only — no inventory changes were made. Select a
                  transaction type above to perform an action.
                </p>
              )}
            </div>
          )}

          {txError && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-300">{txError}</p>
            </div>
          )}
        </section>

        {/* Recent scans */}
        {recentScans.length > 0 && (
          <section className={`${glass.panel} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              <h2 className={typography.sectionTitle}>Recent Scans</h2>
            </div>
            <div className="max-h-[300px] space-y-1 overflow-y-auto">
              {recentScans.map((scan, index) => (
                <div
                  key={`${scan.barcode}-${scan.timestamp}-${index}`}
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-gray-800/30"
                >
                  {scan.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  ) : scan.status === "not_found" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-gray-500" />
                  ) : scan.status === "duplicate" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-yellow-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <code className="font-mono text-xs">{scan.barcode}</code>
                  <span className={`${typography.bodyMuted} truncate`}>
                    {scan.productName || "Unknown"}
                  </span>
                  <span className={`ml-auto ${typography.smallMuted}`}>
                    {TRANSACTION_LABELS[scan.transaction]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
