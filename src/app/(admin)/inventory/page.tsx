"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Building2,
  HeartHandshake,
  PackageCheck,
} from "lucide-react";

import toast from "react-hot-toast";

import { InventoryRepository } from "@/repositories/firestore/inventory.repository";
import { buttons, colors, glass, tiles, typography } from "@/theme";
import {
  AssetRecordsRouteTile,
  RentalPropertyRouteTile,
} from "./components/InventoryRouteTiles";
import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";

import { normalizeBarcode } from "@/lib/barcode";
import { auth, db } from "@/lib/firebase";
import { hasPermission } from "@/lib/permissions/roles";

import { InventoryEmptyState } from "./components/InventoryEmptyState";
import { InventoryDataQualityPanel } from "./components/InventoryDataQualityPanel";
import { InventoryFilters } from "./components/InventoryFilters";
import { InventoryForm } from "./components/InventoryForm";
import { InventoryHeader } from "./components/InventoryHeader";
import { InventoryHero } from "./components/InventoryHero";
import { InventoryLoadingState } from "./components/InventoryLoadingState";
import { type InventoryStatKey, InventoryStats } from "./components/InventoryStats";
import { InventoryStatsDrilldownModal } from "./components/InventoryStatsDrilldownModal";
import { InventoryBatchActions } from "./components/InventoryBatchActions";
import { InventoryTable } from "./components/InventoryTable";
import { JarvisNoticeModal } from "./components/JarvisNoticeModal";
import { type ScanAssignmentChoice, ScanAssignmentModal } from "./components/ScanAssignmentModal";
import { ScanSuccessModal } from "./components/ScanSuccessModal";

import { useInventoryActions } from "./hooks/useInventoryActions";
import { useInventoryData } from "./hooks/useInventoryData";
import { useInventoryFilters } from "./hooks/useInventoryFilters";
import { useInventoryForm } from "./hooks/useInventoryForm";
import { useInventorySelection } from "./hooks/useInventorySelection";
import { useInventorySettings } from "./hooks/useInventorySettings";

import { isActiveAssetRecord } from "./lib/assetRecords";
import { isLowStock, isServiceDue, isWarrantyExpired } from "./lib/inventoryAlerts";
import { buildSearchText } from "./lib/inventoryNormalize";
import type { InventoryItem, ScanTarget } from "./lib/inventoryTypes";
import { isRentalProperty } from "./lib/rentalProperty";
import type { PatientIndex } from "../reports/patients/lib/patientTypes";
import { PickupReturnArchivePanel } from "./components/PickupReturnArchivePanel";
import type {
  DeceasedPickupCandidate,
  DeceasedPatientSummary,
} from "@/services/inventory/pickup-review.types";

import {
  mapPatientForPickup,
  buildDeceasedPickupCandidates,
} from "@/services/inventory/pickup-review.service";
import { checkInDeceasedPickup } from "@/services/inventory/inventory-return.service";
import { identifyInventoryProduct } from "@/services/inventory/inventory-jarvis.service";

type InventoryView = "browse" | "dataQuality";

export default function InventoryPage() {
  const {
    loading: authLoading,
    isAdmin,
    role,
    canAccessCommandCenter,
  } = useAuthRole();

  const canRead =
    canAccessCommandCenter &&
    hasPermission(role, "inventory:read");

  const canWrite =
    canAccessCommandCenter &&
    hasPermission(role, "inventory:write");

  const [refreshKey, setRefreshKey] = useState(0);

  const [saving, setSaving] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);

  const [deceasedPatients, setDeceasedPatients] = useState<DeceasedPatientSummary[]>([]);

  const [checkingInItemId, setCheckingInItemId] = useState("");

  const [selectedStatKey, setSelectedStatKey] = useState<InventoryStatKey | null>(null);

  const [jarvisIdentifying, setJarvisIdentifying] = useState(false);

  const [inventoryView, setInventoryView] = useState<InventoryView>("browse");

  const [scanSuccess, setScanSuccess] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [jarvisNotice, setJarvisNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [pendingScan, setPendingScan] = useState<{ code: string; target: ScanTarget } | null>(null);

  const inventoryThresholds = useInventorySettings();

  const {
    items,
    loading,
    lastLoadedAt,
  } = useInventoryData({
    authLoading,
    canRead,
    refreshKey,
  });

  useEffect(() => {
    if (authLoading || !canRead) {
      setDeceasedPatients([]);
      return;
    }

    const unsubscribe = InventoryRepository.subscribeToPatients(
      2500,
      (patientDocs) => {
        setDeceasedPatients(
          patientDocs.flatMap((patientDoc) => {
            const patient = mapPatientForPickup(
              patientDoc.id,
              patientDoc.data as Partial<PatientIndex> as Record<string, unknown>,
            );

            return patient ? [patient] : [];
          }),
        );
      },
      (error) => {
        console.error("LOAD DECEASED PATIENT PICKUP CHECK ERROR:", error);
        toast.error("Could not load deceased patient pickup checks.");
        setDeceasedPatients([]);
      },
    );

    return unsubscribe;
  }, [authLoading, canRead]);

  const {
    form,
    updateForm,
    resetForm,
    editItem,
    syncStockFields,
  } = useInventoryForm();

  // ── Sync stock fields when the actively edited item changes via real-time snapshot ──
  useEffect(() => {
    if (!form.id) return;

    const liveItem = items.find((item) => item.id === form.id);
    if (!liveItem) return;

    syncStockFields(liveItem);
  }, [items, form.id, syncStockFields]);

  const {
    search,
    setSearch,

    statusFilter,
    setStatusFilter,

    lifecycleFilter,
    setLifecycleFilter,

    alertFilter,
    setAlertFilter,

    locationFilter,
    setLocationFilter,
    locationOptions,

    serializationFilter,
    setSerializationFilter,

    sortKey,
    sortDirection,
    handleSortChange,

    filteredItems,
    summary,

    resetFilters,
  } = useInventoryFilters(items, inventoryThresholds);

  const {
    selectedIds,
    selectedVisibleCount,
    toggleSelected,
    toggleSelectAll,
    clearSelected,
    removeSelectedId,
  } = useInventorySelection(
    items,
    filteredItems,
    canWrite,
  );

  const {
    handleSubmit,
    handleScanMovement,
    handleSoftDelete,
    handleHardDelete,
    handleDiscontinue,
    handleBatchArchive,
    handleBatchDiscontinue,
  } = useInventoryActions({
    form,
    items,
    canWrite,
    isAdmin,
    selectedIds,
    resetForm,
    removeSelectedId,
    clearSelected,
    setSaving,
  });

  const deceasedPickupCandidates = useMemo(
    () => buildDeceasedPickupCandidates(items, deceasedPatients),
    [deceasedPatients, items],
  );

  async function handleCheckInDeceasedPickup(candidate: DeceasedPickupCandidate) {
    if (!canWrite) {
      toast.error("You do not have permission to check inventory back in.");
      return;
    }

    const { item, patient } = candidate;
    const patientKey = item.patientKey || item.patientId || patient.id;

    if (!patientKey) {
      toast.error("This item is missing a patient key, so it cannot update the patient record.");
      return;
    }

    const confirmed = window.confirm(
      `Check "${item.name}" back into inventory from ${patient.fullName}? This will archive the matching equipment in the patient record and return the item to available inventory.`,
    );

    if (!confirmed) return;

    setCheckingInItemId(item.id);

    try {
      await checkInDeceasedPickup(candidate, db, auth, buildSearchText);

      toast.success(`${item.name || "Equipment"} checked back into inventory.`);
    } catch (error) {
      console.error("DECEASED PATIENT PICKUP CHECK-IN ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Could not check equipment back in.");
    } finally {
      setCheckingInItemId("");
    }
  }

  function openScanner(target: ScanTarget) {
    setScanTarget(target);
    setScannerOpen(true);
  }

  function handleAssignmentConfirm(choice: ScanAssignmentChoice) {
    if (!pendingScan) return;

    const { code } = pendingScan;

    switch (choice) {
      case "lotNumber":
        updateForm("lotNumber", code);
        break;
      case "serial":
        updateForm("serial", code);
        break;
      case "barcodeSku":
        if (pendingScan.target === "lotNumber") {
          updateForm("lotNumber", code);
        } else {
          updateForm("barcode", code);
        }
        break;
      case "next":
        break;
      case "none":
      default:
        break;
    }

    setPendingScan(null);
    toast.success("Barcode scan captured.");
  }

  function handleScanDetected(code: string) {
    const clean = normalizeBarcode(code);

    switch (scanTarget) {
      case "serial":
      case "lotNumber":
      case null:
        setPendingScan({ code: clean, target: scanTarget });
        return;

      case "scanIn":
        void handleScanMovement(clean, "in").then((success) => {
          if (!success) return;

          setScanSuccess({
            title: "Scan In Complete",
            message: `${clean} was saved to inventory successfully.`,
          });
        });
        return;

      case "scanOut":
        void handleScanMovement(clean, "out", "rental").then((success) => {
          if (!success) return;

          setScanSuccess({
            title: "Scan Out Complete",
            message: `${clean} was removed from available inventory successfully.`,
          });
        });
        return;

      default:
        updateForm("barcode", clean);
        break;
    }

    toast.success("Barcode scan captured.");
  }

  const inventoryAutofillOptions = useMemo(() => {
    function unique(values: string[]) {
      return Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean)),
      )
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 250);
    }

    return {
      itemNames: unique(items.map((item) => item.name)),
      categories: unique(items.map((item) => item.category)),
      skus: unique(items.map((item) => item.sku)),
      hcpcs: unique(items.map((item) => item.hcpc)),
      manufacturers: unique(items.map((item) => item.manufacturer)),
      locations: unique(items.map((item) => item.locationName)),
    };
  }, [items]);

  const rentalPropertyCount = useMemo(
    () => filteredItems.filter(isRentalProperty).length,
    [filteredItems],
  );

  const assetRecordCount = useMemo(
    () => filteredItems.filter(isActiveAssetRecord).length,
    [filteredItems],
  );

  const statDrilldowns = useMemo(() => {
    const entries: Record<
      InventoryStatKey,
      {
        title: string;
        description: string;
        items: InventoryItem[];
      }
    > = {
      items: {
        title: "All Inventory Items",
        description: "Every inventory record currently loaded from the inventory pipeline.",
        items,
      },
      available: {
        title: "Available Products",
        description: "Products currently marked with an available inventory status.",
        items: items.filter((item) => item.status === "available"),
      },
      lowStock: {
        title: "Low Stock Products",
        description: "Products at or below the configured reorder threshold.",
        items: items.filter((item) => isLowStock(item, inventoryThresholds)),
      },
      discontinued: {
        title: "Discontinued Products",
        description: "Products currently marked as discontinued.",
        items: items.filter((item) => item.status === "discontinued"),
      },
      serviceDue: {
        title: "Service Due Products",
        description: "Products with a next service date due today or earlier.",
        items: items.filter(isServiceDue),
      },
      warrantyExpired: {
        title: "Warranty Expired Products",
        description: "Products with warranty end dates earlier than today.",
        items: items.filter(isWarrantyExpired),
      },
      value: {
        title: "Inventory Value Products",
        description: "Products included in the total inventory value calculation.",
        items: items.filter((item) => item.totalValue !== 0 || item.quantityOnHand > 0),
      },
    };

    return entries;
  }, [inventoryThresholds, items]);

  const selectedStatDrilldown = selectedStatKey
    ? statDrilldowns[selectedStatKey]
    : null;

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
  }

  function handleResetFilters() {
    resetFilters();
  }

  function handleScannerClose() {
    setScannerOpen(false);
    setScanTarget(null);
  }

  async function handleJarvisIdentifyCurrentItem() {
    if (!form.id) {
      toast.error("Select or save an inventory item before running Jarvis identify.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("You must be signed in to run Jarvis identify.");
      return;
    }

    setJarvisIdentifying(true);

    try {
      const result = await identifyInventoryProduct({
        currentUser,
        inventoryId: form.id,
        code: form.barcode || form.sku || form.serial,
      });

      if (!result.ok) {
        setJarvisNotice({
          title: "No Matching Product Found",
          message:
            "Jarvis is unable to find a matching product. The scan was kept for review so you can enter the product details manually.",
        });
        return;
      }

      if (result.product) {
        if (result.product.name) updateForm("name", result.product.name);
        if (result.product.category) updateForm("category", result.product.category);
        if (result.product.sku) updateForm("sku", result.product.sku);
        if (result.product.barcode) updateForm("barcode", result.product.barcode);
        if (result.product.manufacturer) updateForm("manufacturer", result.product.manufacturer);
        if (result.product.modelNumber) updateForm("modelNumber", result.product.modelNumber);
      }

      toast.success("Jarvis identified and updated the product record.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Jarvis identify failed.");
    } finally {
      setJarvisIdentifying(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Permission Gate
  |--------------------------------------------------------------------------
  */

  if (!authLoading && !canRead) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className={tiles.alert}>
            Inventory access denied.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <InventoryHero canWrite={canWrite} onOpenScanner={openScanner} />

        <InventoryHeader
          lastLoadedAt={lastLoadedAt}
          onResetFilters={handleResetFilters}
          onRefresh={handleRefresh}
        />

        <InventoryStats
          totalItems={summary.totalItems}
          available={summary.available}
          lowStock={summary.lowStock}
          discontinued={summary.discontinued}
          serviceDue={summary.serviceDue}
          warrantyExpired={summary.warrantyExpired}
          totalValue={summary.totalValue}
          onSelect={setSelectedStatKey}
        />

        <section className="space-y-6">
          <InventoryForm
            form={form}
            autofillOptions={inventoryAutofillOptions}
            saving={saving}
            canWrite={canWrite}
            onSubmit={handleSubmit}
            onReset={resetForm}
            onUpdate={updateForm}
            onOpenScanner={openScanner}
            onJarvisIdentify={() => {
              void handleJarvisIdentifyCurrentItem();
            }}
            jarvisIdentifying={jarvisIdentifying}
          />

          <section className={`${glass.panel} min-w-0 overflow-hidden`}>
            <div className={colors.grid} />

            <div className="relative p-4 sm:p-6">
              <div className="mb-5 space-y-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className={`${typography.sectionTitle} break-words`}>
                      Inventory Records
                    </h2>

                    <p className={`mt-2 ${typography.bodyMuted}`}>
                      {inventoryView === "browse"
                        ? `${filteredItems.length.toLocaleString()} visible records`
                        : `${items.length.toLocaleString()} loaded records analyzed`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setInventoryView("browse")}
                      className={inventoryView === "browse" ? buttons.primary : buttons.secondary}
                    >
                      Browse
                    </button>
                    <button
                      type="button"
                      onClick={() => setInventoryView("dataQuality")}
                      className={inventoryView === "dataQuality" ? buttons.primary : buttons.secondary}
                    >
                      Data Quality
                    </button>
                  </div>
                </div>

                {inventoryView === "browse" ? (
                  <InventoryFilters
                    search={search}
                    statusFilter={statusFilter}
                    lifecycleFilter={lifecycleFilter}
                    alertFilter={alertFilter}
                    locationFilter={locationFilter}
                    locationOptions={locationOptions}
                    serializationFilter={serializationFilter}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSearchChange={setSearch}
                    onStatusFilterChange={setStatusFilter}
                    onLifecycleFilterChange={setLifecycleFilter}
                    onAlertFilterChange={setAlertFilter}
                    onLocationFilterChange={setLocationFilter}
                    onSerializationFilterChange={setSerializationFilter}
                    onSortChange={handleSortChange}
                  />
                ) : null}
              </div>

              <div className="mt-5">
                {authLoading || loading ? (
                  <InventoryLoadingState />
                ) : inventoryView === "dataQuality" ? (
                  <InventoryDataQualityPanel
                    items={items}
                    canCleanup={isAdmin}
                    onOpenItem={(item) => {
                      editItem(item);
                      setInventoryView("browse");
                    }}
                    onCleanupApplied={handleRefresh}
                  />
                ) : filteredItems.length === 0 ? (
                  <InventoryEmptyState />
                ) : (
                  <div className="space-y-6">
                    <PickupReturnArchivePanel
                      candidates={deceasedPickupCandidates}
                      canWrite={canWrite}
                      checkingInItemId={checkingInItemId}
                      onCheckIn={(candidate) => {
                        void handleCheckInDeceasedPickup(candidate);
                      }}
                    />

                    <RentalPropertyRouteTile
                      visibleCount={rentalPropertyCount}
                    />

                    <AssetRecordsRouteTile
                      visibleCount={assetRecordCount}
                    />

                    {canWrite ? (
                      <InventoryBatchActions
                        selectedCount={selectedIds.length}
                        selectedVisibleCount={selectedVisibleCount}
                        onToggleSelectAll={toggleSelectAll}
                        onBatchDiscontinue={() => {
                          void handleBatchDiscontinue();
                        }}
                        onBatchArchive={() => {
                          void handleBatchArchive();
                        }}
                      />
                    ) : null}

                    <InventoryTable
                      items={filteredItems}
                      selectedIds={selectedIds}
                      canWrite={canWrite}
                      isAdmin={isAdmin}
                      thresholds={inventoryThresholds}
                      onToggleSelected={toggleSelected}
                      onEdit={editItem}
                      onDiscontinue={handleDiscontinue}
                      onArchive={handleSoftDelete}
                      onDelete={handleHardDelete}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={handleScannerClose}
        onDetected={handleScanDetected}
      />

      <InventoryStatsDrilldownModal
        open={Boolean(selectedStatDrilldown)}
        title={selectedStatDrilldown?.title ?? ""}
        description={selectedStatDrilldown?.description ?? ""}
        items={selectedStatDrilldown?.items ?? []}
        canWrite={canWrite}
        isAdmin={isAdmin}
        autofillOptions={inventoryAutofillOptions}
        onClose={() => setSelectedStatKey(null)}
      />

      <ScanAssignmentModal
        open={Boolean(pendingScan)}
        code={pendingScan?.code ?? ""}
        target={pendingScan?.target ?? null}
        saving={saving}
        onClose={() => setPendingScan(null)}
        onConfirm={handleAssignmentConfirm}
      />

      <ScanSuccessModal
        open={Boolean(scanSuccess)}
        title={scanSuccess?.title ?? ""}
        message={scanSuccess?.message ?? ""}
        onClose={() => setScanSuccess(null)}
      />

      <JarvisNoticeModal
        open={Boolean(jarvisNotice)}
        title={jarvisNotice?.title ?? ""}
        message={jarvisNotice?.message ?? ""}
        onClose={() => setJarvisNotice(null)}
      />
    </main>
  );
}
