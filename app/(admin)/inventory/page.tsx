"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CalendarClock,
  CheckSquare,
  Loader2,
  PackagePlus,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import BarcodeScannerModal from "@/app/components/barcode/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";
import { smartMergeInventory } from "@/lib/inventory/smartMergeInventory";

const INVENTORY_LIMIT = 750;
const FIRESTORE_BATCH_LIMIT = 450;

type InventoryStatus =
  | "available"
  | "inactive"
  | "damaged"
  | "lost"
  | "discontinued";

type LifecycleStatus =
  | "new"
  | "active"
  | "needs_service"
  | "end_of_life"
  | "retired";

type ScanTarget = "barcode" | "serial" | "lotNumber" | null;

type InventoryItem = {
  id: string;
  productId: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  locationName: string;
  binLocation: string;
  quantityOnHand: number;
  committed: number;
  onRent: number;
  onOrder: number;
  available: number;
  reorderLevel: number;
  unitCost: number;
  totalValue: number;
  status: InventoryStatus;
  manufacturer: string;
  manufacturerItemId: string;
  modelNumber: string;
  warrantyProvider: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyNotes: string;
  purchaseDate: string;
  usefulLifeMonths: number;
  lifecycleStatus: LifecycleStatus;
  nextServiceDate: string;
  lifecycleNotes: string;
  notes: string;
};

type InventoryForm = {
  id: string;
  productId: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  locationName: string;
  binLocation: string;
  quantityOnHand: string;
  committed: string;
  onRent: string;
  onOrder: string;
  reorderLevel: string;
  unitCost: string;
  status: InventoryStatus;
  manufacturer: string;
  manufacturerItemId: string;
  modelNumber: string;
  warrantyProvider: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyNotes: string;
  purchaseDate: string;
  usefulLifeMonths: string;
  lifecycleStatus: LifecycleStatus;
  nextServiceDate: string;
  lifecycleNotes: string;
  notes: string;
};

const initialForm: InventoryForm = {
  id: "",
  productId: "",
  name: "",
  category: "",
  sku: "",
  barcode: "",
  serial: "",
  lotNumber: "",
  locationName: "Main Location",
  binLocation: "",
  quantityOnHand: "0",
  committed: "0",
  onRent: "0",
  onOrder: "0",
  reorderLevel: "0",
  unitCost: "0",
  status: "available",
  manufacturer: "",
  manufacturerItemId: "",
  modelNumber: "",
  warrantyProvider: "",
  warrantyStartDate: "",
  warrantyEndDate: "",
  warrantyNotes: "",
  purchaseDate: "",
  usefulLifeMonths: "60",
  lifecycleStatus: "active",
  nextServiceDate: "",
  lifecycleNotes: "",
  notes: "",
};

function toSafeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toSafeNumber(value: unknown): number {
  if (value === "" || value == null || value === "-") return 0;
  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function normalizeInventoryItem(
  id: string,
  data: Record<string, unknown>
): InventoryItem {
  const quantityOnHand = toSafeNumber(data.quantityOnHand);
  const committed = toSafeNumber(data.committed);
  const onRent = toSafeNumber(data.onRent);
  const onOrder = toSafeNumber(data.onOrder);

  const available =
    data.available == null
      ? quantityOnHand - committed - onRent
      : toSafeNumber(data.available);

  const unitCost = toSafeNumber(data.unitCost);

  const rawStatus = toSafeString(data.status);
  const status: InventoryStatus =
    rawStatus === "inactive" ||
    rawStatus === "damaged" ||
    rawStatus === "lost" ||
    rawStatus === "discontinued"
      ? rawStatus
      : "available";

  const rawLifecycle = toSafeString(data.lifecycleStatus);
  const lifecycleStatus: LifecycleStatus =
    rawLifecycle === "new" ||
    rawLifecycle === "needs_service" ||
    rawLifecycle === "end_of_life" ||
    rawLifecycle === "retired"
      ? rawLifecycle
      : "active";

  return {
    id,
    productId: toSafeString(data.productId),
    name: toSafeString(data.name),
    category: toSafeString(data.category),
    sku: toSafeString(data.sku),
    barcode: toSafeString(data.barcode),
    serial: toSafeString(data.serial),
    lotNumber: toSafeString(data.lotNumber),
    locationName: toSafeString(data.locationName) || "Main Location",
    binLocation: toSafeString(data.binLocation),
    quantityOnHand,
    committed,
    onRent,
    onOrder,
    available,
    reorderLevel: toSafeNumber(data.reorderLevel),
    unitCost,
    totalValue:
      data.totalValue == null
        ? quantityOnHand * unitCost
        : toSafeNumber(data.totalValue),
    status,
    manufacturer: toSafeString(data.manufacturer),
    manufacturerItemId: toSafeString(data.manufacturerItemId),
    modelNumber: toSafeString(data.modelNumber),
    warrantyProvider: toSafeString(data.warrantyProvider),
    warrantyStartDate: toSafeString(data.warrantyStartDate),
    warrantyEndDate: toSafeString(data.warrantyEndDate),
    warrantyNotes: toSafeString(data.warrantyNotes),
    purchaseDate: toSafeString(data.purchaseDate),
    usefulLifeMonths: toSafeNumber(data.usefulLifeMonths),
    lifecycleStatus,
    nextServiceDate: toSafeString(data.nextServiceDate),
    lifecycleNotes: toSafeString(data.lifecycleNotes),
    notes: toSafeString(data.notes),
  };
}

function buildSearchText(item: Omit<InventoryItem, "id">): string {
  return normalizeSearchText(
    [
      item.name,
      item.category,
      item.sku,
      item.barcode,
      item.serial,
      item.lotNumber,
      item.locationName,
      item.binLocation,
      item.status,
      item.manufacturer,
      item.manufacturerItemId,
      item.modelNumber,
      item.warrantyProvider,
      item.lifecycleStatus,
      item.notes,
      item.lifecycleNotes,
    ].join(" ")
  );
}

function isWarrantyExpired(item: InventoryItem): boolean {
  if (!item.warrantyEndDate) return false;
  const end = new Date(`${item.warrantyEndDate}T00:00:00`);
  return Number.isFinite(end.getTime()) && end < new Date();
}

function isServiceDue(item: InventoryItem): boolean {
  if (!item.nextServiceDate) return false;
  const due = new Date(`${item.nextServiceDate}T00:00:00`);
  return Number.isFinite(due.getTime()) && due <= new Date();
}

export default function InventoryPage() {
  const { loading: authLoading, isAdmin, isStaff } = useAuthRole();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<InventoryForm>(initialForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InventoryStatus>(
    "all"
  );
  const [lifecycleFilter, setLifecycleFilter] = useState<
    "all" | LifecycleStatus
  >("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);

  const canRead = isAdmin || isStaff;
  const canWrite = isAdmin || isStaff;

  useEffect(() => {
    if (authLoading) return;

    if (!canRead) {
      setItems([]);
      setLoading(false);
      toast.error("You do not have permission to view inventory.");
      return;
    }

    const inventoryQuery = query(
      collection(db, "inventory"),
      orderBy("name", "asc"),
      limit(INVENTORY_LIMIT)
    );

    const unsubscribe = onSnapshot(
      inventoryQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) =>
          normalizeInventoryItem(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          )
        );

        setItems(rows);
        setLoading(false);
      },
      (error: unknown) => {
        console.error("LOAD INVENTORY ERROR:", error);
        setLoading(false);
        toast.error("Inventory could not be loaded.");
      }
    );

    return () => unsubscribe();
  }, [authLoading, canRead]);

  const filteredItems = useMemo(() => {
    const term = normalizeSearchText(search);

    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;

      if (
        lifecycleFilter !== "all" &&
        item.lifecycleStatus !== lifecycleFilter
      ) {
        return false;
      }

      if (!term) return true;

      const haystack = normalizeSearchText(
        [
          item.name,
          item.category,
          item.sku,
          item.barcode,
          item.serial,
          item.lotNumber,
          item.locationName,
          item.binLocation,
          item.status,
          item.manufacturer,
          item.manufacturerItemId,
          item.modelNumber,
          item.warrantyProvider,
          item.lifecycleStatus,
          item.notes,
          item.lifecycleNotes,
        ].join(" ")
      );

      return haystack.includes(term);
    });
  }, [items, search, statusFilter, lifecycleFilter]);

  const selectedVisibleCount = useMemo(() => {
    const visibleSet = new Set(filteredItems.map((item) => item.id));
    return selectedIds.filter((id) => visibleSet.has(id)).length;
  }, [filteredItems, selectedIds]);

  const summary = useMemo(() => {
    return {
      totalItems: items.length,
      available: items.filter((item) => item.status === "available").length,
      discontinued: items.filter((item) => item.status === "discontinued")
        .length,
      serviceDue: items.filter(isServiceDue).length,
      warrantyExpired: items.filter(isWarrantyExpired).length,
      totalValue: items.reduce((sum, item) => sum + item.totalValue, 0),
    };
  }, [items]);

  function resetForm() {
    setForm(initialForm);
  }

  function updateForm<K extends keyof InventoryForm>(
    key: K,
    value: InventoryForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openScanner(target: ScanTarget) {
    setScanTarget(target);
    setScannerOpen(true);
  }

  function handleScanDetected(code: string) {
    const clean = normalizeBarcode(code);

    if (scanTarget === "serial") updateForm("serial", clean);
    else if (scanTarget === "lotNumber") updateForm("lotNumber", clean);
    else updateForm("barcode", clean);

    toast.success("Scan captured.");
  }

  function handleEdit(item: InventoryItem) {
    setForm({
      id: item.id,
      productId: item.productId,
      name: item.name,
      category: item.category,
      sku: item.sku,
      barcode: item.barcode,
      serial: item.serial,
      lotNumber: item.lotNumber,
      locationName: item.locationName,
      binLocation: item.binLocation,
      quantityOnHand: String(item.quantityOnHand),
      committed: String(item.committed),
      onRent: String(item.onRent),
      onOrder: String(item.onOrder),
      reorderLevel: String(item.reorderLevel),
      unitCost: String(item.unitCost),
      status: item.status,
      manufacturer: item.manufacturer,
      manufacturerItemId: item.manufacturerItemId,
      modelNumber: item.modelNumber,
      warrantyProvider: item.warrantyProvider,
      warrantyStartDate: item.warrantyStartDate,
      warrantyEndDate: item.warrantyEndDate,
      warrantyNotes: item.warrantyNotes,
      purchaseDate: item.purchaseDate,
      usefulLifeMonths: String(item.usefulLifeMonths || 60),
      lifecycleStatus: item.lifecycleStatus,
      nextServiceDate: item.nextServiceDate,
      lifecycleNotes: item.lifecycleNotes,
      notes: item.notes,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logMovement(args: {
    productId: string;
    productName: string;
    barcode: string;
    serial: string;
    lotNumber: string;
    type: string;
    quantity: number;
    sourceId: string;
    notes: string;
  }) {
    await addDoc(collection(db, "stockMovements"), {
      ...args,
      source: "inventory",
      createdAt: serverTimestamp(),
    });
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

    const normalizedBarcode = form.barcode.trim()
      ? normalizeBarcode(form.barcode)
      : "";

    const payload: Omit<InventoryItem, "id"> = {
      productId: form.productId.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      sku: form.sku.trim(),
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

    setSaving(true);

    try {
      if (form.id) {
        await updateDoc(doc(db, "inventory", form.id), {
          ...payload,
          searchText: buildSearchText(payload),
          updatedAt: serverTimestamp(),
        });

        await logMovement({
          productId: payload.productId,
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
        const result = await smartMergeInventory({
          productId: payload.productId,
          name: payload.name,
          category: payload.category,
          manufacturer: payload.manufacturer,
          manufacturerItemId: payload.manufacturerItemId,
          sku: payload.sku,
          barcode: payload.barcode,
          serial: payload.serial,
          lotNumber: payload.lotNumber,
          expirationDate: "",
          locationName: payload.locationName,
          binLocation: payload.binLocation,
          quantityOnHand: payload.quantityOnHand,
          committed: payload.committed,
          onRent: payload.onRent,
          onOrder: payload.onOrder,
          reorderLevel: payload.reorderLevel,
          unitCost: payload.unitCost,
          status:
            payload.status === "discontinued" ? "inactive" : payload.status,
          notes: payload.notes,
          source: "inventory",
          sourceId: "manual_entry",
        });

        await updateDoc(doc(db, "inventory", result.inventoryId), {
          ...payload,
          searchText: buildSearchText(payload),
          updatedAt: serverTimestamp(),
        });

        toast.success(
          result.action === "created"
            ? "Inventory added."
            : "Inventory merged with existing stock."
        );
      }

      resetForm();
    } catch (error: unknown) {
      console.error("SAVE INVENTORY ERROR:", error);
      toast.error("Inventory could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: InventoryItem) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (!window.confirm(`Delete "${item.name}"?`)) return;

    try {
      await deleteDoc(doc(db, "inventory", item.id));

      await logMovement({
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        serial: item.serial,
        lotNumber: item.lotNumber,
        type: "inventory_delete",
        quantity: item.quantityOnHand,
        sourceId: item.id,
        notes: "Inventory record deleted.",
      });

      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      toast.success("Inventory deleted.");
    } catch (error: unknown) {
      console.error("DELETE INVENTORY ERROR:", error);
      toast.error("Delete failed.");
    }
  }

  async function handleDiscontinue(item: InventoryItem) {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    try {
      await updateDoc(doc(db, "inventory", item.id), {
        status: "discontinued",
        lifecycleStatus: "retired",
        updatedAt: serverTimestamp(),
      });

      await logMovement({
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        serial: item.serial,
        lotNumber: item.lotNumber,
        type: "inventory_discontinued",
        quantity: item.quantityOnHand,
        sourceId: item.id,
        notes: "Inventory item discontinued.",
      });

      toast.success("Item discontinued.");
    } catch (error: unknown) {
      console.error("DISCONTINUE INVENTORY ERROR:", error);
      toast.error("Could not discontinue item.");
    }
  }

  async function handleBatchDelete() {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (!selectedIds.length) {
      toast.error("Select items first.");
      return;
    }

    if (!window.confirm(`Delete ${selectedIds.length} selected item(s)?`)) {
      return;
    }

    try {
      const chunks = chunkArray(selectedIds, FIRESTORE_BATCH_LIMIT);

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach((id) => {
          batch.delete(doc(db, "inventory", id));
        });

        await batch.commit();
      }

      setSelectedIds([]);
      toast.success("Selected items deleted.");
    } catch (error: unknown) {
      console.error("BATCH DELETE INVENTORY ERROR:", error);
      toast.error("Batch delete failed.");
    }
  }

  async function handleBatchDiscontinue() {
    if (!canWrite) {
      toast.error("You do not have permission.");
      return;
    }

    if (!selectedIds.length) {
      toast.error("Select items first.");
      return;
    }

    try {
      const chunks = chunkArray(selectedIds, FIRESTORE_BATCH_LIMIT);

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach((id) => {
          batch.update(doc(db, "inventory", id), {
            status: "discontinued",
            lifecycleStatus: "retired",
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      setSelectedIds([]);
      toast.success("Selected items discontinued.");
    } catch (error: unknown) {
      console.error("BATCH DISCONTINUE INVENTORY ERROR:", error);
      toast.error("Batch discontinue failed.");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    const visibleIds = filteredItems.map((item) => item.id);

    if (!visibleIds.length) {
      setSelectedIds([]);
      return;
    }

    const allVisibleSelected = visibleIds.every((id) =>
      selectedIds.includes(id)
    );

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="w-full max-w-none space-y-6">
        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Boxes className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">Inventory</h1>
                <p className="text-sm text-neutral-400">
                  Stock, lots, serials, manufacturers, warranty, lifecycle, and
                  batch controls.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Items" value={summary.totalItems} />
          <StatCard label="Available" value={summary.available} />
          <StatCard label="Discontinued" value={summary.discontinued} />
          <StatCard label="Service Due" value={summary.serviceDue} warning />
          <StatCard
            label="Warranty Expired"
            value={summary.warrantyExpired}
            warning
          />
          <StatCard label="Value" value={`$${summary.totalValue.toFixed(2)}`} />
        </section>

        <section className="grid gap-6 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                {form.id ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <PackagePlus className="h-5 w-5" />
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  {form.id ? "Edit Item" : "Add Item"}
                </h2>
                <p className="text-sm text-neutral-400">
                  Add stock details, warranty, and lifecycle tracking.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <FieldGroup title="Core Item">
                <TextInput
                  label="Item Name"
                  value={form.name}
                  onChange={(value) => updateForm("name", value)}
                  required
                />

                <TextInput
                  label="Category"
                  value={form.category}
                  onChange={(value) => updateForm("category", value)}
                  required
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="SKU"
                    value={form.sku}
                    onChange={(value) => updateForm("sku", value)}
                  />

                  <ScanInput
                    label="Barcode"
                    value={form.barcode}
                    onChange={(value) => updateForm("barcode", value)}
                    onScan={() => openScanner("barcode")}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ScanInput
                    label="Serial"
                    value={form.serial}
                    onChange={(value) => updateForm("serial", value)}
                    onScan={() => openScanner("serial")}
                  />

                  <ScanInput
                    label="Lot Number"
                    value={form.lotNumber}
                    onChange={(value) => updateForm("lotNumber", value)}
                    onScan={() => openScanner("lotNumber")}
                  />
                </div>
              </FieldGroup>

              <FieldGroup title="Manufacturer">
                <TextInput
                  label="Manufacturer"
                  value={form.manufacturer}
                  onChange={(value) => updateForm("manufacturer", value)}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Manufacturer Item ID"
                    value={form.manufacturerItemId}
                    onChange={(value) =>
                      updateForm("manufacturerItemId", value)
                    }
                  />

                  <TextInput
                    label="Model Number"
                    value={form.modelNumber}
                    onChange={(value) => updateForm("modelNumber", value)}
                  />
                </div>
              </FieldGroup>

              <FieldGroup title="Stock">
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Location"
                    value={form.locationName}
                    onChange={(value) => updateForm("locationName", value)}
                  />

                  <TextInput
                    label="Bin / Shelf"
                    value={form.binLocation}
                    onChange={(value) => updateForm("binLocation", value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Quantity"
                    type="number"
                    value={form.quantityOnHand}
                    onChange={(value) => updateForm("quantityOnHand", value)}
                  />

                  <TextInput
                    label="Unit Cost"
                    type="number"
                    value={form.unitCost}
                    onChange={(value) => updateForm("unitCost", value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <TextInput
                    label="Committed"
                    type="number"
                    value={form.committed}
                    onChange={(value) => updateForm("committed", value)}
                  />

                  <TextInput
                    label="On Rent"
                    type="number"
                    value={form.onRent}
                    onChange={(value) => updateForm("onRent", value)}
                  />

                  <TextInput
                    label="On Order"
                    type="number"
                    value={form.onOrder}
                    onChange={(value) => updateForm("onOrder", value)}
                  />

                  <TextInput
                    label="Reorder"
                    type="number"
                    value={form.reorderLevel}
                    onChange={(value) => updateForm("reorderLevel", value)}
                  />
                </div>
              </FieldGroup>

              <FieldGroup title="Warranty">
                <TextInput
                  label="Warranty Provider"
                  value={form.warrantyProvider}
                  onChange={(value) => updateForm("warrantyProvider", value)}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Warranty Start"
                    type="date"
                    value={form.warrantyStartDate}
                    onChange={(value) => updateForm("warrantyStartDate", value)}
                  />

                  <TextInput
                    label="Warranty End"
                    type="date"
                    value={form.warrantyEndDate}
                    onChange={(value) => updateForm("warrantyEndDate", value)}
                  />
                </div>

                <Textarea
                  label="Warranty Notes"
                  value={form.warrantyNotes}
                  onChange={(value) => updateForm("warrantyNotes", value)}
                />
              </FieldGroup>

              <FieldGroup title="Lifecycle">
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Purchase Date"
                    type="date"
                    value={form.purchaseDate}
                    onChange={(value) => updateForm("purchaseDate", value)}
                  />

                  <TextInput
                    label="Useful Life Months"
                    type="number"
                    value={form.usefulLifeMonths}
                    onChange={(value) => updateForm("usefulLifeMonths", value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <SelectInput
                    label="Lifecycle Status"
                    value={form.lifecycleStatus}
                    onChange={(value) =>
                      updateForm("lifecycleStatus", value as LifecycleStatus)
                    }
                    options={[
                      "new",
                      "active",
                      "needs_service",
                      "end_of_life",
                      "retired",
                    ]}
                  />

                  <TextInput
                    label="Next Service Date"
                    type="date"
                    value={form.nextServiceDate}
                    onChange={(value) => updateForm("nextServiceDate", value)}
                  />
                </div>

                <Textarea
                  label="Lifecycle Notes"
                  value={form.lifecycleNotes}
                  onChange={(value) => updateForm("lifecycleNotes", value)}
                />
              </FieldGroup>

              <SelectInput
                label="Inventory Status"
                value={form.status}
                onChange={(value) =>
                  updateForm("status", value as InventoryStatus)
                }
                options={[
                  "available",
                  "inactive",
                  "damaged",
                  "lost",
                  "discontinued",
                ]}
              />

              <Textarea
                label="General Notes"
                value={form.notes}
                onChange={(value) => updateForm("notes", value)}
              />

              <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-neutral-300">
                Available:{" "}
                <span className="font-bold text-white">
                  {(
                    toSafeNumber(form.quantityOnHand) -
                    toSafeNumber(form.committed) -
                    toSafeNumber(form.onRent)
                  ).toLocaleString()}
                </span>{" "}
                • Total Value:{" "}
                <span className="font-bold text-white">
                  $
                  {(
                    toSafeNumber(form.quantityOnHand) *
                    toSafeNumber(form.unitCost)
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !canWrite}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Inventory
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm hover:bg-white/15"
                >
                  Clear
                </button>
              </div>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">Inventory Records</h2>
                <p className="text-sm text-neutral-400">
                  {filteredItems.length.toLocaleString()} visible records
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-500" />

                  <input
                    value={search}
                    title="Search inventory"
                    aria-label="Search inventory"
                    placeholder="Search inventory..."
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-white/30 xl:w-80"
                  />
                </div>

                <select
                  title="Filter by inventory status"
                  aria-label="Filter by inventory status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "all" | InventoryStatus
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="all">All statuses</option>
                  <option value="available">Available</option>
                  <option value="inactive">Inactive</option>
                  <option value="damaged">Damaged</option>
                  <option value="lost">Lost</option>
                  <option value="discontinued">Discontinued</option>
                </select>

                <select
                  title="Filter by lifecycle status"
                  aria-label="Filter by lifecycle status"
                  value={lifecycleFilter}
                  onChange={(event) =>
                    setLifecycleFilter(
                      event.target.value as "all" | LifecycleStatus
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="all">All lifecycle</option>
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="needs_service">Needs Service</option>
                  <option value="end_of_life">End Of Life</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                <CheckSquare className="h-4 w-4" />
                Select Visible
              </button>

              <button
                type="button"
                onClick={() => void handleBatchDiscontinue()}
                disabled={!selectedIds.length}
                className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Discontinue Selected
              </button>

              <button
                type="button"
                onClick={() => void handleBatchDelete()}
                disabled={!selectedIds.length}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Selected
              </button>

              <span className="rounded-2xl border border-white/10 bg-black px-4 py-2 text-sm text-neutral-400">
                Selected: {selectedIds.length}
                {selectedVisibleCount !== selectedIds.length
                  ? ` (${selectedVisibleCount} visible)`
                  : ""}
              </span>
            </div>

            {authLoading || loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading inventory...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black p-6 text-center text-sm text-neutral-400">
                No inventory records found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[1550px] text-left text-sm">
                  <thead className="bg-white/5 text-neutral-400">
                    <tr>
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Manufacturer</th>
                      <th className="px-4 py-3">IDs</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Warranty</th>
                      <th className="px-4 py-3">Lifecycle</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-white/10 align-top hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            title={`Select ${item.name}`}
                            aria-label={`Select ${item.name}`}
                            onChange={() => toggleSelected(item.id)}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-xs text-neutral-500">
                            {item.category || "-"}
                          </div>
                          <StatusPill value={item.status} />
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div>{item.manufacturer || "-"}</div>
                          <div className="text-xs text-neutral-500">
                            MFG ID: {item.manufacturerItemId || "-"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Model: {item.modelNumber || "-"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div>SKU: {item.sku || "-"}</div>
                          <div>Barcode: {item.barcode || "-"}</div>
                          <div>Serial: {item.serial || "-"}</div>
                          <div>Lot: {item.lotNumber || "-"}</div>
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div>On Hand: {item.quantityOnHand}</div>
                          <div>Available: {item.available}</div>
                          <div>On Rent: {item.onRent}</div>
                          <div>On Order: {item.onOrder}</div>
                          <div>Value: ${item.totalValue.toFixed(2)}</div>
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div>{item.warrantyProvider || "-"}</div>
                          <div className="text-xs text-neutral-500">
                            Start: {item.warrantyStartDate || "-"}
                          </div>
                          <div
                            className={`text-xs ${
                              isWarrantyExpired(item)
                                ? "text-red-300"
                                : "text-neutral-500"
                            }`}
                          >
                            End: {item.warrantyEndDate || "-"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div className="flex items-center gap-2 capitalize">
                            <CalendarClock className="h-4 w-4" />
                            {humanize(item.lifecycleStatus)}
                          </div>
                          <div
                            className={`text-xs ${
                              isServiceDue(item)
                                ? "text-yellow-300"
                                : "text-neutral-500"
                            }`}
                          >
                            Service: {item.nextServiceDate || "-"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Life: {item.usefulLifeMonths || 0} months
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="rounded-xl border border-white/10 bg-white/10 p-2 hover:bg-white/15"
                              title="Edit"
                              aria-label={`Edit ${item.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDiscontinue(item)}
                              className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-2 text-yellow-200 hover:bg-yellow-500/20"
                              title="Discontinue"
                              aria-label={`Discontinue ${item.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDelete(item)}
                              className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                              title="Delete"
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
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
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm text-neutral-300"
      >
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
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
      />
    </div>
  );
}

function ScanInput({
  label,
  value,
  onChange,
  onScan,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
}) {
  const inputId = useId();

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm text-neutral-300"
      >
        {label}
      </label>

      <div className="flex gap-2">
        <input
          id={inputId}
          value={value}
          title={label}
          aria-label={label}
          placeholder={label}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
        />

        <button
          type="button"
          onClick={onScan}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 hover:bg-white/15"
          title={`Scan ${label}`}
          aria-label={`Scan ${label}`}
        >
          <Barcode className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const selectId = useId();

  return (
    <div>
      <label
        htmlFor={selectId}
        className="mb-2 block text-sm text-neutral-300"
      >
        {label}
      </label>

      <select
        id={selectId}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        rows={3}
        title={label}
        aria-label={label}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-2xl shadow-black/20 ${
        warning
          ? "border-yellow-500/20 bg-yellow-500/10"
          : "border-white/10 bg-neutral-950"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          {warning ? (
            <AlertTriangle className="h-5 w-5 text-yellow-300" />
          ) : (
            <Boxes className="h-5 w-5" />
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

function StatusPill({ value }: { value: string }) {
  return (
    <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs capitalize text-neutral-200">
      {humanize(value)}
    </span>
  );
}