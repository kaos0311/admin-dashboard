"use client";

import { Pencil, Trash2 } from "lucide-react";

import type { Product } from "../utils/productTypes";
import { ProductFlags, ProductRiskBadge, StatusBadge } from "./ProductBadges";
import { ProductThumb } from "./ProductThumb";

export function ProductMobileCard({
  product,
  selected,
  onSelect,
  onEdit,
  onArchive,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${product.name || "product"}`}
          className="mt-1 h-4 w-4 accent-sky-400"
        />

        <ProductThumb product={product} />

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">
            {product.name || "Unnamed product"}
          </div>

          <div className="text-xs text-slate-500">
            {[product.brand, product.model, product.category]
              .filter(Boolean)
              .join(" • ") || "No category"}
          </div>

          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <InfoLine label="SKU" value={product.sku} />
            <InfoLine label="UPC" value={product.upc} />
            <InfoLine label="HCPCS" value={product.hcpcs} />
            <InfoLine label="Manufacturer" value={product.manufacturer} />
            <InfoLine label="Price" value={`$${product.basePrice.toFixed(2)}`} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={product.status} />
            <ProductRiskBadge product={product} />
            <ProductFlags product={product} />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-sm text-slate-100 transition hover:bg-white/[0.14]"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>

            <button
              type="button"
              onClick={onArchive}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-400/20"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Archive
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right">{value || "-"}</span>
    </div>
  );
}