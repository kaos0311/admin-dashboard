import type { RentalForm } from "../types/rentalTypes";

export const RENTALS_LIMIT = 500;
export const PRODUCTS_LIMIT = 750;

export const initialRentalForm: RentalForm = {
  id: "",
  productId: "",
  productName: "",
  category: "",
  sku: "",
  serialNumber: "",
  lotNumber: "",
  customerName: "",
  patientName: "",
  patientId: "",
  payerName: "",
  insuranceType: "",
  authorizationNumber: "",
  rentalStartDate: "",
  rentalEndDate: "",
  monthlyRate: "",
  billingCycle: "Monthly",
  status: "Active",
  deliveryStatus: "Not Scheduled",
  deliveryDate: "",
  pickupDate: "",
  location: "",
  assignedTo: "",
  notes: "",
};