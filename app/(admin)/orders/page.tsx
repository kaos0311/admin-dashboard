"use client";

import { useMemo, useState } from "react";

import { ClipboardList, Loader2, ShieldCheck, Truck } from "lucide-react";
import toast from "react-hot-toast";

import { colors, glass, typography } from "@/theme";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
import { normalizeBarcode } from "@/lib/barcode";

import { ImportPanel } from "./components/ImportPanel";
import { OrderModal } from "./components/OrderModal";
import { OrdersHeader } from "./components/OrdersHeader";
import { OrdersSummaryGrid } from "./components/OrdersSummaryGrid";
import { OrdersTable } from "./components/OrdersTable";
import { OrdersTabs } from "./components/OrdersTabs";
import { SmartCommandStrip } from "./components/SmartCommandStrip";
import { SmartFiltersPanel } from "./components/SmartFiltersPanel";

import { useOrderFilters } from "./hooks/useOrderFilters";
import { useOrderImport } from "./hooks/useOrderImport";
import { useOrderMutations } from "./hooks/useOrderMutations";
import { useOrders } from "./hooks/useOrders";

import { initialFormState } from "./lib/orderConstants";

import type { FilterTab, OrderFormState } from "./lib/orderTypes";

export default function OrdersPage() {
  const {
    orders,
    setOrders,
    loading,
    refreshing,
    loadingMore,
    tab,
    setTab,
    hasMore,
    loadOrders,
    summary,
    isAuthed,
  } = useOrders();

  const {
    search,
    setSearch,
    smartFilters,
    setSmartFilters,
    resetFilters,
    filterOptions,
    filteredOrders,
  } = useOrderFilters(orders);

  const {
    importType,
    setImportType,
    detectedImport,
    importing,
    importMessage,
    importInputRef,
    handleDetectImportFile,
    handleImportFile,
  } = useOrderImport();

  const {
    fillProductFromBarcode,
    createOrder,
    saveEditOrder,
    updateStatus,
    archiveOrder,
    restoreOrder,
  } = useOrderMutations({
    orders,
    setOrders,
    tab,
    loadOrders,
  });

  const [savingId, setSavingId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState<OrderFormState>(initialFormState);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OrderFormState>(initialFormState);

  const [scannerOpen, setScannerOpen] = useState(false);

  const tabs = useMemo<Array<{ key: FilterTab; label: string; count?: number }>>(
    () => [
      {
        key: "processing",
        label: "Processing",
        count: summary.processing,
      },
      {
        key: "ready",
        label: "Ready",
        count: summary.ready,
      },
      {
        key: "delivered",
        label: "Delivered",
        count: summary.delivered,
      },
      {
        key: "cancelled",
        label: "Cancelled",
        count: summary.cancelled,
      },
      {
        key: "archived",
        label: "Archived",
        count: summary.archived,
      },
      {
        key: "all",
        label: "All Loaded",
        count: orders.length,
      },
    ],
    [
      orders.length,
      summary.archived,
      summary.cancelled,
      summary.delivered,
      summary.processing,
      summary.ready,
    ]
  );

  function resetCreateForm() {
    setForm(initialFormState);
    setCreateError("");
  }

  function resetEditForm() {
    setEditForm(initialFormState);
    setEditError("");
    setEditingOrderId(null);
  }

  function handleCreateChange(field: keyof OrderFormState, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleEditChange(field: keyof OrderFormState, value: string) {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCreateModal() {
    resetCreateForm();
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creating) return;

    setShowCreateModal(false);
    resetCreateForm();
  }

  function openEditModal(orderId: string) {
    const order = orders.find((item) => item.id === orderId);

    if (!order) return;

    setEditingOrderId(order.id);
    setEditError("");

    setEditForm({
      patientName: order.patientName,
      patientAddress: order.patientAddress,
      productId: order.productId,
      productType: order.productType,
      purchaseCost: order.purchaseCost ? String(order.purchaseCost) : "",
      quantity: String(order.quantity || 1),
      barcode: order.barcode,
      phone: order.phone,
      facilityName: order.facilityName,
      status: order.status === "archived" ? "processing" : order.status,
      notes: order.notes,
    });

    setShowEditModal(true);
  }

  function closeEditModal() {
    if (editing) return;

    setShowEditModal(false);
    resetEditForm();
  }

  async function handleStatusUpdate(
    orderId: string,
    status: Parameters<typeof updateStatus>[1]
  ) {
    try {
      setSavingId(orderId);
      await updateStatus(orderId, status);
    } finally {
      setSavingId(null);
    }
  }

  async function handleArchive(orderId: string) {
    try {
      setSavingId(orderId);
      await archiveOrder(orderId);
    } finally {
      setSavingId(null);
    }
  }

  async function handleRestore(orderId: string) {
    try {
      setSavingId(orderId);
      await restoreOrder(orderId);
    } finally {
      setSavingId(null);
    }
  }

  if (!isAuthed && !loading) {
    return (
      <main
        className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
      >
        <div aria-hidden="true" className={colors.grid} />

        <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.18)]">
            Authentication required to access orders.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10`}>
        <section className={`${glass.panel} relative overflow-hidden`}>
          <div aria-hidden="true" className={colors.grid} />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                <ShieldCheck className="h-3.5 w-3.5" />
                Orders Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>Orders Command Center</h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Operational order management for routing, imports, inventory
                  matching, hospice review, barcode intake, smart filtering,
                  delivery tracking, and escalation monitoring. Because somebody
                  always forgets to assign a product and then acts surprised
                  when the warehouse catches fire.
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                  <Truck className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      Orders System
                    </p>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />
                      Active
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Smart routing + inventory matching online
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                <ClipboardList className="h-3.5 w-3.5 text-sky-200" />
                Operational order intelligence active
              </div>
            </div>
          </div>
        </section>

        <OrdersHeader
          loadedCount={orders.length}
          search={search}
          refreshing={refreshing}
          onSearchChange={setSearch}
          onRefresh={() => void loadOrders("refresh")}
          onCreate={openCreateModal}
        />

        <SmartCommandStrip
          needsReview={summary.needsReview}
          inventoryIssues={summary.inventoryIssues}
          hospiceRisks={summary.hospiceRisks}
          missingProduct={summary.missingProduct}
          archiveReady={summary.archiveReady}
          onReviewOnly={() =>
            setSmartFilters((prev) => ({
              ...prev,
              reviewOnly: true,
            }))
          }
          onInventoryOnly={() =>
            setSmartFilters((prev) => ({
              ...prev,
              inventoryOnly: true,
            }))
          }
          onHospiceOnly={() =>
            setSmartFilters((prev) => ({
              ...prev,
              hospiceRiskOnly: true,
            }))
          }
          onMissingProductOnly={() =>
            setSmartFilters((prev) => ({
              ...prev,
              missingProductOnly: true,
            }))
          }
          onArchiveReadyOnly={() =>
            setSmartFilters((prev) => ({
              ...prev,
              archiveReadyOnly: true,
            }))
          }
        />

        <ImportPanel
          importType={importType}
          detectedImport={detectedImport}
          importing={importing}
          importMessage={importMessage}
          importInputRef={importInputRef}
          onImportTypeChange={setImportType}
          onDetectFile={(file) => void handleDetectImportFile(file)}
          onImportFile={(file) => void handleImportFile(file)}
        />

        <OrdersSummaryGrid
          processing={summary.processing}
          ready={summary.ready}
          delivered={summary.delivered}
          cancelled={summary.cancelled}
          archived={summary.archived}
        />

        <SmartFiltersPanel
          filters={smartFilters}
          options={filterOptions}
          resultCount={filteredOrders.length}
          onChange={setSmartFilters}
          onReset={resetFilters}
        />

        <OrdersTabs tab={tab} tabs={tabs} onTabChange={setTab} />

        <OrdersTable
          loading={loading}
          orders={filteredOrders}
          savingId={savingId}
          onEdit={(order) => openEditModal(order.id)}
          onUpdateStatus={handleStatusUpdate}
          onArchive={handleArchive}
          onRestore={handleRestore}
        />

        {!loading && hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadOrders("more")}
              disabled={loadingMore}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}

              {loadingMore ? "Loading Orders..." : "Load More Orders"}
            </button>
          </div>
        ) : null}

        {showCreateModal ? (
          <OrderModal
            title="Create Order"
            description="Add a new order, build smart routing fields, and allocate inventory."
            form={form}
            busy={creating}
            error={createError}
            mode="create"
            onClose={closeCreateModal}
            onChange={handleCreateChange}
            onSave={() =>
              void createOrder({
                form,
                setCreating,
                setCreateError,
                onComplete: () => {
                  setShowCreateModal(false);
                  resetCreateForm();
                },
              })
            }
            onScan={() => setScannerOpen(true)}
            onLoadBarcode={() =>
              void fillProductFromBarcode(
                form.barcode,
                "create",
                setForm,
                setEditForm
              )
            }
          />
        ) : null}

        {showEditModal ? (
          <OrderModal
            title="Edit Order"
            description="Update order details and rebuild smart operational routing."
            form={editForm}
            busy={editing}
            error={editError}
            mode="edit"
            onClose={closeEditModal}
            onChange={handleEditChange}
            onSave={() =>
              void saveEditOrder({
                editingOrderId,
                editForm,
                setEditing,
                setEditError,
                onComplete: () => {
                  setShowEditModal(false);
                  resetEditForm();
                },
              })
            }
            onScan={undefined}
            onLoadBarcode={() =>
              void fillProductFromBarcode(
                editForm.barcode,
                "edit",
                setForm,
                setEditForm
              )
            }
          />
        ) : null}

        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => {
            if (!scannerOpen) return;

            const clean = normalizeBarcode(code);

            handleCreateChange("barcode", clean);

            toast.success("Barcode captured.");

            void fillProductFromBarcode(clean, "create", setForm, setEditForm);

            setScannerOpen(false);
          }}
          title="Scan Order Inventory Barcode"
        />
      </div>
    </main>
  );
}


