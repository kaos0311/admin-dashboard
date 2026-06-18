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

import { alerts, colors, glass, typography } from "@/theme";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { useBrightreeReferences } from "@/app/hooks/useBrightreeReferences";

import { normalizeBarcode } from "@/lib/barcode";

import { ProductCatalog } from "./components/ProductCatalog";
import { ProductFilters } from "./components/ProductFilters";
import { ProductForm } from "./components/ProductForm";
import { ProductHero } from "./components/ProductHero";
import { ProductRecallWatch } from "./components/ProductRecallWatch";
import {
  type ProductStatsAction,
  ProductStatsGrid,
} from "./components/ProductStatsGrid";

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
    isAdminOrStaff,
    user,
  } = useAuthRole();

  const canRead = isAdminOrStaff;
  const canWrite = isAdminOrStaff;
  const brightreeReferences = useBrightreeReferences();

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

  const [
    recallFindingsOpen,
    setRecallFindingsOpen,
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
        Array.from(
          new Set([
            ...uniqueOptions(
              products,
              "category"
            ),
            ...brightreeReferences.itemGroups
              .map((item) => item.name)
              .filter(Boolean),
          ])
        ).sort(),
      [brightreeReferences.itemGroups, products]
    );

  const manufacturers =
    useMemo(
      () =>
        Array.from(
          new Set([
            ...uniqueOptions(
              products,
              "manufacturer"
            ),
            ...brightreeReferences.manufacturers
              .map((item) => item.name)
              .filter(Boolean),
          ])
        ).sort(),
      [brightreeReferences.manufacturers, products]
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

  function handleStatsAction(
    action: ProductStatsAction
  ) {
    if (action === "all") {
      resetFilters();
      return;
    }

    if (
      action === "active" ||
      action === "inactive" ||
      action === "discontinued"
    ) {
      setFilters({
        ...initialProductFilters,
        statusFilter: action,
      });
      return;
    }

    setFilters({
      ...initialProductFilters,
      issueFilter: action,
    });

    if (action === "recall") {
      setRecallFindingsOpen(true);
    }
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

    const clean = normalizeBarcode(code);

    if (typeof clean === "string" && clean.trim().length > 0 && /^[A-Z0-9\-]{3,}$/i.test(clean.trim())) {
      const sku = clean.trim();
      const captured = sku;
      setScannerOpen(false);

      void (async () => {
        try {
          const tokenResult = await user?.getIdToken();
          const response = await fetch("/api/jarvis/product-enrichment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(tokenResult ? { Authorization: `Bearer ${tokenResult}` } : {}),
            },
            body: JSON.stringify({ mode: "identifySku", sku }),
          });

          if (!response.ok) {
            throw new Error("Jarvis SKU lookup failed.");
          }

          const json = (await response.json()) as Record<string, unknown>;
          const guess = json.guess as Record<string, unknown> | undefined;

          if (!guess) {
            throw new Error("Jarvis could not identify a product from that SKU.");
          }

          setForm((prev) => ({
            ...prev,
            sku: String(guess.sku ?? prev.sku ?? captured),
            upc: String(guess.upc ?? prev.upc ?? ""),
            name: String(guess.name ?? prev.name ?? ""),
            brand: String(guess.manufacturer ?? prev.brand ?? ""),
            manufacturer: String(guess.manufacturer ?? prev.manufacturer ?? ""),
            model: String(guess.model ?? prev.model ?? ""),
            category: String(guess.category ?? prev.category ?? ""),
            imageUrl: String(guess.imageUrl ?? prev.imageUrl ?? ""),
            thumbnailUrl: String(guess.imageUrl ?? prev.thumbnailUrl ?? ""),
            warrantyMonths: String(guess.warrantyMonths ?? prev.warrantyMonths ?? ""),
          }));

          toast.success("Jarvis filled product details from SKU.");
        } catch (error) {
          console.error("SKU IDENTIFY ERROR:", error);
          setForm((prev) => ({
            ...prev,
            upc: clean,
          }));

          setFilters((prev) => ({
            ...prev,
            search: clean,
          }));

          toast.error(
            error instanceof Error ? error.message : "Could not identify product by SKU."
          );
        }
      })();

      return;
    }

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
          <div className={alerts.danger}>
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
          className={`${glass.panel} relative overflow-visible p-5 sm:p-6`}
        >
          <div
            aria-hidden="true"
            className={colors.grid}
          />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={glass.chip}>
                <ShieldCheck className="h-3.5 w-3.5" />

                Product Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Product Command Center
                </h1>

                <p className={`mt-3 max-w-3xl ${typography.body}`}>
                  Operational product catalog management for inventory routing,
                  HCPCS mapping, vendor tracking, pricing, warranty oversight,
                  barcode intake, reorder monitoring, and lifecycle visibility.
                  Because eventually somebody uploads 400 duplicate walkers and
                  calls it “an import issue.”
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm p-4 sm:p-5`}>
              <div className="flex items-center gap-4">
                <div className={glass.iconBox}>
                  <PackageSearch className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className={typography.cardTitle}>
                      Product System
                    </p>

                    <span className={glass.chip}>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />

                      Online
                    </span>
                  </div>

                  <p className={`mt-1 ${typography.smallMuted}`}>
                    HCPCS + vendor intelligence active
                  </p>
                </div>
              </div>

              <div className={`mt-4 flex items-center gap-2 ${glass.insetPadded} ${typography.small}`}>
                <ScanLine className="h-3.5 w-3.5 text-[var(--color-accent)]" />

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
          onAction={handleStatsAction}
        />

        <ProductRecallWatch
          products={products}
          canRead={canRead}
          canWrite={canWrite}
          open={recallFindingsOpen}
          onOpenChange={setRecallFindingsOpen}
          onRefreshProducts={() => {
            void loadProducts("reset");
          }}
          onShowRecallProducts={() => handleStatsAction("recall")}
          onShowDiscontinuedProducts={() => handleStatsAction("discontinued")}
        />

        {stats.highRisk >
        0 ? (
          <section className={alerts.warning}>
            <div className="flex items-stretch gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <h2 className="font-semibold">
                  Catalog cleanup required
                </h2>

                <p className={`mt-1 ${typography.bodyMuted}`}>
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
            className={`${glass.panel} relative overflow-visible`}
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

                  <p className={`mt-2 ${typography.bodyMuted}`}>
                    {filteredProducts.length.toLocaleString()} visible
                    from{" "}
                    {products.length.toLocaleString()} loaded
                    records
                  </p>
                </div>

                <div className="relative">
                  <Search className={`pointer-events-none absolute left-3 top-3.5 h-4 w-4 ${typography.smallMuted}`} />

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
                    className={`${glass.input} py-3 pl-10 pr-10 xl:w-[420px]`}
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
                      className={`absolute right-3 top-3.5 transition ${typography.smallMuted} hover:text-white`}
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







