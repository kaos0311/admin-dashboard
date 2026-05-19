"use client";

import { Pencil, Trash2 } from "lucide-react";

import type { Product } from "../utils/productTypes";
import { ProductFlags, ProductRiskBadge, StatusBadge } from "./ProductBadges";
import { ProductThumb } from "./ProductThumb";

export function ProductTableRow({
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
    <tr className="border-t border-white/10 align-top transition hover:bg-white/[0.04]">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${product.name || "product"}`}
          className="h-4 w-4 accent-sky-400"
        />
      </td>

      <td className="px-4 py-3">
        <div className="flex gap-3">
          <ProductThumb product={product} />

          <div className="min-w-0">
            <div className="font-semibold text-white">
              {product.name || "Unnamed product"}
            </div>

            <div className="text-xs text-slate-500">
              {[product.brand, product.model, product.category]
                .filter(Boolean)
                .join(" • ") || "No category"}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3 text-slate-300">{product.sku || "-"}</td>
      <td className="px-4 py-3 text-slate-300">{product.upc || "-"}</td>
      <td className="px-4 py-3 text-slate-300">{product.hcpcs || "-"}</td>
      <td className="px-4 py-3 text-slate-300">
        {product.manufacturer || "-"}
      </td>
      <td className="px-4 py-3 text-slate-300">
        ${product.basePrice.toFixed(2)}
      </td>

      <td className="px-4 py-3">
        <ProductFlags product={product} />
      </td>

      <td className="px-4 py-3">
        <ProductRiskBadge product={product} />
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={product.status} />
      </td>

      <td className="sticky right-0 bg-slate-950/95 px-4 py-3 shadow-[-12px_0_18px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-white/10 bg-white/[0.08] p-2 text-slate-200 transition hover:bg-white/[0.14]"
            title="Edit product"
            aria-label={`Edit ${product.name || "product"}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onArchive}
            className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-200 transition hover:bg-red-400/20"
            title="Archive product"
            aria-label={`Archive ${product.name || "product"}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}