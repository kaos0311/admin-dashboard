import type { Product, ProductFiltersState } from "./productTypes";
import { normalizeSearchText } from "./productNormalize";
import { productRiskScore, qualityWarnings } from "./productValidation";

export function uniqueOptions(products: Product[], key: keyof Product): string[] {
  return Array.from(
    new Set(
      products
        .map((product) => product[key])
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0
        )
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function vendorOptions(products: Product[]): string[] {
  return Array.from(
    new Set(
      products
        .flatMap((product) => [product.primaryVendor, product.secondaryVendor])
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function filterAndSortProducts(
  products: Product[],
  filters: ProductFiltersState
): Product[] {
  const term = normalizeSearchText(filters.search);

  const filtered = products.filter((product) => {
    const warnings = qualityWarnings(product);

    const haystack = normalizeSearchText(
      [
        product.name,
        product.brand,
        product.model,
        product.category,
        product.productType,
        product.manufacturer,
        product.manufacturerItemId,
        product.primaryVendor,
        product.secondaryVendor,
        product.sku,
        product.upc,
        product.hcpcs,
        product.ndc,
        product.status,
        product.notes,
      ].join(" ")
    );

    const matchesSearch = !term || haystack.includes(term);

    const matchesStatus =
      filters.statusFilter === "all" || product.status === filters.statusFilter;

    const matchesType =
      filters.typeFilter === "all" || product.productType === filters.typeFilter;

    const matchesCategory =
      filters.categoryFilter === "all" ||
      product.category === filters.categoryFilter;

    const matchesManufacturer =
      filters.manufacturerFilter === "all" ||
      product.manufacturer === filters.manufacturerFilter;

    const matchesVendor =
      filters.vendorFilter === "all" ||
      product.primaryVendor === filters.vendorFilter ||
      product.secondaryVendor === filters.vendorFilter;

    const matchesIssue =
      filters.issueFilter === "all" ||
      (filters.issueFilter === "recall" && product.recallFlagged) ||
      (filters.issueFilter === "missing-info" && warnings.length > 0) ||
      (filters.issueFilter === "serialized" && product.isSerialized) ||
      (filters.issueFilter === "rental" && product.isRentalItem) ||
      (filters.issueFilter === "rx" && product.requiresPrescription);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesCategory &&
      matchesManufacturer &&
      matchesVendor &&
      matchesIssue
    );
  });

  return filtered.sort((a, b) => {
    if (filters.sortMode === "name-desc") return b.name.localeCompare(a.name);
    if (filters.sortMode === "price-desc") return b.basePrice - a.basePrice;
    if (filters.sortMode === "price-asc") return a.basePrice - b.basePrice;

    if (filters.sortMode === "missing-info") {
      return qualityWarnings(b).length - qualityWarnings(a).length;
    }

    if (filters.sortMode === "risk-desc") {
      return productRiskScore(b) - productRiskScore(a);
    }

    return a.name.localeCompare(b.name);
  });
}

export function productStats(products: Product[]) {
  const missingInfo = products.filter(
    (product) => qualityWarnings(product).length > 0
  );

  const highRisk = products.filter((product) => productRiskScore(product) >= 50);

  return {
    total: products.length,
    active: products.filter((p) => p.status === "active").length,
    inactive: products.filter((p) => p.status === "inactive").length,
    discontinued: products.filter((p) => p.status === "discontinued").length,
    rental: products.filter((p) => p.isRentalItem).length,
    serialized: products.filter((p) => p.isSerialized).length,
    recall: products.filter((p) => p.recallFlagged).length,
    missingInfo: missingInfo.length,
    highRisk: highRisk.length,
  };
}