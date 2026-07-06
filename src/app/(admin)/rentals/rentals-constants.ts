import type {
  RentalCondition,
  RentalFilters,
  RentalFormState,
  RentalStatus,
} from "./rentals-types";

export const RENTALS_COLLECTION = "rentals";
export const PRODUCTS_COLLECTION = "products";

export const DEFAULT_RENTAL_FORM: RentalFormState = {
  productId: "",
  productName: "",
  itemId: "",
  itemGroup: "",
  procCode: "",
  modifiers: "",
  serialNumber: "",
  assetNumber: "",
  assetTag: "",
  patientName: "",
  patientId: "",
  patientDob: "",
  phone: "",
  location: "",
  status: "available",
  condition: "good",
  checkedOutDate: "",
  expectedReturnDate: "",
  returnedDate: "",
  nextBillingDate: "",
  nextBillingPeriod: "",
  monthlyRate: 0,
  quantity: 1,
  charge: 0,
  allow: 0,
  extCharge: 0,
  extAllow: 0,
  parNumber: "",
  parExpiration: "",
  planType: "",
  itemDiagnosis: "",
  insuranceName: "",
  payor: "",
  orderingDoctor: "",
  primaryDoctor: "",
  orderDocNpi: "",
  primaryDocNpi: "",
  salesOrderId: "",
  salesOrderDetailId: "",
  hospice: false,
  sourceReport: "",
  notes: "",
};

export const DEFAULT_RENTAL_FILTERS: RentalFilters = {
  search: "",
  status: "all",
};

export const RENTAL_STATUSES: Array<{
  label: string;
  value: RentalStatus;
}> = [
  { label: "Available", value: "available" },
  { label: "Checked Out", value: "checked_out" },
  { label: "Overdue", value: "overdue" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Retired", value: "retired" },
];

export const RENTAL_CONDITIONS: Array<{
  label: string;
  value: RentalCondition;
}> = [
  { label: "New", value: "new" },
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
  { label: "Damaged", value: "damaged" },
];


