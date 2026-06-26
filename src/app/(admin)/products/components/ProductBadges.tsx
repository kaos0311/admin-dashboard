"use client";


import { badges, typography } from "@/theme";
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
    return <span className={typography.smallMuted}>Clean</span>;
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
                ? `rounded-full px-2 py-1 text-xs ${badges.warning}`
                : `rounded-full px-2 py-1 text-xs ${badges.neutral}`
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
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badges.danger}`}>
        High {score}
      </span>
    );
  }

  if (score >= 20) {
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badges.warning}`}>
        Medium {score}
      </span>
    );
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badges.success}`}>
      Low {score}
    </span>
  );
}

export function ProductRiskBadge({ product }: { product: Product }) {
  return <RiskBadge score={productRiskScore(product)} />;
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  const styles: Record<ProductStatus, string> = {
    active: badges.success,
    inactive: badges.neutral,
    discontinued: badges.danger,
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

