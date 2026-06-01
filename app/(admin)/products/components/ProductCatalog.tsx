"use client";

import { ChevronDown, Loader2 } from "lucide-react";

import type { Product } from "../utils/productTypes";

import { ProductMobileCard } from "./ProductMobileCard";
import { ProductTableRow } from "./ProductTableRow";

type ProductCatalogProps = {
  products: Product[];
  selectedIds: string[];

  loadingProducts: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  authLoading: boolean;

  onSelect: (id: string) => void;
  onEdit: (product: Product) => void;
  onArchive: (product: Product) => void;

  onLoadMore: () => void;
};

export function ProductCatalog({
  products,
  selectedIds,
  loadingProducts,
  loadingMore,
  hasMore,
  authLoading,
  onSelect,
  onEdit,
  onArchive,
  onLoadMore,
}: ProductCatalogProps) {
  if (loadingProducts || authLoading) {
    return (
      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-slate-300 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span className="truncate text-sm">Loading products...</span>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center text-sm text-slate-400 shadow-xl shadow-black/20 backdrop-blur-xl">
        No products found.
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-5">
      <div className="hidden min-w-0 rounded-3xl border border-white/10 bg-black/20 shadow-2xl shadow-black/30 xl:block">
        <div className="max-h-[72vh] min-w-0 overflow-x-auto overflow-y-auto rounded-3xl">
          <table className="w-full min-w-[1580px] table-fixed border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20 bg-slate-950/95 text-slate-300 shadow-lg shadow-black/40 backdrop-blur-xl">
              <tr className="border-b border-white/10">
                <th className="w-[90px] px-4 py-3 font-semibold">Select</th>
                <th className="w-[340px] px-4 py-3 font-semibold">Product</th>
                <th className="w-[150px] px-4 py-3 font-semibold">SKU</th>
                <th className="w-[160px] px-4 py-3 font-semibold">UPC</th>
                <th className="w-[130px] px-4 py-3 font-semibold">HCPCS</th>
                <th className="w-[200px] px-4 py-3 font-semibold">
                  Manufacturer
                </th>
                <th className="w-[120px] px-4 py-3 font-semibold">Price</th>
                <th className="w-[280px] px-4 py-3 font-semibold">Flags</th>
                <th className="w-[140px] px-4 py-3 font-semibold">Risk</th>
                <th className="w-[140px] px-4 py-3 font-semibold">Status</th>

                <th className="sticky right-0 z-30 w-[130px] bg-slate-950/95 px-4 py-3 text-right font-semibold shadow-[-14px_0_20px_rgba(0,0,0,0.45)]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {products.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  selected={selectedIds.includes(product.id)}
                  onSelect={() => onSelect(product.id)}
                  onEdit={() => onEdit(product)}
                  onArchive={() => onArchive(product)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="min-w-0 space-y-3 xl:hidden">
        {products.map((product) => (
          <ProductMobileCard
            key={product.id}
            product={product}
            selected={selectedIds.includes(product.id)}
            onSelect={() => onSelect(product.id)}
            onEdit={() => onEdit(product)}
            onArchive={() => onArchive(product)}
          />
        ))}
      </div>

      <div className="flex min-w-0 justify-center">
        <button
          type="button"
          onClick={onLoadMore}
          disabled={!hasMore || loadingMore}
          aria-label={hasMore ? "Load more products" : "All products loaded"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingMore ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}

          <span>{hasMore ? "Load More" : "All Loaded"}</span>
        </button>
      </div>
    </section>
  );
}


