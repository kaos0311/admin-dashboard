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
  CalendarClock,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  Box,
  Clock3,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type RentalStatus = "Active" | "Due Soon" | "Returned" | "Overdue";

type Rental = {
  id: string;
  customerName: string;
  item: string;
  status: RentalStatus;
  dueDate?: string;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

type RentalFormData = {
  customerName: string;
  item: string;
  status: RentalStatus;
  dueDate: string;
  notes: string;
};

const STATUS_OPTIONS: RentalStatus[] = [
  "Active",
  "Due Soon",
  "Returned",
  "Overdue",
];

const EMPTY_FORM: RentalFormData = {
  customerName: "",
  item: "",
  status: "Active",
  dueDate: "",
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

function getStatusClasses(status: RentalStatus) {
  switch (status) {
    case "Active":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
    case "Due Soon":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    case "Returned":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    case "Overdue":
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

function RentalModal({
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
  formData: RentalFormData;
  setFormData: React.Dispatch<React.SetStateAction<RentalFormData>>;
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
              {mode === "add" ? "Add Rental" : "Edit Rental"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Manage rental equipment and due dates.
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
              placeholder="Enter rental item"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  status: e.target.value as RentalStatus,
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

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  dueDate: e.target.value,
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-sky-500"
            />
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
            {mode === "add" ? "Create Rental" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RentalsPage() {
  const { isAdmin, isStaff, loading: roleLoading } = useAuthRole();

  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | RentalStatus>("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RentalFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      setError("You must be signed in to view rentals.");
      return;
    }

    const q = query(collection(db, "rentals"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextRentals: Rental[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Rental, "id">),
        }));

        setRentals(nextRentals);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading rentals:", err);
        setError(err.message || "Failed to load rentals.");
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("Rentals unsubscribe failed:", err);
      }
    };
  }, []);

  const filteredRentals = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rentals.filter((rental) => {
      const matchesSearch =
        !term ||
        rental.customerName?.toLowerCase().includes(term) ||
        rental.item?.toLowerCase().includes(term) ||
        rental.status?.toLowerCase().includes(term) ||
        rental.notes?.toLowerCase().includes(term) ||
        rental.id.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || rental.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rentals, search, statusFilter]);

  const totalRentals = rentals.length;
  const activeRentals = rentals.filter(
    (r) => (r.status ?? "Active") === "Active"
  ).length;
  const dueSoonRentals = rentals.filter((r) => r.status === "Due Soon").length;
  const overdueRentals = rentals.filter((r) => r.status === "Overdue").length;

  function resetModal() {
    setModalOpen(false);
    setSelectedRentalId(null);
    setFormData(EMPTY_FORM);
  }

  function openAddModal() {
    if (!isAdmin) return;
    setModalMode("add");
    setSelectedRentalId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(rental: Rental) {
    if (!isStaff && !isAdmin) return;

    setModalMode("edit");
    setSelectedRentalId(rental.id);
    setFormData({
      customerName: rental.customerName ?? "",
      item: rental.item ?? "",
      status: rental.status ?? "Active",
      dueDate: rental.dueDate ?? "",
      notes: rental.notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSaveRental() {
    if (!isStaff && !isAdmin) return;

    const customerName = formData.customerName.trim();
    const item = formData.item.trim();
    const status = formData.status ?? "Active";
    const dueDate = formData.dueDate ?? "";
    const notes = formData.notes.trim();

    if (!customerName || !item) {
      alert("Please fill out customer name and item.");
      return;
    }

    setSaving(true);

    try {
      if (selectedRentalId) {
        await updateDoc(doc(db, "rentals", selectedRentalId), {
          customerName,
          item,
          status,
          dueDate,
          notes,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (!isAdmin) {
          alert("Only admins can create rentals.");
          return;
        }

        const newRef = doc(collection(db, "rentals"));
        await setDoc(newRef, {
          customerName,
          item,
          status,
          dueDate,
          notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      resetModal();
    } catch (err) {
      console.error("Error saving rental:", err);
      alert("Failed to save rental.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRental(rentalId: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this rental?"
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "rentals", rentalId));
    } catch (err) {
      console.error("Error deleting rental:", err);
      alert("Failed to delete rental.");
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
          <h1 className="text-3xl font-semibold tracking-tight">Rentals</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage rental equipment, due dates, and returns from one clean
            workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Rentals"
            value={totalRentals}
            subtitle="Total rental records"
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <StatCard
            title="Active"
            value={activeRentals}
            subtitle="Currently out with customers"
            icon={<Box className="h-5 w-5" />}
          />
          <StatCard
            title="Due Soon"
            value={dueSoonRentals}
            subtitle="Needs attention soon"
            icon={<Clock3 className="h-5 w-5" />}
          />
          <StatCard
            title="Overdue"
            value={overdueRentals}
            subtitle="Past due date"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </div>

        <SectionCard
          title="All Rentals"
          subtitle="Search, filter, and manage your rental records."
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
                  setStatusFilter(e.target.value as "All" | RentalStatus)
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
                  Add Rental
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20">
                <div className="inline-flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-300 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading rentals...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
                {error}
              </div>
            ) : filteredRentals.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-black/20 text-slate-400 shadow-sm">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  No rentals found
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              filteredRentals.map((rental) => (
                <div
                  key={rental.id}
                  className="rounded-3xl bg-black/20 p-5 transition hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {rental.customerName}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            rental.status ?? "Active"
                          )}`}
                        >
                          {rental.status ?? "Active"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                        <span>Item: {rental.item}</span>
                        <span>Due: {rental.dueDate || "—"}</span>
                        <span>Created: {formatDate(rental.createdAt)}</span>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        ID: {rental.id}
                      </p>

                      {rental.notes ? (
                        <p className="mt-3 max-w-3xl text-sm text-slate-300">
                          {rental.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {(isStaff || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => openEditModal(rental)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-white/10 hover:text-white"
                          aria-label={`Edit ${rental.item}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => removeRental(rental.id)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                          aria-label={`Delete ${rental.item}`}
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

      <RentalModal
        open={modalOpen}
        mode={modalMode}
        formData={formData}
        setFormData={setFormData}
        onClose={resetModal}
        onSubmit={handleSaveRental}
        saving={saving}
      />
    </>
  );
}