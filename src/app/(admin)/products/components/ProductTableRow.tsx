"use client";

import { buttons, glass, tables, typography } from "@/theme";
import { Pencil, Trash2 } from "lucide-react";

import type { Product } from "../utils/productTypes";
import { ProductFlags, ProductRiskBadge, StatusBadge } from "./ProductBadges";
import { ProductThumb } from "./ProductThumb";

type ProductTableRowProps = {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export function ProductTableRow({
  product,
  selected,
  onSelect,
  onEdit,
  onArchive,
}: ProductTableRowProps) {
  const productName = product.name || "Unnamed product";

  const productMeta =
    [product.brand, product.model, product.category].filter(Boolean).join(" â€¢ ") ||
    "No category";

  const formattedPrice =
    typeof product.basePrice === "number" && Number.isFinite(product.basePrice)
      ? `$${product.basePrice.toFixed(2)}`
      : "-";

  return (
    <tr className={`align-top ${tables.row}`}>
      <td className="w-[90px] px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${productName}`}
          className="h-4 w-4 accent-sky-400"
        />
      </td>

      <td className="w-[340px] px-4 py-3">
        <div className="flex min-w-0 gap-3">
          <div className="shrink-0">
            <ProductThumb product={product} />
          </div>

          <div className="min-w-0">
            <div className={`line-clamp-2 break-words ${typography.bodyStrong}`}>
              {productName}
            </div>

            <div className={`mt-1 line-clamp-2 break-words text-xs leading-5 ${typography.caption}`}>
              {productMeta}
            </div>
          </div>
        </div>
      </td>

      <TableTextCell value={product.sku} />
      <TableTextCell value={product.upc} />
      <TableTextCell value={product.hcpcs} />
      <TableTextCell value={product.manufacturer} />
      <TableTextCell value={formattedPrice} />

      <td className="w-[280px] px-4 py-3">
        <div className="min-w-0">
          <ProductFlags product={product} />
        </div>
      </td>

      <td className="w-[140px] px-4 py-3">
        <ProductRiskBadge product={product} />
      </td>

      <td className="w-[140px] px-4 py-3">
        <StatusBadge status={product.status} />
      </td>

      <td className={`sticky right-0 z-10 w-[130px] px-4 py-3 ${glass.toolbar}`}>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className={buttons.icon}
            title="Edit product"
            aria-label={`Edit ${productName}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onArchive}
            className={buttons.iconDanger}
            title="Archive product"
            aria-label={`Archive ${productName}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TableTextCell({
  value,
}: {
  value?: string | number | null;
}) {
  const displayValue =
    value === undefined || value === null || String(value).trim() === ""
      ? "-"
      : String(value);

  return (
    <td className={tables.cell}>
      <div className="min-w-0 break-words leading-5">{displayValue}</div>
    </td>
  );
}



