"use client";

import { useMemo, useState } from "react";

import {
  Boxes,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import toast from "react-hot-toast";

import { colors, glass, typography } from "@/theme";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
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

import type { ScanTarget } from "./lib/inventoryTypes";

export default function InventoryPage() {
  const {
    loading: authLoading,
    isAdmin,
    isStaff,
  } = useAuthRole();

  const canRead =
    isAdmin || isStaff;

  const canWrite =
    isAdmin || isStaff;

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [saving, setSaving] =
    useState(false);

  const [scannerOpen, setScannerOpen] =
    useState(false);

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

  function openScanner(
    target: ScanTarget
  ) {
    setScanTarget(target);
    setScannerOpen(true);
  }

  function handleScanDetected(
    code: string
  ) {
    const clean =
      normalizeBarcode(code);

    switch (scanTarget) {
      case "serial":
        updateForm(
          "serial",
          clean
        );
        break;

      case "lotNumber":
        updateForm(
          "lotNumber",
          clean
        );
        break;

      default:
        updateForm(
          "barcode",
          clean
        );
        break;
    }

    toast.success(
      "Barcode scan captured."
    );
  }

  const selectedCount =
    useMemo(() => {
      return selectedIds.length;
    }, [selectedIds]);

  function handleRefresh() {
    setRefreshKey(
      (current) =>
        current + 1
    );
  }

  function handleScannerClose() {
    setScannerOpen(false);
    setScanTarget(null);
  }

  /*
  |--------------------------------------------------------------------------
  | Permission Gate
  |--------------------------------------------------------------------------
  */

  if (
    !authLoading &&
    !canRead
  ) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.18)]">
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
        <section className={glass.panel}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                <ShieldCheck className="h-3.5 w-3.5" />

                Inventory Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Inventory Command
                  Center
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Operational inventory
                  management for
                  lifecycle tracking,
                  warranty monitoring,
                  service due alerts,
                  batch actions,
                  barcode intake,
                  discontinuation, and
                  stock oversight.
                  Because eventually
                  someone loses a serial
                  number and pretends it
                  was never there.
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className={"flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl"}>
                  <Boxes className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      Inventory System
                    </p>

                    <span className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />

                      Online
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Barcode +
                    lifecycle tracking
                    active
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                <ScanLine className="h-3.5 w-3.5 text-sky-200" />

                Scanner integration
                operational
              </div>
            </div>
          </div>
        </section>

        <InventoryHeader
          lastLoadedAt={
            lastLoadedAt
          }
          onResetFilters={
            resetFilters
          }
          onRefresh={
            handleRefresh
          }
        />

        <InventoryStats
          totalItems={
            summary.totalItems
          }
          available={
            summary.available
          }
          lowStock={
            summary.lowStock
          }
          discontinued={
            summary.discontinued
          }
          serviceDue={
            summary.serviceDue
          }
          warrantyExpired={
            summary.warrantyExpired
          }
          totalValue={
            summary.totalValue
          }
        />

        <section className="grid gap-6 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <InventoryForm
            form={form}
            saving={saving}
            canWrite={canWrite}
            onSubmit={
              handleSubmit
            }
            onReset={
              resetForm
            }
            onUpdate={
              updateForm
            }
            onOpenScanner={
              openScanner
            }
          />

          <section className={glass.panel}>
            <div className={colors.grid} />

            <div className="relative p-6">
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className={typography.sectionTitle}>
                    Inventory Records
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {filteredItems.length.toLocaleString()} visible records
                  </p>
                </div>

                <InventoryFilters
                  search={search}
                  statusFilter={
                    statusFilter
                  }
                  lifecycleFilter={
                    lifecycleFilter
                  }
                  alertFilter={
                    alertFilter
                  }
                  sortKey={sortKey}
                  sortDirection={
                    sortDirection
                  }
                  onSearchChange={
                    setSearch
                  }
                  onStatusFilterChange={
                    setStatusFilter
                  }
                  onLifecycleFilterChange={
                    setLifecycleFilter
                  }
                  onAlertFilterChange={
                    setAlertFilter
                  }
                  onSortChange={
                    handleSortChange
                  }
                />
              </div>

              <InventoryBatchActions
                selectedCount={
                  selectedCount
                }
                selectedVisibleCount={
                  selectedVisibleCount
                }
                onToggleSelectAll={
                  toggleSelectAll
                }
                onBatchArchive={() => {
                  void handleBatchArchive();
                }}
                onBatchDiscontinue={() => {
                  void handleBatchDiscontinue();
                }}
              />

              <div className="mt-5">
                {authLoading ||
                loading ? (
                  <InventoryLoadingState />
                ) : filteredItems.length ===
                  0 ? (
                  <InventoryEmptyState />
                ) : (
                  <InventoryTable
                    items={
                      filteredItems
                    }
                    selectedIds={
                      selectedIds
                    }
                    isAdmin={
                      isAdmin
                    }
                    onToggleSelected={
                      toggleSelected
                    }
                    onEdit={editItem}
                    onDiscontinue={(
                      item
                    ) => {
                      void handleDiscontinue(
                        item
                      );
                    }}
                    onArchive={(
                      item
                    ) => {
                      void handleSoftDelete(
                        item
                      );
                    }}
                    onDelete={(
                      item
                    ) => {
                      void handleHardDelete(
                        item
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={
          handleScannerClose
        }
        onDetected={
          handleScanDetected
        }
      />
    </main>
  );
}





