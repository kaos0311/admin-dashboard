"use client";

import { Pencil, Trash2 } from "lucide-react";

import type { Product } from "../utils/productTypes";
import { ProductFlags, ProductRiskBadge, StatusBadge } from "./ProductBadges";
import { ProductThumb } from "./ProductThumb";

type ProductMobileCardProps = {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export function ProductMobileCard({
  product,
  selected,
  onSelect,
  onEdit,
  onArchive,
}: ProductMobileCardProps) {
  const productName = product.name || "Unnamed product";

  const productMeta =
    [product.brand, product.model, product.category].filter(Boolean).join(" â€¢ ") ||
    "No category";

  const formattedPrice =
    typeof product.basePrice === "number" && Number.isFinite(product.basePrice)
      ? `$${product.basePrice.toFixed(2)}`
      : "-";

  return (
    <article className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex min-w-0 gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${productName}`}
          className="mt-1 h-4 w-4 shrink-0 accent-sky-400"
        />

        <div className="shrink-0">
          <ProductThumb product={product} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0 break-words text-sm font-semibold leading-5 text-white">
            {productName}
          </div>

          <div className="mt-1 min-w-0 break-words text-xs leading-5 text-slate-500">
            {productMeta}
          </div>

          <div className="mt-3 grid min-w-0 gap-2 text-xs text-slate-300">
            <InfoLine label="SKU" value={product.sku} />
            <InfoLine label="UPC" value={product.upc} />
            <InfoLine label="HCPCS" value={product.hcpcs} />
            <InfoLine label="Manufacturer" value={product.manufacturer} />
            <InfoLine label="Price" value={formattedPrice} />
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            <StatusBadge status={product.status} />
            <ProductRiskBadge product={product} />
            <ProductFlags product={product} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${productName}`}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-sky-300/30"
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Edit</span>
            </button>

            <button
              type="button"
              onClick={onArchive}
              aria-label={`Archive ${productName}`}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-300/30"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Archive</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const displayValue =
    value === undefined || value === null || String(value).trim() === ""
      ? "-"
      : String(value);

  return (
    <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-slate-300">
        {displayValue}
      </span>
    </div>
  );
}


