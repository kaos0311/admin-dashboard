"use client";

import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Loader2,
  Package2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { auth, db } from "@/lib/firebase";

const RENTALS_LIMIT = 500;
const PRODUCTS_LIMIT = 750;

type RentalStatus =
  | "Active"
  | "Returned"
  | "Cancelled"
  | "Past Due"
  | "Deleted";

type DeliveryStatus =
  | "Not Scheduled"
  | "Scheduled"
  | "Delivered"
  | "Pickup Scheduled"
  | "Picked Up"
  | "Cleaning"
  | "Ready";

type BillingCycle = "Monthly" | "Weekly" | "Daily";

type ProductOption = {
  id: string;
  name: string;
  category: string;
  sku: string;
  upc: string;
  basePrice: number;
  isRentalItem: boolean;
  status: "active" | "inactive";
};

type Rental = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  sku: string;
  serialNumber: string;
  lotNumber: string;
  customerName: string;
  patientName: string;
  patientId: string;
  payerName: string;
  insuranceType: string;
  authorizationNumber: string;
  rentalStartDate: string;
  rentalEndDate: string;
  monthsUsed: number;
  monthlyRate: number;
  totalCharges: number;
  billingCycle: BillingCycle;
  status: RentalStatus;
  deliveryStatus: DeliveryStatus;
  deliveryDate: string;
  pickupDate: string;
  location: string;
  assignedTo: string;
  notes: string;
};

type RentalForm = Omit<
  Rental,
  "monthsUsed" | "monthlyRate" | "totalCharges"
> & {
  monthlyRate: string;
};

const initialForm: RentalForm = {
  id: "",
  productId: "",
  productName: "",
  category: "",
  sku: "",
  serialNumber: "",
  lotNumber: "",
  customerName: "",
  patientName: "",
  patientId: "",
  payerName: "",
  insuranceType: "",
  authorizationNumber: "",
  rentalStartDate: "",
  rentalEndDate: "",
  monthlyRate: "",
  billingCycle: "Monthly",
  status: "Active",
  deliveryStatus: "Not Scheduled",
  deliveryDate: "",
  pickupDate: "",
  location: "",
  assignedTo: "",
  notes: "",
};

function toSafeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toSafeNumber(value: unknown): number {
  if (value === "" || value == null) return 0;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildSearchTokens(value: string): string[] {
  return Array.from(
    new Set(normalizeSearchText(value).split(" ").filter(Boolean))
  ).slice(0, 75);
}

function dateFromInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function calculateMonthsUsed(startValue: string, endValue: string): number {
  const start = dateFromInput(startValue);
  const end = dateFromInput(endValue) ?? new Date();

  if (!start) return 0;
  if (end < start) return 0;

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  let totalMonths = years * 12 + months;

  if (end.getDate() >= start.getDate()) {
    totalMonths += 1;
  }

  return Math.max(totalMonths, 1);
}

function deriveRentalStatus(status: RentalStatus, endDate: string): RentalStatus {
  if (status === "Returned" || status === "Cancelled" || status === "Deleted") {
    return status;
  }

  const end = dateFromInput(endDate);
  const today = dateFromInput(todayInputValue());

  if (end && today && end < today) return "Past Due";

  return "Active";
}

function normalizeBillingCycle(value: unknown): BillingCycle {
  if (value === "Weekly" || value === "Daily") return value;
  return "Monthly";
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  if (
    value === "Scheduled" ||
    value === "Delivered" ||
    value === "Pickup Scheduled" ||
    value === "Picked Up" ||
    value === "Cleaning" ||
    value === "Ready"
  ) {
    return value;
  }

  return "Not Scheduled";
}

function normalizeRentalStatus(value: unknown): RentalStatus {
  if (
    value === "Returned" ||
    value === "Cancelled" ||
    value === "Past Due" ||
    value === "Deleted"
  ) {
    return value;
  }

  return "Active";
}

function normalizeProduct(
  id: string,
  data: Record<string, unknown>
): ProductOption {
  return {
    id,
    name: toSafeString(data.name),
    category: toSafeString(data.category),
    sku: toSafeString(data.sku),
    upc: toSafeString(data.upc),
    basePrice: toSafeNumber(data.basePrice),
    isRentalItem: Boolean(data.isRentalItem),
    status: data.status === "inactive" ? "inactive" : "active",
  };
}

function normalizeRental(id: string, data: Record<string, unknown>): Rental {
  const rentalStartDate = toSafeString(data.rentalStartDate);
  const rentalEndDate = toSafeString(data.rentalEndDate);
  const monthlyRate = toSafeNumber(data.monthlyRate);

  const monthsUsed =
    data.monthsUsed == null
      ? calculateMonthsUsed(rentalStartDate, rentalEndDate)
      : toSafeNumber(data.monthsUsed);

  const rawStatus = normalizeRentalStatus(data.status);
  const status = deriveRentalStatus(rawStatus, rentalEndDate);

  return {
    id,
    productId: toSafeString(data.productId),
    productName: toSafeString(data.productName),
    category: toSafeString(data.category),
    sku: toSafeString(data.sku),
    serialNumber: toSafeString(data.serialNumber),
    lotNumber: toSafeString(data.lotNumber),
    customerName: toSafeString(data.customerName),
    patientName: toSafeString(data.patientName),
    patientId: toSafeString(data.patientId),
    payerName: toSafeString(data.payerName),
    insuranceType: toSafeString(data.insuranceType),
    authorizationNumber: toSafeString(data.authorizationNumber),
    rentalStartDate,
    rentalEndDate,
    monthsUsed,
    monthlyRate,
    totalCharges:
      data.totalCharges == null
        ? monthlyRate * monthsUsed
        : toSafeNumber(data.totalCharges),
    billingCycle: normalizeBillingCycle(data.billingCycle),
    status,
    deliveryStatus: normalizeDeliveryStatus(data.deliveryStatus),
    deliveryDate: toSafeString(data.deliveryDate),
    pickupDate: toSafeString(data.pickupDate),
    location: toSafeString(data.location),
    assignedTo: toSafeString(data.assignedTo),
    notes: toSafeString(data.notes),
  };
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function statusClass(status: RentalStatus): string {
  switch (status) {
    case "Active":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "Returned":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "Past Due":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "Cancelled":
      return "border-neutral-500/20 bg-neutral-500/10 text-neutral-300";
    case "Deleted":
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";
    default:
      return "border-white/10 bg-white/10 text-white";
  }
}

export default function RentalsPage() {
  const { loading: authLoading, isAdmin, isStaff } = useAuthRole();

  const mountedRef = useRef(false);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [form, setForm] = useState<RentalForm>(initialForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RentalStatus>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | DeliveryStatus>(
    "all"
  );
  const [showDeleted, setShowDeleted] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [saving, setSaving] = useState(false);

  const canRead = isAdmin || isStaff;
  const canWrite = isAdmin || isStaff;
  const loading = authLoading || loadingProducts || loadingRentals;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!canRead) {
      setProducts([]);
      setRentals([]);
      setLoadingProducts(false);
      setLoadingRentals(false);
      toast.error("You do not have permission to view rentals.");
      return;
    }

    setLoadingProducts(true);

    const productsQuery = query(
      collection(db, "products"),
      orderBy("name", "asc"),
      limit(PRODUCTS_LIMIT)
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        if (!mountedRef.current) return;

        const rows = snapshot.docs
          .map((docSnap) =>
            normalizeProduct(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
          .filter((product) => product.status === "active");

        setProducts(rows);
        setLoadingProducts(false);
      },
      (error: unknown) => {
        console.error("LOAD RENTAL PRODUCTS ERROR:", error);
        if (!mountedRef.current) return;
        setLoadingProducts(false);
        toast.error("Products could not be loaded.");
      }
    );

    return () => unsubscribe();
  }, [authLoading, canRead]);

  useEffect(() => {
    if (authLoading) return;
    if (!canRead) return;

    setLoadingRentals(true);

    const rentalsQuery = query(
      collection(db, "rentals"),
      orderBy("rentalStartDate", "desc"),
      limit(RENTALS_LIMIT)
    );

    const unsubscribe = onSnapshot(
      rentalsQuery,
      (snapshot) => {
        if (!mountedRef.current) return;

        const rows = snapshot.docs.map((docSnap) =>
          normalizeRental(docSnap.id, docSnap.data() as Record<string, unknown>)
        );

        setRentals(rows);
        setLoadingRentals(false);
      },
      (error: unknown) => {
        console.error("LOAD RENTALS ERROR:", error);
        if (!mountedRef.current) return;
        setLoadingRentals(false);
        toast.error("Rentals could not be loaded.");
      }
    );

    return () => unsubscribe();
  }, [authLoading, canRead]);

  const rentalProducts = useMemo(() => {
    const flagged = products.filter((product) => product.isRentalItem);
    return flagged.length ? flagged : products;
  }, [products]);

  const previewMonthsUsed = useMemo(() => {
    return calculateMonthsUsed(form.rentalStartDate, form.rentalEndDate);
  }, [form.rentalStartDate, form.rentalEndDate]);

  const previewTotalCharges = useMemo(() => {
    return previewMonthsUsed * toSafeNumber(form.monthlyRate);
  }, [previewMonthsUsed, form.monthlyRate]);

  const visibleRentals = useMemo(() => {
    return rentals.filter((rental) => showDeleted || rental.status !== "Deleted");
  }, [rentals, showDeleted]);

  const filteredRentals = useMemo(() => {
    const term = normalizeSearchText(search);

    return visibleRentals.filter((rental) => {
      if (statusFilter !== "all" && rental.status !== statusFilter) {
        return false;
      }

      if (deliveryFilter !== "all" && rental.deliveryStatus !== deliveryFilter) {
        return false;
      }

      if (!term) return true;

      const haystack = normalizeSearchText(
        [
          rental.productName,
          rental.category,
          rental.sku,
          rental.serialNumber,
          rental.lotNumber,
          rental.customerName,
          rental.patientName,
          rental.patientId,
          rental.payerName,
          rental.insuranceType,
          rental.authorizationNumber,
          rental.status,
          rental.deliveryStatus,
          rental.location,
          rental.assignedTo,
          rental.notes,
        ].join(" ")
      );

      return haystack.includes(term);
    });
  }, [visibleRentals, search, statusFilter, deliveryFilter]);

  const stats = useMemo(() => {
    const active = rentals.filter((rental) => rental.status === "Active").length;
    const returned = rentals.filter(
      (rental) => rental.status === "Returned"
    ).length;
    const cancelled = rentals.filter(
      (rental) => rental.status === "Cancelled"
    ).length;
    const pastDue = rentals.filter(
      (rental) => rental.status === "Past Due"
    ).length;

    const openCharges = rentals
      .filter(
        (rental) =>
          rental.status === "Active" || rental.status === "Past Due"
      )
      .reduce((sum, rental) => sum + rental.totalCharges, 0);

    const totalCharges = rentals
      .filter((rental) => rental.status !== "Deleted")
      .reduce((sum, rental) => sum + rental.totalCharges, 0);

    return {
      active,
      returned,
      cancelled,
      pastDue,
      openCharges,
      totalCharges,
    };
  }, [rentals]);

  function updateForm<K extends keyof RentalForm>(
    key: K,
    value: RentalForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
  }

  function softRefresh() {
    setSearch("");
    setStatusFilter("all");
    setDeliveryFilter("all");
    resetForm();
    toast.success("Rental view refreshed.");
  }

  function applyProduct(productId: string) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
      setForm((prev) => ({
        ...prev,
        productId: "",
        productName: "",
        category: "",
        sku: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      productId: product.id,
      productName: product.name,
      category: product.category,
      sku: product.sku,
      monthlyRate: prev.monthlyRate || String(product.basePrice || ""),
    }));
  }

  function handleEdit(rental: Rental) {
    setForm({
      id: rental.id,
      productId: rental.productId,
      productName: rental.productName,
      category: rental.category,
      sku: rental.sku,
      serialNumber: rental.serialNumber,
      lotNumber: rental.lotNumber,
      customerName: rental.customerName,
      patientName: rental.patientName,
      patientId: rental.patientId,
      payerName: rental.payerName,
      insuranceType: rental.insuranceType,
      authorizationNumber: rental.authorizationNumber,
      rentalStartDate: rental.rentalStartDate,
      rentalEndDate: rental.rentalEndDate,
      monthlyRate: rental.monthlyRate ? String(rental.monthlyRate) : "",
      billingCycle: rental.billingCycle,
      status: rental.status,
      deliveryStatus: rental.deliveryStatus,
      deliveryDate: rental.deliveryDate,
      pickupDate: rental.pickupDate,
      location: rental.location,
      assignedTo: rental.assignedTo,
      notes: rental.notes,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function softDeleteRental(rental: Rental) {
    if (!canWrite) {
      toast.error("You do not have permission to delete rentals.");
      return;
    }

    const confirmed = window.confirm(
      `Archive rental record for "${rental.productName}"? This keeps the record for audit history.`
    );

    if (!confirmed) return;

    try {
      const currentUser = auth.currentUser;

      await updateDoc(doc(db, "rentals", rental.id), {
        status: "Deleted",
        deletedAt: serverTimestamp(),
        deletedByUid: currentUser?.uid ?? "",
        deletedByEmail: currentUser?.email ?? "",
        updatedAt: serverTimestamp(),
      });

      toast.success("Rental archived.");

      if (form.id === rental.id) resetForm();
    } catch (error: unknown) {
      console.error("ARCHIVE RENTAL ERROR:", error);
      toast.error("Rental could not be archived.");
    }
  }

  async function markReturned(rental: Rental) {
    if (!canWrite) {
      toast.error("You do not have permission to update rentals.");
      return;
    }

    const endDate = todayInputValue();
    const monthsUsed = calculateMonthsUsed(rental.rentalStartDate, endDate);
    const totalCharges = monthsUsed * rental.monthlyRate;
    const currentUser = auth.currentUser;

    try {
      await updateDoc(doc(db, "rentals", rental.id), {
        rentalEndDate: endDate,
        pickupDate: rental.pickupDate || endDate,
        monthsUsed,
        totalCharges,
        status: "Returned",
        deliveryStatus:
          rental.deliveryStatus === "Picked Up"
            ? "Picked Up"
            : "Pickup Scheduled",
        returnedAt: serverTimestamp(),
        returnedByUid: currentUser?.uid ?? "",
        returnedByEmail: currentUser?.email ?? "",
        updatedAt: serverTimestamp(),
      });

      toast.success("Rental marked returned.");
    } catch (error: unknown) {
      console.error("RETURN RENTAL ERROR:", error);
      toast.error("Rental could not be updated.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canWrite) {
      toast.error("You do not have permission to save rentals.");
      return;
    }

    const productId = form.productId.trim();
    const productName = form.productName.trim();
    const category = form.category.trim();
    const sku = form.sku.trim();
    const serialNumber = form.serialNumber.trim();
    const lotNumber = form.lotNumber.trim();
    const customerName = form.customerName.trim();
    const patientName = form.patientName.trim();
    const patientId = form.patientId.trim();
    const payerName = form.payerName.trim();
    const insuranceType = form.insuranceType.trim();
    const authorizationNumber = form.authorizationNumber.trim();
    const rentalStartDate = form.rentalStartDate.trim();
    const rentalEndDate = form.rentalEndDate.trim();
    const monthlyRate = toSafeNumber(form.monthlyRate);
    const deliveryDate = form.deliveryDate.trim();
    const pickupDate = form.pickupDate.trim();
    const location = form.location.trim();
    const assignedTo = form.assignedTo.trim();
    const notes = form.notes.trim();

    if (!productName) {
      toast.error("Rental product is required.");
      return;
    }

    if (!customerName && !patientName) {
      toast.error("Customer or patient name is required.");
      return;
    }

    if (!rentalStartDate) {
      toast.error("Rental start date is required.");
      return;
    }

    if (monthlyRate < 0) {
      toast.error("Monthly rate cannot be negative.");
      return;
    }

    const startDate = dateFromInput(rentalStartDate);
    const endDate = dateFromInput(rentalEndDate);

    if (startDate && endDate && endDate < startDate) {
      toast.error("End date cannot be before start date.");
      return;
    }

    const monthsUsed = calculateMonthsUsed(rentalStartDate, rentalEndDate);
    const totalCharges = monthsUsed * monthlyRate;
    const status = deriveRentalStatus(form.status, rentalEndDate);

    const searchSource = [
      productName,
      category,
      sku,
      serialNumber,
      lotNumber,
      customerName,
      patientName,
      patientId,
      payerName,
      insuranceType,
      authorizationNumber,
      status,
      form.deliveryStatus,
      location,
      assignedTo,
      notes,
    ].join(" ");

    const currentUser = auth.currentUser;

    setSaving(true);

    try {
      const payload = {
        productId,
        productName,
        category,
        sku,
        serialNumber,
        lotNumber,
        customerName,
        patientName,
        patientId,
        payerName,
        insuranceType,
        authorizationNumber,
        rentalStartDate,
        rentalEndDate,
        monthsUsed,
        monthlyRate,
        totalCharges,
        billingCycle: form.billingCycle,
        status,
        deliveryStatus: form.deliveryStatus,
        deliveryDate,
        pickupDate,
        location,
        assignedTo,
        notes,
        searchText: normalizeSearchText(searchSource),
        searchTokens: buildSearchTokens(searchSource),
        updatedAt: serverTimestamp(),
        updatedByUid: currentUser?.uid ?? "",
        updatedByEmail: currentUser?.email ?? "",
      };

      if (form.id) {
        await updateDoc(doc(db, "rentals", form.id), payload);
        toast.success("Rental updated.");
      } else {
        await addDoc(collection(db, "rentals"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdByUid: currentUser?.uid ?? "",
          createdByEmail: currentUser?.email ?? "",
        });

        toast.success("Rental added.");
      }

      resetForm();
    } catch (error: unknown) {
      console.error("SAVE RENTAL ERROR:", error);
      toast.error("Rental could not be saved.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="w-full max-w-none space-y-6">
        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">Rentals</h1>
                <p className="text-sm text-neutral-400">
                  Track rental equipment, patients, billing, delivery, pickup,
                  serial numbers, and return status.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={softRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh View
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Past Due" value={stats.pastDue} />
          <StatCard label="Returned" value={stats.returned} />
          <StatCard label="Cancelled" value={stats.cancelled} />
          <StatCard label="Open Charges" value={money(stats.openCharges)} />
          <StatCard label="Total Charges" value={money(stats.totalCharges)} />
        </section>

        <section className="grid gap-6 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                {form.id ? (
                  <Pencil className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5" aria-hidden="true" />
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  {form.id ? "Edit Rental" : "Add Rental"}
                </h2>
                <p className="text-sm text-neutral-400">
                  Charges update automatically from rental dates.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <SelectField
                label="Rental Product"
                value={form.productId}
                onChange={applyProduct}
                options={[
                  { value: "", label: "Manual / unlinked product" },
                  ...rentalProducts.map((product) => ({
                    value: product.id,
                    label: `${product.name}${
                      product.sku ? ` • ${product.sku}` : ""
                    }`,
                  })),
                ]}
              />

              <TextInput
                label="Product Name"
                value={form.productName}
                onChange={(value) => updateForm("productName", value)}
                required
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Category"
                  value={form.category}
                  onChange={(value) => updateForm("category", value)}
                />

                <TextInput
                  label="SKU"
                  value={form.sku}
                  onChange={(value) => updateForm("sku", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Serial Number"
                  value={form.serialNumber}
                  onChange={(value) => updateForm("serialNumber", value)}
                />

                <TextInput
                  label="Lot Number"
                  value={form.lotNumber}
                  onChange={(value) => updateForm("lotNumber", value)}
                />
              </div>

              <TextInput
                label="Customer Name"
                value={form.customerName}
                onChange={(value) => updateForm("customerName", value)}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Patient Name"
                  value={form.patientName}
                  onChange={(value) => updateForm("patientName", value)}
                />

                <TextInput
                  label="Patient ID"
                  value={form.patientId}
                  onChange={(value) => updateForm("patientId", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Payer Name"
                  value={form.payerName}
                  onChange={(value) => updateForm("payerName", value)}
                />

                <TextInput
                  label="Insurance Type"
                  value={form.insuranceType}
                  onChange={(value) => updateForm("insuranceType", value)}
                />
              </div>

              <TextInput
                label="Authorization Number"
                value={form.authorizationNumber}
                onChange={(value) => updateForm("authorizationNumber", value)}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Start Date"
                  type="date"
                  value={form.rentalStartDate}
                  onChange={(value) => updateForm("rentalStartDate", value)}
                  required
                />

                <TextInput
                  label="End Date"
                  type="date"
                  value={form.rentalEndDate}
                  onChange={(value) => updateForm("rentalEndDate", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Monthly Rate"
                  type="number"
                  value={form.monthlyRate}
                  onChange={(value) => updateForm("monthlyRate", value)}
                />

                <SelectField
                  label="Billing Cycle"
                  value={form.billingCycle}
                  onChange={(value) =>
                    updateForm("billingCycle", value as BillingCycle)
                  }
                  options={[
                    { value: "Monthly", label: "Monthly" },
                    { value: "Weekly", label: "Weekly" },
                    { value: "Daily", label: "Daily" },
                  ]}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Rental Status"
                  value={form.status}
                  onChange={(value) =>
                    updateForm("status", value as RentalStatus)
                  }
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Returned", label: "Returned" },
                    { value: "Past Due", label: "Past Due" },
                    { value: "Cancelled", label: "Cancelled" },
                  ]}
                />

                <SelectField
                  label="Delivery Status"
                  value={form.deliveryStatus}
                  onChange={(value) =>
                    updateForm("deliveryStatus", value as DeliveryStatus)
                  }
                  options={[
                    { value: "Not Scheduled", label: "Not Scheduled" },
                    { value: "Scheduled", label: "Scheduled" },
                    { value: "Delivered", label: "Delivered" },
                    {
                      value: "Pickup Scheduled",
                      label: "Pickup Scheduled",
                    },
                    { value: "Picked Up", label: "Picked Up" },
                    { value: "Cleaning", label: "Cleaning" },
                    { value: "Ready", label: "Ready" },
                  ]}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Delivery Date"
                  type="date"
                  value={form.deliveryDate}
                  onChange={(value) => updateForm("deliveryDate", value)}
                />

                <TextInput
                  label="Pickup Date"
                  type="date"
                  value={form.pickupDate}
                  onChange={(value) => updateForm("pickupDate", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Location / Bin"
                  value={form.location}
                  onChange={(value) => updateForm("location", value)}
                />

                <TextInput
                  label="Assigned To"
                  value={form.assignedTo}
                  onChange={(value) => updateForm("assignedTo", value)}
                />
              </div>

              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(value) => updateForm("notes", value)}
                placeholder="Optional rental notes, delivery details, pickup notes, or billing context."
              />

              <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-neutral-300">
                Rental time:{" "}
                <span className="font-semibold text-white">
                  {previewMonthsUsed.toLocaleString()} month
                  {previewMonthsUsed === 1 ? "" : "s"}
                </span>
                . Total charges:{" "}
                <span className="font-semibold text-white">
                  {money(previewTotalCharges)}
                </span>
                .
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !canWrite}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Rental
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
                >
                  Clear
                </button>
              </div>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">Rental Records</h2>
                <p className="text-sm text-neutral-400">
                  {filteredRentals.length.toLocaleString()} visible records
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />

                  <input
                    value={search}
                    title="Search rentals"
                    aria-label="Search rentals"
                    placeholder="Search rentals..."
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-600 transition focus:border-white/30 lg:w-72"
                  />
                </div>

                <SelectField
                  label="Filter by rental status"
                  srOnlyLabel
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter(value as "all" | RentalStatus)
                  }
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "Active", label: "Active" },
                    { value: "Returned", label: "Returned" },
                    { value: "Past Due", label: "Past Due" },
                    { value: "Cancelled", label: "Cancelled" },
                    { value: "Deleted", label: "Deleted" },
                  ]}
                />

                <SelectField
                  label="Filter by delivery status"
                  srOnlyLabel
                  value={deliveryFilter}
                  onChange={(value) =>
                    setDeliveryFilter(value as "all" | DeliveryStatus)
                  }
                  options={[
                    { value: "all", label: "All delivery" },
                    { value: "Not Scheduled", label: "Not Scheduled" },
                    { value: "Scheduled", label: "Scheduled" },
                    { value: "Delivered", label: "Delivered" },
                    {
                      value: "Pickup Scheduled",
                      label: "Pickup Scheduled",
                    },
                    { value: "Picked Up", label: "Picked Up" },
                    { value: "Cleaning", label: "Cleaning" },
                    { value: "Ready", label: "Ready" },
                  ]}
                />
              </div>
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={showDeleted}
                title="Show archived rental records"
                aria-label="Show archived rental records"
                onChange={(event) => setShowDeleted(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black"
              />
              Show archived rental records
            </label>

            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black p-4 text-neutral-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading rentals...
              </div>
            ) : filteredRentals.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black p-6 text-center text-sm text-neutral-400">
                No rental records match the current filters.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-2xl border border-white/10 xl:block">
                  <table className="w-full min-w-[1450px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-neutral-900 text-neutral-400">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Customer / Patient</th>
                        <th className="px-4 py-3">Billing</th>
                        <th className="px-4 py-3">Dates</th>
                        <th className="px-4 py-3 text-right">Months</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Delivery</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRentals.map((rental) => (
                        <RentalTableRow
                          key={rental.id}
                          rental={rental}
                          onEdit={handleEdit}
                          onReturn={markReturned}
                          onArchive={softDeleteRental}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 xl:hidden">
                  {filteredRentals.map((rental) => (
                    <RentalMobileCard
                      key={rental.id}
                      rental={rental}
                      onEdit={handleEdit}
                      onReturn={markReturned}
                      onArchive={softDeleteRental}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function RentalTableRow({
  rental,
  onEdit,
  onReturn,
  onArchive,
}: {
  rental: Rental;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
}) {
  return (
    <tr className="border-t border-white/10 align-top hover:bg-white/[0.03]">
      <td className="px-4 py-3">
        <div className="font-semibold">{rental.productName}</div>
        <div className="text-xs text-neutral-500">
          {rental.category || "No category"}
          {rental.sku ? ` • ${rental.sku}` : ""}
        </div>
        <div className="text-xs text-neutral-500">
          SN: {rental.serialNumber || "-"} • Lot: {rental.lotNumber || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-neutral-300">
        <div>{rental.customerName || "-"}</div>
        <div className="text-xs text-neutral-500">
          Patient: {rental.patientName || "-"}
        </div>
        <div className="text-xs text-neutral-500">
          ID: {rental.patientId || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-neutral-300">
        <div>{rental.payerName || "-"}</div>
        <div className="text-xs text-neutral-500">
          {rental.insuranceType || "No insurance type"}
        </div>
        <div className="text-xs text-neutral-500">
          Auth: {rental.authorizationNumber || "-"}
        </div>
      </td>

      <td className="px-4 py-3 text-neutral-300">
        <div>Start: {rental.rentalStartDate || "-"}</div>
        <div>End: {rental.rentalEndDate || "Active"}</div>
      </td>

      <td className="px-4 py-3 text-right text-neutral-300">
        {rental.monthsUsed.toLocaleString()}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="font-semibold">{money(rental.totalCharges)}</div>
        <div className="text-xs text-neutral-500">
          {money(rental.monthlyRate)} / {rental.billingCycle}
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className={`rounded-full border px-3 py-1 text-xs ${statusClass(
            rental.status
          )}`}
        >
          {rental.status}
        </span>
      </td>

      <td className="px-4 py-3 text-neutral-300">
        <div>{rental.deliveryStatus}</div>
        <div className="text-xs text-neutral-500">
          Delivery: {rental.deliveryDate || "-"}
        </div>
        <div className="text-xs text-neutral-500">
          Pickup: {rental.pickupDate || "-"}
        </div>
      </td>

      <td className="px-4 py-3">
        <RentalActions
          rental={rental}
          onEdit={onEdit}
          onReturn={onReturn}
          onArchive={onArchive}
        />
      </td>
    </tr>
  );
}

function RentalMobileCard({
  rental,
  onEdit,
  onReturn,
  onArchive,
}: {
  rental: Rental;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{rental.productName}</h3>
          <p className="text-xs text-neutral-500">
            {rental.category || "No category"}
            {rental.sku ? ` • ${rental.sku}` : ""}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs ${statusClass(
            rental.status
          )}`}
        >
          {rental.status}
        </span>
      </div>

      <div className="grid gap-2 text-sm text-neutral-300">
        <p>Customer: {rental.customerName || "-"}</p>
        <p>Patient: {rental.patientName || "-"}</p>
        <p>Serial: {rental.serialNumber || "-"}</p>
        <p>
          Dates: {rental.rentalStartDate || "-"} to{" "}
          {rental.rentalEndDate || "Active"}
        </p>
        <p>
          Total:{" "}
          <span className="font-semibold text-white">
            {money(rental.totalCharges)}
          </span>
        </p>
        <p>Delivery: {rental.deliveryStatus}</p>
      </div>

      <div className="mt-4">
        <RentalActions
          rental={rental}
          onEdit={onEdit}
          onReturn={onReturn}
          onArchive={onArchive}
        />
      </div>
    </article>
  );
}

function RentalActions({
  rental,
  onEdit,
  onReturn,
  onArchive,
}: {
  rental: Rental;
  onEdit: (rental: Rental) => void;
  onReturn: (rental: Rental) => void;
  onArchive: (rental: Rental) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      {rental.status === "Active" || rental.status === "Past Due" ? (
        <button
          type="button"
          onClick={() => void onReturn(rental)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
          title={`Return ${rental.productName}`}
          aria-label={`Return ${rental.productName}`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Return
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onEdit(rental)}
        className="rounded-xl border border-white/10 bg-white/10 p-2 transition hover:bg-white/15"
        title="Edit rental"
        aria-label={`Edit ${rental.productName}`}
      >
        <Pencil className="h-4 w-4" />
      </button>

      {rental.status !== "Deleted" ? (
        <button
          type="button"
          onClick={() => void onArchive(rental)}
          className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
          title="Archive rental"
          aria-label={`Archive ${rental.productName}`}
        >
          <XCircle className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const isMoney = label.toLowerCase().includes("charge");

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          {isMoney ? (
            <DollarSign className="h-5 w-5" aria-hidden="true" />
          ) : label.toLowerCase().includes("active") ? (
            <Truck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Package2 className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div>
          <p className="text-sm text-neutral-400">{label}</p>
          <p className="text-2xl font-bold">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const inputId = useId();

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm text-neutral-300">
        {label}
      </label>

      <input
        id={inputId}
        type={type}
        value={value}
        required={required}
        title={label}
        aria-label={label}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 transition focus:border-white/30"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const textareaId = useId();

  return (
    <div>
      <label
        htmlFor={textareaId}
        className="mb-2 block text-sm text-neutral-300"
      >
        {label}
      </label>

      <textarea
        id={textareaId}
        value={value}
        rows={4}
        title={label}
        aria-label={label}
        placeholder={placeholder || label}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 transition focus:border-white/30"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  srOnlyLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  srOnlyLabel?: boolean;
}) {
  const selectId = useId();

  return (
    <div>
      <label
        htmlFor={selectId}
        className={
          srOnlyLabel ? "sr-only" : "mb-2 block text-sm text-neutral-300"
        }
      >
        {label}
      </label>

      <select
        id={selectId}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
      >
        {options.map((option) => (
          <option key={`${selectId}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}