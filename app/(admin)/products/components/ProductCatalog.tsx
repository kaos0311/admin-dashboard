"use client";

import {
  ChevronDown,
  Loader2,
} from "lucide-react";

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
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-slate-300 backdrop-blur-xl">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading products...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center text-sm text-slate-400 backdrop-blur-xl">
        No products found.
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-h-[72vh] overflow-auto rounded-3xl border border-white/10 bg-black/20 shadow-2xl shadow-black/30 xl:block">
        <table className="w-full min-w-[1550px] text-left text-sm">
          <thead className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 text-slate-300 shadow-lg shadow-black/40 backdrop-blur-xl">
            <tr>
              <th className="w-[80px] px-4 py-3">Select</th>
              <th className="min-w-[320px] px-4 py-3">Product</th>
              <th className="min-w-[140px] px-4 py-3">SKU</th>
              <th className="min-w-[150px] px-4 py-3">UPC</th>
              <th className="min-w-[120px] px-4 py-3">HCPCS</th>
              <th className="min-w-[180px] px-4 py-3">Manufacturer</th>
              <th className="min-w-[110px] px-4 py-3">Price</th>
              <th className="min-w-[260px] px-4 py-3">Flags</th>
              <th className="min-w-[130px] px-4 py-3">Risk</th>
              <th className="min-w-[130px] px-4 py-3">Status</th>

              <th className="sticky right-0 min-w-[120px] bg-slate-950/95 px-4 py-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.45)]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
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

      <div className="space-y-3 xl:hidden">
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

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onLoadMore}
          disabled={!hasMore || loadingMore}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingMore ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}

          {hasMore ? "Load More" : "All Loaded"}
        </button>
      </div>
    </>
  );
}