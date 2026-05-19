export type ProductStatus = "active" | "inactive" | "discontinued";

export type ProductType =
  | "resale"
  | "rental"
  | "consumable"
  | "serialized"
  | "service"
  | "oxygen"
  | "cpap"
  | "other";

export type SortMode =
  | "name-asc"
  | "name-desc"
  | "price-desc"
  | "price-asc"
  | "missing-info"
  | "risk-desc";

export type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  productType: ProductType;
  manufacturer: string;
  manufacturerItemId: string;
  primaryVendor: string;
  secondaryVendor: string;
  sku: string;
  upc: string;
  hcpcs: string;
  ndc: string;
  basePrice: number;
  defaultPurchasePrice: number;
  defaultRentalRate: number;
  unitOfMeasure: string;
  reorderLevel: number;
  warrantyMonths: number;
  weight: string;
  dimensions: string;
  imageUrl: string;
  thumbnailUrl: string;
  status: ProductStatus;
  isRentalItem: boolean;
  isSerialized: boolean;
  requiresPrescription: boolean;
  requiresSerialTracking: boolean;
  lotTracking: boolean;
  expirationTracking: boolean;
  recallFlagged: boolean;
  notes: string;
  deleted: boolean;
};

export type ProductForm = Omit<
  Product,
  | "basePrice"
  | "defaultPurchasePrice"
  | "defaultRentalRate"
  | "reorderLevel"
  | "warrantyMonths"
  | "deleted"
> & {
  basePrice: string;
  defaultPurchasePrice: string;
  defaultRentalRate: string;
  reorderLevel: string;
  warrantyMonths: string;
};

export type ProductFiltersState = {
  search: string;
  statusFilter: ProductStatus | "all";
  typeFilter: ProductType | "all";
  categoryFilter: string;
  manufacturerFilter: string;
  vendorFilter: string;
  issueFilter: string;
  sortMode: SortMode;
};

export const PAGE_SIZE = 100;
export const BATCH_SIZE = 400;

export const PRODUCT_TYPE_OPTIONS: [ProductType, string][] = [
  ["resale", "Resale"],
  ["rental", "Rental"],
  ["consumable", "Consumable"],
  ["serialized", "Serialized"],
  ["service", "Service"],
  ["oxygen", "Oxygen"],
  ["cpap", "CPAP"],
  ["other", "Other"],
];

export const PRODUCT_STATUS_OPTIONS: [ProductStatus, string][] = [
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["discontinued", "Discontinued"],
];

export const initialProductForm: ProductForm = {
  id: "",
  name: "",
  brand: "",
  model: "",
  category: "",
  productType: "resale",
  manufacturer: "",
  manufacturerItemId: "",
  primaryVendor: "",
  secondaryVendor: "",
  sku: "",
  upc: "",
  hcpcs: "",
  ndc: "",
  basePrice: "",
  defaultPurchasePrice: "",
  defaultRentalRate: "",
  unitOfMeasure: "each",
  reorderLevel: "",
  warrantyMonths: "",
  weight: "",
  dimensions: "",
  imageUrl: "",
  thumbnailUrl: "",
  status: "active",
  isRentalItem: false,
  isSerialized: false,
  requiresPrescription: false,
  requiresSerialTracking: false,
  lotTracking: false,
  expirationTracking: false,
  recallFlagged: false,
  notes: "",
};

export const initialProductFilters: ProductFiltersState = {
  search: "",
  statusFilter: "all",
  typeFilter: "all",
  categoryFilter: "all",
  manufacturerFilter: "all",
  vendorFilter: "all",
  issueFilter: "all",
  sortMode: "name-asc",
};