import type { OrderFormState, SmartFilters } from "./orderTypes";

export const ORDERS_PAGE_SIZE = 75;

export const IMPORT_SAMPLE_BYTES = 48_000;

export const initialFormState: OrderFormState = {
  patientName: "",
  patientAddress: "",
  productId: "",
  productType: "",
  purchaseCost: "",
  quantity: "1",
  barcode: "",
  phone: "",
  facilityName: "",
  status: "processing",
  notes: "",
};

export const initialSmartFilters: SmartFilters = {
  sourceReportType: "",
  facilityName: "",
  insurance: "",
  reviewOnly: false,
  inventoryOnly: false,
  hospiceRiskOnly: false,
  missingProductOnly: false,
  archiveReadyOnly: false,
};