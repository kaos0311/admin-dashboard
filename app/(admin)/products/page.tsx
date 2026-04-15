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
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  Boxes,
  DollarSign,
  Archive,
  Tag,
} from "lucide-react";

type ProductStatus = "Active" | "Out of Stock" | "Draft" | "Archived";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock?: number;
  status: ProductStatus;
  description?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

type ProductFormData = {
  name: string;
  category: string;
  price: string;
  stock: string;
  status: ProductStatus;
  description: string;
};

const STATUS_OPTIONS: ProductStatus[] = [
  "Active",
  "Out of Stock",
  "Draft",
  "Archived",
];

const EMPTY_FORM: ProductFormData = {
  name: "",
  category: "",
  price: "",
  stock: "",
  status: "Active",
  description: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

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

function getStatusClasses(status: ProductStatus) {
  switch (status) {
    case "Active":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    case "Out of Stock":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    case "Draft":
      return "bg-slate-500/15 text-slate-300 border border-slate-500/20";
    case "Archived":
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

function ProductModal({
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
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
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
              {mode === "add" ? "Add Product" : "Edit Product"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Manage catalog details, stock, and product status.
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
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Product Name
            </label>
            <input
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter product name"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Category
            </label>
            <input
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              placeholder="Mobility, Respiratory, etc."
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
                  status: e.target.value as ProductStatus,
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
              Price
            </label>
            <input
              inputMode="decimal"
              value={formData.price}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, price: e.target.value }))
              }
              placeholder="0.00"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Stock
            </label>
            <input
              inputMode="numeric"
              value={formData.stock}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, stock: e.target.value }))
              }
              placeholder="0"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Description
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Optional description or notes"
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
            {mode === "add" ? "Create Product" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { isAdmin, loading: roleLoading } = useAuthRole();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ProductStatus>(
    "All"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      setError("You must be signed in to view products.");
      return;
    }

    const q = query(collection(db, "products"), orderBy("name"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextProducts: Product[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Product, "id">),
        }));

        setProducts(nextProducts);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading products:", err);
        setError(err.message || "Failed to load products.");
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("Products unsubscribe failed:", err);
      }
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.status.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.id.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || product.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === "Active").length;
  const outOfStockProducts = products.filter(
    (p) => p.status === "Out of Stock" || (p.stock ?? 0) <= 0
  ).length;
  const inventoryValue = products.reduce(
    (sum, product) => sum + product.price * (product.stock ?? 0),
    0
  );

  function resetModal() {
    setModalOpen(false);
    setSelectedProductId(null);
    setFormData(EMPTY_FORM);
  }

  function openAddModal() {
    if (!isAdmin) return;
    setModalMode("add");
    setSelectedProductId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
  if (!isAdmin) return;

  setModalMode("edit");
  setSelectedProductId(product.id);
  setFormData({
    name: product.name ?? "",
    category: product.category ?? "",
    price: String(product.price ?? ""),
    stock: String(product.stock ?? 0),
    status: product.status ?? "Active",
    description: product.description ?? "",
  });
  setModalOpen(true);
}

  async function handleSaveProduct() {
  if (!isAdmin) return;

  const name = formData.name.trim();
  const category = formData.category.trim();
  const price = Number(formData.price);
  const stock = Number(formData.stock || 0);
  const description = formData.description.trim();
  const status = formData.status ?? "Active";

  if (!name || !category || Number.isNaN(price)) {
    alert("Please fill out product name, category, and a valid price.");
    return;
  }

  setSaving(true);

  try {
    if (selectedProductId) {
      await updateDoc(doc(db, "products", selectedProductId), {
        name,
        category,
        price,
        stock,
        status,
        description,
        updatedAt: serverTimestamp(),
      });
    } else {
      const newRef = doc(collection(db, "products"));
      await setDoc(newRef, {
        name,
        category,
        price,
        stock,
        status,
        description,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    resetModal();
  } catch (err) {
    console.error("Error saving product:", err);
    alert("Failed to save product.");
  } finally {
    setSaving(false);
  }
}

  async function removeProduct(productId: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "products", productId));
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to delete product.");
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
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage your inventory and product catalog from one clean workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Products"
            value={totalProducts}
            subtitle="Total catalog items"
            icon={<Boxes className="h-5 w-5" />}
          />
          <StatCard
            title="Active"
            value={activeProducts}
            subtitle="Currently available"
            icon={<Tag className="h-5 w-5" />}
          />
          <StatCard
            title="Out of Stock"
            value={outOfStockProducts}
            subtitle="Needs attention"
            icon={<Archive className="h-5 w-5" />}
          />
          <StatCard
            title="Inventory Value"
            value={formatCurrency(inventoryValue)}
            subtitle="Based on current stock"
            icon={<DollarSign className="h-5 w-5" />}
          />
        </div>

        <SectionCard
          title="All Products"
          subtitle="Search, filter, and manage your full inventory."
        >
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, category, status, description, or ID"
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "All" | ProductStatus)
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
                  Add Product
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20">
                <div className="inline-flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-slate-300 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading products...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
                {error}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-black/20 text-slate-400 shadow-sm">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  No products found
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Try adjusting your search or filters, or add your first
                  product to get started.
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-3xl bg-black/20 p-5 transition hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {product.name}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            product.status
                          )}`}
                        >
                          {product.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                        <span>Category: {product.category}</span>
                        <span>Price: {formatCurrency(product.price)}</span>
                        <span>Stock: {product.stock ?? 0}</span>
                        <span>Created: {formatDate(product.createdAt)}</span>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        ID: {product.id}
                      </p>

                      {product.description ? (
                        <p className="mt-3 max-w-3xl text-sm text-slate-300">
                          {product.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-white/10 hover:text-white"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-slate-500">View only</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <ProductModal
        open={modalOpen}
        mode={modalMode}
        formData={formData}
        setFormData={setFormData}
        onClose={resetModal}
        onSubmit={handleSaveProduct}
        saving={saving}
      />
    </>
  );
}