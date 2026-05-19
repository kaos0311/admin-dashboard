export type OrderStatus =
  | "processing"
  | "ready"
  | "delivered"
  | "cancelled"
  | "archived";

export type FilterTab = OrderStatus | "all";

export type ImportReportType =
  | "deliveryTickets"
  | "outstandingSalesOrders"
  | "billingReview"
  | "genericOrders";

export type ImportJobStatus =
  | "uploaded"
  | "processing"
  | "complete"
  | "empty"
  | "failed";

export type SmartReviewReason =
  | "missingPatientName"
  | "missingAddress"
  | "missingProduct"
  | "missingProductId"
  | "missingDob"
  | "missingPhone"
  | "possibleHospice"
  | "inventoryNotAllocated"
  | "cancelledInventoryRestored"
  | "archived"
  | "deliveredReadyForArchive"
  | "duplicateRisk";

export type SmartRouteTarget =
  | "orders"
  | "patients"
  | "hospicePatients"
  | "rentals"
  | "insurancePatients"
  | "analytics"
  | "review";

export type OrderRow = {
  id: string;
  patientName: string;
  patientAddress: string;
  productId: string;
  productType: string;
  purchaseCost: number;
  quantity: number;
  barcode: string;
  phone: string;
  facilityName: string;
  status: OrderStatus;
  notes: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  sourceImportId?: string;
  sourceReportType?: string;
  salesOrderNumber?: string;
  customerId?: string;
  dob?: string;
  insurance?: string;
  isHospice?: boolean;
  inventoryAllocated?: boolean;
  inventoryAllocationSourceId?: string;
  inventoryRestored?: boolean;
  searchText?: string;
  patientKey?: string;
  orderKey?: string;
  normalizedName?: string;
  normalizedDob?: string;
  normalizedPhone?: string;
  normalizedAddress?: string;
  needsReview?: boolean;
  reviewReasons?: SmartReviewReason[];
  smartRouteTargets?: SmartRouteTarget[];
  linkedPatientId?: string;
  linkedInventoryId?: string;
};

export type ImportJob = {
  id: string;
  reportType: string;
  detectedReportType: string;
  detectionConfidence: number;
  fileName: string;
  fileSize: number;
  status: ImportJobStatus;
  rowCount: number;
  skippedHospiceRows: number;
  duplicateRows: number;
  missingDobRows: number;
  missingAddressRows: number;
  missingProductRows: number;
  needsReviewRows: number;
  errorMessage: string;
  storagePath: string;
  duplicateKey: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
};

export type OrderFormState = {
  patientName: string;
  patientAddress: string;
  productId: string;
  productType: string;
  purchaseCost: string;
  quantity: string;
  barcode: string;
  phone: string;
  facilityName: string;
  status: OrderStatus;
  notes: string;
};

export type SmartDetectionResult = {
  reportType: ImportReportType;
  confidence: number;
  reasons: string[];
};

export type SmartFilters = {
  sourceReportType: string;
  facilityName: string;
  insurance: string;
  reviewOnly: boolean;
  inventoryOnly: boolean;
  hospiceRiskOnly: boolean;
  missingProductOnly: boolean;
  archiveReadyOnly: boolean;
};