import type { InventoryForm } from "./inventoryTypes";

export const INVENTORY_LIMIT = 750;
export const FIRESTORE_BATCH_LIMIT = 450;

export const initialInventoryForm: InventoryForm = {
  id: "",
  productId: "",
  name: "",
  category: "",
  sku: "",
  barcode: "",
  serial: "",
  lotNumber: "",
  locationName: "Main Location",
  binLocation: "",
  quantityOnHand: "0",
  committed: "0",
  onRent: "0",
  onOrder: "0",
  reorderLevel: "0",
  unitCost: "0",
  status: "available",
  manufacturer: "",
  manufacturerItemId: "",
  modelNumber: "",
  warrantyProvider: "",
  warrantyStartDate: "",
  warrantyEndDate: "",
  warrantyNotes: "",
  purchaseDate: "",
  usefulLifeMonths: "60",
  lifecycleStatus: "active",
  nextServiceDate: "",
  lifecycleNotes: "",
  notes: "",
};