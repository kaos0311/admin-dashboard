"use client";

import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";

import type { DeliveryTicket } from "../lib/deliveryFulfillment";

function readNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTicket(id: string, data: Record<string, unknown>): DeliveryTicket {
  const items = Array.isArray(data.items)
    ? (data.items as DeliveryTicket["items"])
    : [];

  return {
    id,
    ticketKey: String(data.ticketKey ?? id),
    patientKey: String(data.patientKey ?? ""),
    patientId: String(data.patientId ?? ""),
    patientName: String(data.patientName ?? ""),
    patientAddress: String(data.patientAddress ?? data.address ?? ""),
    storagePath: String(data.storagePath ?? ""),
    fileName: String(data.fileName ?? ""),
    deliveryTicketNumber: String(data.deliveryTicketNumber ?? ""),
    salesOrderNumber: String(data.salesOrderNumber ?? data.orderNumber ?? ""),
    actualDeliveryDate: String(data.actualDeliveryDate ?? ""),
    scheduledDeliveryDate: String(data.scheduledDeliveryDate ?? ""),
    deliveryTechName: String(data.deliveryTechName ?? ""),
    importedBy: String(data.importedBy ?? ""),
    receivedBy: String(data.receivedBy ?? ""),
    assignedTech: String(data.assignedTech ?? data.deliveryTechName ?? ""),
    deliveryType: String(data.deliveryType ?? data.productType ?? ""),
    destinationType: String(data.destinationType ?? data.placeType ?? ""),
    facilityName: String(data.facilityName ?? data.facility ?? ""),
    routeSequence: readNumber(data.routeSequence),
    routeStatus: String(data.routeStatus ?? ""),
    etaMinutes: readNumber(data.etaMinutes),
    estimatedArrival: String(data.estimatedArrival ?? ""),
    routeNotes: String(data.routeNotes ?? ""),
    lastTechLatitude: readNumber(data.lastTechLatitude),
    lastTechLongitude: readNumber(data.lastTechLongitude),
    lastTechAccuracy: readNumber(data.lastTechAccuracy),
    lastTechLocationAtLabel: String(data.lastTechLocationAtLabel ?? ""),
    insuranceName: String(data.insuranceName ?? data.insurance ?? ""),
    policyNumber: String(data.policyNumber ?? ""),
    parStatus: String(data.parStatus ?? ""),
    parNumber: String(data.parNumber ?? ""),
    cmnStatus: String(data.cmnStatus ?? ""),
    signatureStatus: String(data.signatureStatus ?? ""),
    signedByName: String(data.signedByName ?? ""),
    signedByRole: String(data.signedByRole ?? ""),
    signerRelationship: String(data.signerRelationship ?? ""),
    witnessName: String(data.witnessName ?? ""),
    refusalReason: String(data.refusalReason ?? ""),
    items,
    itemCount: readNumber(data.itemCount),
    requiredScanCount: readNumber(data.requiredScanCount),
    loadedScanCount: readNumber(data.loadedScanCount),
    deliveredScanCount: readNumber(data.deliveredScanCount),
    returnedScanCount: readNumber(data.returnedScanCount),
    fulfillmentStatus: String(data.fulfillmentStatus ?? "needs_load"),
  };
}

export function useDeliveryTickets() {
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ticketsQuery = query(
      collection(db, "patientDeliveryTickets"),
      orderBy("updatedAt", "desc"),
      limit(60)
    );

    return onSnapshot(
      ticketsQuery,
      (snapshot) => {
        setTickets(
          snapshot.docs.map((docSnap) =>
            normalizeTicket(docSnap.id, docSnap.data())
          )
        );
        setLoading(false);
      },
      (error) => {
        console.error("DELIVERY TICKETS SNAPSHOT ERROR:", error);
        toast.error("Unable to load delivery tickets.");
        setTickets([]);
        setLoading(false);
      }
    );
  }, []);

  return {
    tickets,
    loading,
  };
}
