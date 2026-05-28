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
  serialNumber: string;
  assetTag: string;
  patientName: string;
  patientId: string;
  location: string;
  status: RentalStatus;
  condition: RentalCondition;
  checkedOutDate: string;
  expectedReturnDate: string;
  returnedDate: string;
  monthlyRate: number;
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
};

export type RentalFilters = {
  search: string;
  status: "all" | RentalStatus;
};
