import type { Product, ProductForm } from "./productTypes";
import { toSafeNumber } from "./productNormalize";

export function productRiskScore(product: Product): number {
  let score = 0;

  if (!product.name) score += 25;
  if (!product.category) score += 20;
  if (!product.hcpcs) score += 15;
  if (!product.sku && !product.upc && !product.manufacturerItemId) score += 15;
  if (product.recallFlagged) score += 30;
  if (product.requiresSerialTracking && !product.isSerialized) score += 20;
  if (product.productType === "rental" && product.defaultRentalRate <= 0) {
    score += 10;
  }
  if (product.basePrice <= 0 && product.productType !== "service") score += 10;

  return Math.min(score, 100);
}

export function qualityWarnings(product: Product): string[] {
  const warnings: string[] = [];

  if (!product.category) warnings.push("Missing category");
  if (!product.hcpcs) warnings.push("Missing HCPCS");

  if (!product.sku && !product.upc && !product.manufacturerItemId) {
    warnings.push("Missing item identifier");
  }

  if (product.recallFlagged) warnings.push("Recall flagged");

  if (product.requiresSerialTracking && !product.isSerialized) {
    warnings.push("Serial tracking mismatch");
  }

  if (product.productType === "rental" && product.defaultRentalRate <= 0) {
    warnings.push("Missing rental rate");
  }

  return warnings;
}

export function productFormWarnings(form: ProductForm): string[] {
  const warnings: string[] = [];

  if (!form.name.trim()) warnings.push("Product name is required.");
  if (!form.category.trim()) warnings.push("Category is required.");
  if (!form.hcpcs.trim()) warnings.push("HCPCS is missing.");

  if (!form.sku.trim() && !form.upc.trim() && !form.manufacturerItemId.trim()) {
    warnings.push("At least one item identifier is recommended.");
  }

  if (form.productType === "rental" && toSafeNumber(form.defaultRentalRate) <= 0) {
    warnings.push("Rental items should have a default rental rate.");
  }

  if (form.requiresSerialTracking && !form.isSerialized) {
    warnings.push("Serial tracking requires Serialized item enabled.");
  }

  return warnings;
}