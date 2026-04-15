"use client";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  ClipboardList,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  PackageCheck,
  Clock3,
  CheckCircle2,
  Ban,
} from "lucide-react";

type OrderStatus = "Processing" | "Ready" | "Delivered" | "Cancelled";

type Order = {
  id: string;
  customerName: string;
  item: string;
  status: OrderStatus;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

type OrderFormData = {
  customerName: string;
  item: string;
  status: OrderStatus;
  notes: string;
};

const STATUS_OPTIONS: OrderStatus[] = [
  "Processing",
  "Ready",
  "Delivered",
  "Cancelled",
];

const EMPTY_FORM: OrderFormData = {
  customerName: "",
  item: "",
  status: "Processing",
  notes: "",
};

function formatDate(timestamp?: Timestamp | null) {
  if (!timestamp) return "—";

  try {
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getStatusClasses(status: OrderStatus) {
  switch (status) {
    case "Processing":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    case "Ready":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
    case "Delivered":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    case "Cancelled":
      return "bg-rose-500/15 text-rose-300 border border-rose-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border border-slate-500/20";
  }
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#111827] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#111827] shadow-sm">
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}

function OrderModal({
  open,
  mode,
  formData,
  setFormData,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  mode: "add" | "edit";
  formData: OrderFormData;
  setFormData: React.Dispatch<React.SetStateAction<OrderFormData>>;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#111827] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-white">
              {mode === "add" ? "Add Order" : "Edit Order"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Manage customer orders and fulfillment details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Customer Name
            </label>
            <input
              value={formData.customerName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  customerName: e.target.value,
                }))
              }
              placeholder="Enter customer name"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Item
            </label>
            <input
              value={formData.item}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  item: e.target.value,
                }))
              }
              placeholder="Enter ordered item"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  status: e.target.value as OrderStatus,
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-sky-500"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status} className="bg-[#111827]">
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Notes
            </label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              placeholder="Optional notes"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "add" ? "Create Order" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { isAdmin, isStaff, loading: roleLoading } = useAuthRole();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OrderFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      setError("You must be signed in to view orders.");
      return;
    }

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextOrders: Order[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Order, "id">),
        }));

        setOrders(nextOrders);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading orders:", err);
        setError(err.message || "Failed to load orders.");
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("Orders unsubscribe failed:", err);
      }
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !term ||
        order.customerName?.toLowerCase().includes(term) ||
        order.item?.toLowerCase().includes(term) ||
        order.status?.toLowerCase().includes(term) ||
        order.notes?.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const totalOrders = orders.length;
  const processingOrders = orders.filter(
    (o) => (o.status ?? "Processing") === "Processing"
  ).length;
  const readyOrders = orders.filter((o) => o.status === "Ready").length;
  const deliveredOrders = orders.filter((o) => o.status === "Delivered").length;

  function resetModal() {
    setModalOpen(false);
    setSelectedOrderId(null);
    setFormData(EMPTY_FORM);
  }

  function openAddModal() {
    if (!isAdmin) return;
    setModalMode("add");
    setSelectedOrderId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(order: Order) {
    if (!isStaff && !isAdmin) return;

    setModalMode("edit");
    setSelectedOrderId(order.id);
    setFormData({
      customerName: order.customerName ?? "",
      item: order.item ?? "",
      status: order.status ?? "Processing",
      notes: order.notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSaveOrder() {
    if (!isStaff && !isAdmin) return;

    const customerName = formData.customerName.trim();
    const item = formData.item.trim();
    const status = formData.status ?? "Processing";
    const notes = formData.notes.trim();

    if (!customerName || !item) {
      alert("Please fill out customer name and item.");
      return;
    }

    setSaving(true);

    try {
      if (selectedOrderId) {
        await updateDoc(doc(db, "orders", selectedOrderId), {
          customerName,
          item,
          status,
          notes,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (!isAdmin) {
          alert("Only admins can create orders.");
          return;
        }

        const newRef = doc(collection(db, "orders"));
        await setDoc(newRef, {
          customerName,
          item,
          status,
          notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      resetModal();
    } catch (err) {
      console.error("Error saving order:", err);
      alert("Failed to save order.");
    } finally {
      setSaving(false);
    }
  }

  async function removeOrder(orderId: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this order?"
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (err) {
      console.error("Error deleting order:", err);
      alert("Failed to delete order.");
    }
  }

  if (roleLoading) {
    return (
      <div className="space-y-6 p-6 text-white">
        <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-300 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading permissions...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-6 text-white">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage customer orders and fulfillment from one clean workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Orders"
            value={totalOrders}
            subtitle="Total order records"
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <StatCard
            title="Processing"
            value={processingOrders}
            subtitle="Currently being worked"
            icon={<Clock3 className="h-5 w-5" />}
          />
          <StatCard
            title="Ready"
            value={readyOrders}
            subtitle="Ready for pickup or delivery"
            icon={<PackageCheck className="h-5 w-5" />}
          />
          <StatCard
            title="Delivered"
            value={deliveredOrders}
            subtitle="Completed orders"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>

        <SectionCard
          title="All Orders"
          subtitle="Search, filter, and manage your orders."
        >
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer, item, status, notes, or ID"
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "All" | OrderStatus)
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500"
              >
                <option value="All" className="bg-[#111827]">
                  All statuses
                </option>
                {STATUS_OPTIONS.map((status) => (
                  <option
                    key={status}
                    value={status}
                    className="bg-[#111827]"
                  >
                    {status}
                  </option>
                ))}
              </select>

              {isAdmin && (
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-600"
                >
                  <Plus className="h-4 w-4" />
                  Add Order
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20">
                <div className="inline-flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-300 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading orders...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
                {error}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-black/20 text-slate-400 shadow-sm">
                  <Ban className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  No orders found
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl bg-black/20 p-5 transition hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {order.customerName}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            order.status ?? "Processing"
                          )}`}
                        >
                          {order.status ?? "Processing"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                        <span>Item: {order.item}</span>
                        <span>Created: {formatDate(order.createdAt)}</span>
                        <span>Updated: {formatDate(order.updatedAt)}</span>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        ID: {order.id}
                      </p>

                      {order.notes ? (
                        <p className="mt-3 max-w-3xl text-sm text-slate-300">
                          {order.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {(isStaff || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => openEditModal(order)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-white/10 hover:text-white"
                          aria-label={`Edit order ${order.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => removeOrder(order.id)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                          aria-label={`Delete order ${order.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                      {!isStaff && !isAdmin && (
                        <span className="text-sm text-slate-500">
                          View only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <OrderModal
        open={modalOpen}
        mode={modalMode}
        formData={formData}
        setFormData={setFormData}
        onClose={resetModal}
        onSubmit={handleSaveOrder}
        saving={saving}
      />
    </>
  );
}