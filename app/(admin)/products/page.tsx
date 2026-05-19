"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldAlert, X } from "lucide-react";
import toast from "react-hot-toast";

import BarcodeScannerModal from "@/app/components/barcode/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { normalizeBarcode } from "@/lib/barcode";

import { ProductCatalog } from "./components/ProductCatalog";
import { ProductFilters } from "./components/ProductFilters";
import { ProductForm } from "./components/ProductForm";
import { ProductHero } from "./components/ProductHero";
import { ProductStatsGrid } from "./components/ProductStatsGrid";

import { useProducts } from "./hooks/useProducts";

import {
  filterAndSortProducts,
  productStats,
  uniqueOptions,
  vendorOptions,
} from "./utils/productFilters";

import {
  initialProductFilters,
  initialProductForm,
  type Product,
  type ProductFiltersState,
  type ProductForm as ProductFormType,
} from "./utils/productTypes";

export default function ProductsPage() {
  const { loading: authLoading, isAdmin, isStaff, user } = useAuthRole();

  const canRead = isAdmin || isStaff;
  const canWrite = isAdmin || isStaff;

  const {
    products,
    selectedIds,
    toggleSelected,
    selectVisible,
    unselectVisible,

    hasMore,
    loadingProducts,
    loadingMore,
    saving,
    deleting,
    purging,

    loadProducts,
    saveProduct,
    softDeleteProduct,
    batchSoftDeleteProducts,
    purgeLoadedProducts,
  } = useProducts({
    canRead,
    canWrite,
    isAdmin,
    user,
  });

  const [form, setForm] =
    useState<ProductFormType>(initialProductForm);

  const [filters, setFilters] =
    useState<ProductFiltersState>(initialProductFilters);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!canRead) {
      toast.error("You do not have permission to view products.");
      return;
    }

    void loadProducts("reset");
  }, [authLoading, canRead, loadProducts]);

  const categories = useMemo(
    () => uniqueOptions(products, "category"),
    [products]
  );

  const manufacturers = useMemo(
    () => uniqueOptions(products, "manufacturer"),
    [products]
  );

  const vendors = useMemo(
    () => vendorOptions(products),
    [products]
  );

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, filters),
    [products, filters]
  );

  const stats = useMemo(
    () => productStats(products),
    [products]
  );

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) =>
      selectedIds.includes(product.id)
    );

  function resetForm() {
    setForm(initialProductForm);
    setShowAdvanced(false);
  }

  function resetFilters() {
    setFilters(initialProductFilters);
  }

  function handleEdit(product: Product) {
    setForm({
      ...product,
      basePrice: product.basePrice
        ? String(product.basePrice)
        : "",

      defaultPurchasePrice:
        product.defaultPurchasePrice
          ? String(product.defaultPurchasePrice)
          : "",

      defaultRentalRate:
        product.defaultRentalRate
          ? String(product.defaultRentalRate)
          : "",

      reorderLevel: product.reorderLevel
        ? String(product.reorderLevel)
        : "",

      warrantyMonths: product.warrantyMonths
        ? String(product.warrantyMonths)
        : "",
    });

    setShowAdvanced(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const success = await saveProduct(form);

    if (success) {
      resetForm();
    }
  }

  function handleScanDetected(code: string) {
    const clean = normalizeBarcode(code);

    setForm((prev) => ({
      ...prev,
      upc: clean,
    }));

    setFilters((prev) => ({
      ...prev,
      search: clean,
    }));

    toast.success("UPC captured.");
  }

  function toggleSelectVisible() {
    const visibleIds = filteredProducts.map(
      (product) => product.id
    );

    if (allVisibleSelected) {
      unselectVisible(visibleIds);
      return;
    }

    selectVisible(visibleIds);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_30%),#020617] px-4 py-6 text-white md:px-6">
      <div className="mx-auto w-full max-w-[1900px] space-y-6">
        <ProductHero
          loadingProducts={loadingProducts}
          purging={purging}
          productsCount={products.length}
          isAdmin={isAdmin}
          onRefresh={() => void loadProducts("reset")}
          onPurge={() => void purgeLoadedProducts()}
        />

        <ProductStatsGrid stats={stats} />

        {stats.highRisk > 0 ? (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100 shadow-2xl shadow-black/20 backdrop-blur-2xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <h2 className="font-semibold">
                  Catalog cleanup needed
                </h2>

                <p className="mt-1 text-sm text-amber-100/80">
                  {stats.highRisk.toLocaleString()} loaded product
                  record
                  {stats.highRisk === 1 ? "" : "s"} contain
                  high-risk catalog issues.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <ProductForm
            form={form}
            showAdvanced={showAdvanced}
            categories={categories}
            manufacturers={manufacturers}
            vendors={vendors}
            saving={saving}
            canWrite={canWrite}
            onSubmit={handleSubmit}
            onFormChange={(updates) =>
              setForm((prev) => ({
                ...prev,
                ...updates,
              }))
            }
            onClear={resetForm}
            onToggleAdvanced={() =>
              setShowAdvanced((prev) => !prev)
            }
            onOpenScanner={() => setScannerOpen(true)}
          />

          <section className="min-w-0 rounded-[32px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-3xl">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Product Catalog
                </h2>

                <p className="text-sm text-slate-400">
                  {filteredProducts.length.toLocaleString()} visible
                  from {products.length.toLocaleString()} loaded
                  records
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-10 text-sm text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-white/[0.09] xl:w-[420px]"
                  placeholder="Search name, SKU, UPC, HCPCS..."
                  aria-label="Search products"
                />

                {filters.search ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        search: "",
                      }))
                    }
                    className="absolute right-3 top-3.5 text-slate-500 transition hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <ProductFilters
              filters={filters}
              categories={categories}
              manufacturers={manufacturers}
              vendors={vendors}
              selectedCount={selectedIds.length}
              allVisibleSelected={allVisibleSelected}
              deleting={deleting}
              filteredCount={filteredProducts.length}
              loadedCount={products.length}
              onFilterChange={(key, value) =>
                setFilters((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              onResetFilters={resetFilters}
              onToggleVisible={toggleSelectVisible}
              onBatchArchive={() =>
                void batchSoftDeleteProducts()
              }
            />

            <ProductCatalog
              products={filteredProducts}
              selectedIds={selectedIds}
              loadingProducts={loadingProducts}
              loadingMore={loadingMore}
              hasMore={hasMore}
              authLoading={authLoading}
              onSelect={toggleSelected}
              onEdit={handleEdit}
              onArchive={(product) =>
                void softDeleteProduct(product)
              }
              onLoadMore={() => void loadProducts("more")}
            />
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanDetected}
      />
    </main>
  );
}