"use client";

import { buttons, colors, glass, typography } from "@/theme";
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
    [product.brand, product.model, product.category].filter(Boolean).join(" • ") ||
    "No category";

  const formattedPrice =
    typeof product.basePrice === "number" && Number.isFinite(product.basePrice)
      ? `$${product.basePrice.toFixed(2)}`
      : "-";

  return (
    <article className={`${glass.cardPadded} min-w-0`}>
      <div className="flex min-w-0 gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${productName}`}
          className="mt-1 h-4 w-4 shrink-0"
        />

        <div className="shrink-0">
          <ProductThumb product={product} />
        </div>

        <div className="min-w-0 flex-1">
          <div className={`min-w-0 break-words ${typography.bodyStrong}`}>
            {productName}
          </div>

          <div className={`mt-1 min-w-0 break-words ${typography.caption}`}>
            {productMeta}
          </div>

          <div className="mt-3 grid min-w-0 gap-2 text-xs">
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
              className={buttons.icon}
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Edit</span>
            </button>

            <button
              type="button"
              onClick={onArchive}
              aria-label={`Archive ${productName}`}
              className={buttons.iconDanger}
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
      <span className={`shrink-0 ${typography.caption}`}>{label}</span>
      <span className={`min-w-0 break-words text-right ${colors.textSecondary}`}>
        {displayValue}
      </span>
    </div>
  );
}
