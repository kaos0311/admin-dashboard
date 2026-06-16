export type RentalStatus =
  | "available"
  | "checked_out"
  | "overdue"
  | "maintenance"
  | "retired";

export type RentalCondition =
  | "new"
  | "good"
  | "fair"
  | "poor"
  | "damaged";

export type RentalRecord = {
  id: string;
  productId: string;
  productName: string;
  itemId: string;
  itemGroup: string;
  procCode: string;
  modifiers: string;
  serialNumber: string;
  assetNumber: string;
  assetTag: string;
  patientName: string;
  patientId: string;
  patientDob: string;
  phone: string;
  location: string;
  status: RentalStatus;
  condition: RentalCondition;
  checkedOutDate: string;
  expectedReturnDate: string;
  returnedDate: string;
  nextBillingDate: string;
  nextBillingPeriod: string;
  monthlyRate: number;
  quantity: number;
  charge: number;
  allow: number;
  extCharge: number;
  extAllow: number;
  parNumber: string;
  parExpiration: string;
  planType: string;
  itemDiagnosis: string;
  insuranceName: string;
  payor: string;
  orderingDoctor: string;
  primaryDoctor: string;
  orderDocNpi: string;
  primaryDocNpi: string;
  salesOrderId: string;
  salesOrderDetailId: string;
  hospice: boolean;
  sourceReport: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RentalFormState = Omit<RentalRecord, "id">;

export type RentalProductOption = {
  id: string;
  name: string;
  sku: string;
  hcpcs: string;
  rentalEligible: boolean;
};

export type RentalStats = {
  total: number;
  checkedOut: number;
  available: number;
  overdue: number;
  maintenance: number;
  monthlyRevenue: number;
  uniquePatients: number;
  totalCharge: number;
  totalAllow: number;
  expiringPars: number;
};

export type RentalFilters = {
  search: string;
  status: "all" | RentalStatus;
};


