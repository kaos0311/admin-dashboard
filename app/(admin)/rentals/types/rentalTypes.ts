export type RentalStatus =
  | "Active"
  | "Returned"
  | "Cancelled"
  | "Past Due"
  | "Deleted";

export type DeliveryStatus =
  | "Not Scheduled"
  | "Scheduled"
  | "Delivered"
  | "Pickup Scheduled"
  | "Picked Up"
  | "Cleaning"
  | "Ready";

export type BillingCycle = "Monthly" | "Weekly" | "Daily";

export type ProductOption = {
  id: string;
  name: string;
  category: string;
  sku: string;
  upc: string;
  basePrice: number;
  isRentalItem: boolean;
  status: "active" | "inactive";
};

export type Rental = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  sku: string;
  serialNumber: string;
  lotNumber: string;
  customerName: string;
  patientName: string;
  patientId: string;
  payerName: string;
  insuranceType: string;
  authorizationNumber: string;
  rentalStartDate: string;
  rentalEndDate: string;
  monthsUsed: number;
  monthlyRate: number;
  totalCharges: number;
  billingCycle: BillingCycle;
  status: RentalStatus;
  deliveryStatus: DeliveryStatus;
  deliveryDate: string;
  pickupDate: string;
  location: string;
  assignedTo: string;
  notes: string;
};

export type RentalForm = Omit<
  Rental,
  "monthsUsed" | "monthlyRate" | "totalCharges"
> & {
  monthlyRate: string;
};