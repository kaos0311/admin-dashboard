export type InventoryStatus =
  | "available"
  | "inactive"
  | "damaged"
  | "lost"
  | "discontinued";

export type LifecycleStatus =
  | "new"
  | "active"
  | "needs_service"
  | "end_of_life"
  | "retired";

export type ScanTarget = "barcode" | "serial" | "lotNumber" | null;

export type SortKey =
  | "name"
  | "category"
  | "available"
  | "quantityOnHand"
  | "totalValue"
  | "status"
  | "lifecycleStatus"
  | "nextServiceDate";

export type SortDirection = "asc" | "desc";

export type InventoryItem = {
  id: string;
  productId: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  locationName: string;
  binLocation: string;
  quantityOnHand: number;
  committed: number;
  onRent: number;
  onOrder: number;
  available: number;
  reorderLevel: number;
  unitCost: number;
  totalValue: number;
  status: InventoryStatus;
  manufacturer: string;
  manufacturerItemId: string;
  modelNumber: string;
  warrantyProvider: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyNotes: string;
  purchaseDate: string;
  usefulLifeMonths: number;
  lifecycleStatus: LifecycleStatus;
  nextServiceDate: string;
  lifecycleNotes: string;
  notes: string;
  searchText: string;
  isDeleted: boolean;
};

export type InventoryForm = {
  id: string;
  productId: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  locationName: string;
  binLocation: string;
  quantityOnHand: string;
  committed: string;
  onRent: string;
  onOrder: string;
  reorderLevel: string;
  unitCost: string;
  status: InventoryStatus;
  manufacturer: string;
  manufacturerItemId: string;
  modelNumber: string;
  warrantyProvider: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyNotes: string;
  purchaseDate: string;
  usefulLifeMonths: string;
  lifecycleStatus: LifecycleStatus;
  nextServiceDate: string;
  lifecycleNotes: string;
  notes: string;
};

export type AlertFilter =
  | "all"
  | "lowStock"
  | "serviceDue"
  | "warrantyExpired";

export type MovementPayload = {
  productId: string;
  productName: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  type: string;
  quantity: number;
  sourceId: string;
  notes: string;
  affectedIds?: string[];
};