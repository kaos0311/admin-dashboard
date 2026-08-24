"use client";

import type { Timestamp } from "firebase/firestore";

export type DeliveryScanMode = "load" | "deliver" | "return";

export type DeliveryTicketItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  qty?: number;
  quantity?: number;
  serialNumber?: string;
  lotNumber?: string;
  status?: string;
};

export type DeliveryTicket = {
  id: string;
  ticketKey?: string;
  patientKey?: string;
  patientId?: string;
  patientName?: string;
  patientAddress?: string;
  storagePath?: string;
  fileName?: string;
  deliveryTicketNumber?: string;
  salesOrderNumber?: string;
  actualDeliveryDate?: string;
  scheduledDeliveryDate?: string;
  deliveryTechName?: string;
  importedBy?: string;
  receivedBy?: string;
  assignedTech?: string;
  deliveryType?: string;
  destinationType?: string;
  facilityName?: string;
  routeSequence?: number;
  routeStatus?: string;
  etaMinutes?: number;
  estimatedArrival?: string;
  routeNotes?: string;
  lastTechLatitude?: number;
  lastTechLongitude?: number;
  lastTechAccuracy?: number;
  lastTechLocationAtLabel?: string;
  insuranceName?: string;
  policyNumber?: string;
  parStatus?: string;
  parNumber?: string;
  cmnStatus?: string;
  signatureStatus?: string;
  signedByName?: string;
  signedByRole?: string;
  signedAtLabel?: string;
  signerRelationship?: string;
  witnessName?: string;
  refusalReason?: string;
  items?: DeliveryTicketItem[];
  itemCount?: number;
  requiredScanCount?: number;
  loadedScanCount?: number;
  deliveredScanCount?: number;
  returnedScanCount?: number;
  fulfillmentStatus?: string;
};

export type InventoryScanMatch = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  hcpc: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  quantityOnHand: number;
  available: number;
  onRent: number;
  onTruck: number;
  patientKey: string;
};

export type TechLocationCheckIn = {
  id: string;
  techName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  ticketId: string;
  deliveryTicketNumber: string;
  patientName: string;
  recordedByEmail: string;
  recordedAt: Timestamp | null;
};

export type ReturnConditionValue =
  | "returned_ready"
  | "needs_cleaning"
  | "needs_service"
  | "damaged"
  | "missing_parts"
  | "lost";

export type ActorField = "importedBy" | "receivedBy" | "assignedTech";

export type DeliveryException = {
  id: string;
  issue: string;
  ticket: DeliveryTicket;
};

export type TruckLoadSummary = {
  tech: string;
  loaded: number;
  required: number;
  tickets: number;
};

export type BossDeliveryRun = {
  tech: string;
  deliveries: DeliveryTicket[];
};
