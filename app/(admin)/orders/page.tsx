"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import BarcodeScannerModal from "@/app/components/barcode/BarcodeScannerModal";
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
import { pageShell, primaryButton } from "./lib/orderUi";
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

  const tabs: Array<{ key: FilterTab; label: string; count?: number }> = [
    { key: "processing", label: "Processing", count: summary.processing },
    { key: "ready", label: "Ready", count: summary.ready },
    { key: "delivered", label: "Delivered", count: summary.delivered },
    { key: "cancelled", label: "Cancelled", count: summary.cancelled },
    { key: "archived", label: "Archived", count: summary.archived },
    { key: "all", label: "All Loaded", count: orders.length },
  ];

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

  async function handleStatusUpdate(orderId: string, status: Parameters<typeof updateStatus>[1]) {
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
      <main className={pageShell}>
        <section className="rounded-3xl border border-white/15 bg-white/[0.07] p-6 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="mt-2 text-sm text-zinc-400">
            You need to be signed in to view orders. Revolutionary concept,
            protecting patient data instead of leaving it lying around like a gas
            station receipt.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={pageShell}>
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
          setSmartFilters((prev) => ({ ...prev, reviewOnly: true }))
        }
        onInventoryOnly={() =>
          setSmartFilters((prev) => ({ ...prev, inventoryOnly: true }))
        }
        onHospiceOnly={() =>
          setSmartFilters((prev) => ({ ...prev, hospiceRiskOnly: true }))
        }
        onMissingProductOnly={() =>
          setSmartFilters((prev) => ({ ...prev, missingProductOnly: true }))
        }
        onArchiveReadyOnly={() =>
          setSmartFilters((prev) => ({ ...prev, archiveReadyOnly: true }))
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
            className={primaryButton}
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} />
            ) : null}
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      ) : null}

      {showCreateModal ? (
        <OrderModal
          title="Create Order"
          description="Add a new order, build smart keys, and allocate inventory."
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
          description="Update order details and rebuild smart routing fields."
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
          const clean = normalizeBarcode(code);

          handleCreateChange("barcode", clean);

          void fillProductFromBarcode(clean, "create", setForm, setEditForm);

          setScannerOpen(false);
        }}
        title="Scan Order Inventory Barcode"
      />
    </main>
  );
}