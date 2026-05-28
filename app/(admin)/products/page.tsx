"use client";

import { useEffect, useMemo, useState } from "react";

import {
  PackageSearch,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import toast from "react-hot-toast";

import { colors, glass, typography } from "@/theme";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
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
  const {
    loading: authLoading,
    isAdmin,
    isStaff,
    user,
  } = useAuthRole();

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
    useState<ProductFormType>(
      initialProductForm
    );

  const [filters, setFilters] =
    useState<ProductFiltersState>(
      initialProductFilters
    );

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [
    showAdvanced,
    setShowAdvanced,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Initial Load
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (authLoading) return;

    if (!canRead) {
      toast.error(
        "You do not have permission to view products."
      );

      return;
    }

    void loadProducts("reset");
  }, [
    authLoading,
    canRead,
    loadProducts,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Derived State
  |--------------------------------------------------------------------------
  */

  const categories =
    useMemo(
      () =>
        uniqueOptions(
          products,
          "category"
        ),
      [products]
    );

  const manufacturers =
    useMemo(
      () =>
        uniqueOptions(
          products,
          "manufacturer"
        ),
      [products]
    );

  const vendors =
    useMemo(
      () =>
        vendorOptions(products),
      [products]
    );

  const filteredProducts =
    useMemo(
      () =>
        filterAndSortProducts(
          products,
          filters
        ),
      [products, filters]
    );

  const stats = useMemo(
    () => productStats(products),
    [products]
  );

  const allVisibleSelected =
    filteredProducts.length >
      0 &&
    filteredProducts.every(
      (product) =>
        selectedIds.includes(
          product.id
        )
    );

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  function resetForm() {
    setForm(initialProductForm);

    setShowAdvanced(false);
  }

  function resetFilters() {
    setFilters(
      initialProductFilters
    );
  }

  function handleEdit(
    product: Product
  ) {
    setForm({
      ...product,

      basePrice:
        product.basePrice
          ? String(
              product.basePrice
            )
          : "",

      defaultPurchasePrice:
        product.defaultPurchasePrice
          ? String(
              product.defaultPurchasePrice
            )
          : "",

      defaultRentalRate:
        product.defaultRentalRate
          ? String(
              product.defaultRentalRate
            )
          : "",

      reorderLevel:
        product.reorderLevel
          ? String(
              product.reorderLevel
            )
          : "",

      warrantyMonths:
        product.warrantyMonths
          ? String(
              product.warrantyMonths
            )
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

    try {
      const success =
        await saveProduct(form);

      if (success) {
        resetForm();
      }
    } catch {
      toast.error(
        "Failed to save product."
      );
    }
  }

  function handleScanDetected(
    code: string
  ) {
    if (!scannerOpen) return;

    const clean =
      normalizeBarcode(code);

    setForm((prev) => ({
      ...prev,
      upc: clean,
    }));

    setFilters((prev) => ({
      ...prev,
      search: clean,
    }));

    toast.success(
      "UPC captured."
    );

    setScannerOpen(false);
  }

  function toggleSelectVisible() {
    const visibleIds =
      filteredProducts.map(
        (product) =>
          product.id
      );

    if (allVisibleSelected) {
      unselectVisible(
        visibleIds
      );

      return;
    }

    selectVisible(
      visibleIds
    );
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
      <main
        className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
      >
        <div
          aria-hidden="true"
          className={colors.grid}
        />

        <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.18)]">
            Product catalog access denied.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div
        aria-hidden="true"
        className={colors.grid}
      />

      <div
        className={`${glass.shell} relative z-10`}
      >
        <section
          className={`${glass.panel} relative overflow-hidden`}
        >
          <div
            aria-hidden="true"
            className={colors.grid}
          />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                <ShieldCheck className="h-3.5 w-3.5" />

                Product Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Product Command Center
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Operational product catalog management for inventory routing,
                  HCPCS mapping, vendor tracking, pricing, warranty oversight,
                  barcode intake, reorder monitoring, and lifecycle visibility.
                  Because eventually somebody uploads 400 duplicate walkers and
                  calls it “an import issue.”
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                  <PackageSearch className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      Product System
                    </p>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />

                      Online
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    HCPCS + vendor intelligence active
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                <ScanLine className="h-3.5 w-3.5 text-sky-200" />

                Barcode intake system operational
              </div>
            </div>
          </div>
        </section>

        <ProductHero
          loadingProducts={
            loadingProducts
          }
          purging={purging}
          productsCount={
            products.length
          }
          isAdmin={isAdmin}
          onRefresh={() =>
            void loadProducts(
              "reset"
            )
          }
          onPurge={() =>
            void purgeLoadedProducts()
          }
        />

        <ProductStatsGrid
          stats={stats}
        />

        {stats.highRisk >
        0 ? (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100 shadow-[0_0_45px_rgba(251,191,36,0.12)] backdrop-blur-2xl">
            <div className="flex items-stretch gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <h2 className="font-semibold">
                  Catalog cleanup required
                </h2>

                <p className="mt-1 text-sm text-amber-100/80">
                  {stats.highRisk.toLocaleString()} product
                  record
                  {stats.highRisk ===
                  1
                    ? ""
                    : "s"}{" "}
                  contain high-risk
                  catalog issues.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <ProductForm
            form={form}
            showAdvanced={
              showAdvanced
            }
            categories={
              categories
            }
            manufacturers={
              manufacturers
            }
            vendors={vendors}
            saving={saving}
            canWrite={canWrite}
            onSubmit={
              handleSubmit
            }
            onFormChange={(
              updates
            ) =>
              setForm(
                (prev) => ({
                  ...prev,
                  ...updates,
                })
              )
            }
            onClear={
              resetForm
            }
            onToggleAdvanced={() =>
              setShowAdvanced(
                (prev) => !prev
              )
            }
            onOpenScanner={() =>
              setScannerOpen(
                true
              )
            }
          />

          <section
            className={`${glass.panel} relative overflow-hidden`}
          >
            <div
              aria-hidden="true"
              className={colors.grid}
            />

            <div className="relative z-10 min-w-0 p-6">
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className={typography.sectionTitle}>
                    Product Catalog
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {filteredProducts.length.toLocaleString()} visible
                    from{" "}
                    {products.length.toLocaleString()} loaded
                    records
                  </p>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={
                      filters.search
                    }
                    onChange={(
                      event
                    ) =>
                      setFilters(
                        (
                          prev
                        ) => ({
                          ...prev,
                          search:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-10 text-sm text-slate-100 outline-none backdrop-blur-xl focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 xl:w-[420px]"
                    placeholder="Search name, SKU, UPC, HCPCS..."
                    aria-label="Search products"
                  />

                  {filters.search ? (
                    <button
                      type="button"
                      onClick={() =>
                        setFilters(
                          (
                            prev
                          ) => ({
                            ...prev,
                            search:
                              "",
                          })
                        )
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
                categories={
                  categories
                }
                manufacturers={
                  manufacturers
                }
                vendors={vendors}
                selectedCount={
                  selectedIds.length
                }
                allVisibleSelected={
                  allVisibleSelected
                }
                deleting={
                  deleting
                }
                filteredCount={
                  filteredProducts.length
                }
                loadedCount={
                  products.length
                }
                onFilterChange={(
                  key,
                  value
                ) =>
                  setFilters(
                    (
                      prev
                    ) => ({
                      ...prev,
                      [key]:
                        value,
                    })
                  )
                }
                onResetFilters={
                  resetFilters
                }
                onToggleVisible={
                  toggleSelectVisible
                }
                onBatchArchive={() =>
                  void batchSoftDeleteProducts()
                }
              />

              <div className="mt-5">
                <ProductCatalog
                  products={
                    filteredProducts
                  }
                  selectedIds={
                    selectedIds
                  }
                  loadingProducts={
                    loadingProducts
                  }
                  loadingMore={
                    loadingMore
                  }
                  hasMore={hasMore}
                  authLoading={
                    authLoading
                  }
                  onSelect={
                    toggleSelected
                  }
                  onEdit={
                    handleEdit
                  }
                  onArchive={(
                    product
                  ) =>
                    void softDeleteProduct(
                      product
                    )
                  }
                  onLoadMore={() =>
                    void loadProducts(
                      "more"
                    )
                  }
                />
              </div>
            </div>
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() =>
          setScannerOpen(false)
        }
        onDetected={
          handleScanDetected
        }
      />
    </main>
  );
}