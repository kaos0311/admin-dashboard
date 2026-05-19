"use client";

import type { Product, ProductStatus } from "../utils/productTypes";
import { productRiskScore, qualityWarnings } from "../utils/productValidation";

export function ProductFlags({ product }: { product: Product }) {
  const warnings = qualityWarnings(product);

  const flags = [
    product.isRentalItem ? "Rental" : "",
    product.isSerialized ? "Serialized" : "",
    product.requiresPrescription ? "Rx" : "",
    product.lotTracking ? "Lot" : "",
    product.expirationTracking ? "Exp" : "",
    product.recallFlagged ? "Recall" : "",
    ...warnings,
  ].filter(Boolean);

  if (!flags.length) {
    return <span className="text-xs text-slate-500">Clean</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(new Set(flags)).map((flag) => {
        const warning =
          flag === "Recall" ||
          flag.includes("Missing") ||
          flag.includes("mismatch");

        return (
          <span
            key={flag}
            className={
              warning
                ? "rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs text-amber-200"
                : "rounded-full border border-white/10 bg-white/[0.08] px-2 py-1 text-xs text-slate-300"
            }
          >
            {flag}
          </span>
        );
      })}
    </div>
  );
}

export function RiskBadge({ score }: { score: number }) {
  if (score >= 50) {
    return (
      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-200">
        High {score}
      </span>
    );
  }

  if (score >= 20) {
    return (
      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
        Medium {score}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
      Low {score}
    </span>
  );
}

export function ProductRiskBadge({ product }: { product: Product }) {
  return <RiskBadge score={productRiskScore(product)} />;
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  const styles: Record<ProductStatus, string> = {
    active:
      "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    inactive:
      "border-slate-300/20 bg-slate-300/10 text-slate-200",
    discontinued:
      "border-red-400/20 bg-red-400/10 text-red-200",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}