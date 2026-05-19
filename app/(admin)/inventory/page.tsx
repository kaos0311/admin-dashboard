"use client";

import { useMemo, useState } from "react";

import toast from "react-hot-toast";

import BarcodeScannerModal from "@/app/components/barcode/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";

import { normalizeBarcode } from "@/lib/barcode";

import { InventoryBatchActions } from "./components/InventoryBatchActions";
import { InventoryEmptyState } from "./components/InventoryEmptyState";
import { InventoryFilters } from "./components/InventoryFilters";
import { InventoryForm } from "./components/InventoryForm";
import { InventoryHeader } from "./components/InventoryHeader";
import { InventoryLoadingState } from "./components/InventoryLoadingState";
import { InventoryStats } from "./components/InventoryStats";
import { InventoryTable } from "./components/InventoryTable";

import { useInventoryActions } from "./hooks/useInventoryActions";
import { useInventoryData } from "./hooks/useInventoryData";
import { useInventoryFilters } from "./hooks/useInventoryFilters";
import { useInventoryForm } from "./hooks/useInventoryForm";
import { useInventorySelection } from "./hooks/useInventorySelection";
import { inventoryGlass } from "./styles/inventoryGlass";

<section className={inventoryGlass.panel}></section>
import type { ScanTarget } from "./lib/inventoryTypes";

export default function InventoryPage() {
  const {
    loading: authLoading,
    isAdmin,
    isStaff,
  } = useAuthRole();

  const canRead = isAdmin || isStaff;
  const canWrite = isAdmin || isStaff;

  const [refreshKey, setRefreshKey] = useState(0);

  const [saving, setSaving] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [scanTarget, setScanTarget] =
    useState<ScanTarget>(null);

  const {
    items,
    loading,
    lastLoadedAt,
  } = useInventoryData({
    authLoading,
    canRead,
    refreshKey,
  });

  const {
    form,
    updateForm,
    resetForm,
    editItem,
  } = useInventoryForm();

  const {
    search,
    setSearch,

    statusFilter,
    setStatusFilter,

    lifecycleFilter,
    setLifecycleFilter,

    alertFilter,
    setAlertFilter,

    sortKey,
    sortDirection,
    handleSortChange,

    filteredItems,
    summary,

    resetFilters,
  } = useInventoryFilters(items);

  const {
    selectedIds,
    selectedVisibleCount,

    toggleSelected,
    toggleSelectAll,

    clearSelected,
    removeSelectedId,
  } = useInventorySelection(
    items,
    filteredItems
  );

  const {
    handleSubmit,
    handleSoftDelete,
    handleHardDelete,
    handleDiscontinue,
    handleBatchArchive,
    handleBatchDiscontinue,
  } = useInventoryActions({
    form,
    canWrite,
    isAdmin,
    selectedIds,
    resetForm,
    removeSelectedId,
    clearSelected,
    setSaving,
  });

  function openScanner(target: ScanTarget) {
    setScanTarget(target);
    setScannerOpen(true);
  }

  function handleScanDetected(code: string) {
    const clean = normalizeBarcode(code);

    if (scanTarget === "serial") {
      updateForm("serial", clean);
    } else if (scanTarget === "lotNumber") {
      updateForm("lotNumber", clean);
    } else {
      updateForm("barcode", clean);
    }

    toast.success("Scan captured.");
  }

  const selectedCount = useMemo(
    () => selectedIds.length,
    [selectedIds]
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="w-full max-w-none space-y-6">
        <InventoryHeader
          lastLoadedAt={lastLoadedAt}
          onResetFilters={resetFilters}
          onRefresh={() =>
            setRefreshKey((value) => value + 1)
          }
        />

        <InventoryStats
          totalItems={summary.totalItems}
          available={summary.available}
          lowStock={summary.lowStock}
          discontinued={summary.discontinued}
          serviceDue={summary.serviceDue}
          warrantyExpired={summary.warrantyExpired}
          totalValue={summary.totalValue}
        />

        <section className="grid gap-6 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <InventoryForm
            form={form}
            saving={saving}
            canWrite={canWrite}
            onSubmit={handleSubmit}
            onReset={resetForm}
            onUpdate={updateForm}
            onOpenScanner={openScanner}
          />

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Inventory Records
                </h2>

                <p className="text-sm text-slate-400">
                  {filteredItems.length.toLocaleString()} visible records
                </p>
              </div>

              <InventoryFilters
                search={search}
                statusFilter={statusFilter}
                lifecycleFilter={lifecycleFilter}
                alertFilter={alertFilter}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSearchChange={setSearch}
                onStatusFilterChange={setStatusFilter}
                onLifecycleFilterChange={
                  setLifecycleFilter
                }
                onAlertFilterChange={setAlertFilter}
                onSortChange={handleSortChange}
              />
            </div>

            <InventoryBatchActions
              selectedCount={selectedCount}
              selectedVisibleCount={
                selectedVisibleCount
              }
              onToggleSelectAll={
                toggleSelectAll
              }
              onBatchArchive={() =>
                void handleBatchArchive()
              }
              onBatchDiscontinue={() =>
                void handleBatchDiscontinue()
              }
            />

            {authLoading || loading ? (
              <InventoryLoadingState />
            ) : filteredItems.length === 0 ? (
              <InventoryEmptyState />
            ) : (
              <InventoryTable
                items={filteredItems}
                selectedIds={selectedIds}
                isAdmin={isAdmin}
                onToggleSelected={
                  toggleSelected
                }
                onEdit={editItem}
                onDiscontinue={(item) =>
                  void handleDiscontinue(item)
                }
                onArchive={(item) =>
                  void handleSoftDelete(item)
                }
                onDelete={(item) =>
                  void handleHardDelete(item)
                }
              />
            )}
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScanTarget(null);
        }}
        onDetected={handleScanDetected}
      />
    </main>
  );
}