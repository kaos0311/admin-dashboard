"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  type DocumentData,
  onSnapshot,
  type Timestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";

import type {
  ProductionAlert,
  ProductionReadinessStats,
} from "../types";

type SnapshotRows = {
  deliveryTickets: DocumentData[];
  inventory: DocumentData[];
  imports: DocumentData[];
  patients: DocumentData[];
  techLocations: DocumentData[];
};

type LoadState = Record<keyof SnapshotRows, boolean>;

const EMPTY_ROWS: SnapshotRows = {
  deliveryTickets: [],
  inventory: [],
  imports: [],
  patients: [],
  techLocations: [],
};

const EMPTY_LOAD_STATE: LoadState = {
  deliveryTickets: false,
  inventory: false,
  imports: false,
  patients: false,
  techLocations: false,
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as Timestamp).toDate().getTime();
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function isDeliveryActive(row: DocumentData) {
  const status = lower(row.fulfillmentStatus || row.status);
  return status !== "delivered" && status !== "returned" && status !== "completed";
}

function hasThreshold(row: DocumentData) {
  return Boolean(
    row.reorderPoint ||
      row.reorderThreshold ||
      row.minStock ||
      row.minimumStock ||
      row.parLevel
  );
}

function thresholdValue(row: DocumentData) {
  return (
    number(row.reorderPoint) ||
    number(row.reorderThreshold) ||
    number(row.minStock) ||
    number(row.minimumStock) ||
    number(row.parLevel)
  );
}

function inventoryAvailable(row: DocumentData) {
  return number(row.available ?? row.quantityOnHand ?? row.onHand);
}

function identityGap(row: DocumentData) {
  return !text(row.patientName || row.fullName) || !text(row.dob || row.dateOfBirth);
}

function chartGap(row: DocumentData) {
  const hasDelivery =
    Boolean(row.deliverySummary) ||
    number(row.deliveryDocumentCount) > 0 ||
    number(row.documentCount) > 0;
  const hasEquipment =
    Array.isArray(row.currentEquipment) && row.currentEquipment.length > 0;

  return !hasDelivery && !hasEquipment;
}

function alert(
  input: Omit<ProductionAlert, "id"> & { id: string }
): ProductionAlert {
  return input;
}

function buildProductionAlerts(
  stats: ProductionReadinessStats
): ProductionAlert[] {
  const alerts: ProductionAlert[] = [];

  if (stats.missingSignatures > 0) {
    alerts.push(
      alert({
        id: "delivery-missing-signatures",
        area: "delivery",
        severity: "critical",
        title: "Unsigned delivered tickets",
        detail: `${stats.missingSignatures} delivered ticket(s) still need signatures filed back to the patient chart.`,
        actionLabel: "Review deliveries",
        href: "/reports/delivery",
      })
    );
  }

  if (stats.unassignedDeliveries > 0) {
    alerts.push(
      alert({
        id: "delivery-unassigned",
        area: "delivery",
        severity: "high",
        title: "Unassigned delivery tickets",
        detail: `${stats.unassignedDeliveries} active ticket(s) need a tech assigned before they can be routed.`,
        actionLabel: "Assign tickets",
        href: "/reports/delivery",
      })
    );
  }

  if (stats.loadedNotDelivered > 0) {
    alerts.push(
      alert({
        id: "delivery-loaded-not-delivered",
        area: "delivery",
        severity: "high",
        title: "Loaded but not delivered",
        detail: `${stats.loadedNotDelivered} ticket(s) have stock on a truck and still need delivery completion.`,
        actionLabel: "Check truck loads",
        href: "/reports/delivery",
      })
    );
  }

  if (stats.staleTechCheckIns > 0) {
    alerts.push(
      alert({
        id: "tech-stale-checkins",
        area: "delivery",
        severity: "watch",
        title: "Tech check-ins need refresh",
        detail: `${stats.staleTechCheckIns} tech location check-in(s) are older than two hours.`,
        actionLabel: "Open boss board",
        href: "/reports/delivery",
      })
    );
  }

  if (stats.lowStockItems > 0) {
    alerts.push(
      alert({
        id: "inventory-low-stock",
        area: "inventory",
        severity: "high",
        title: "Low stock against thresholds",
        detail: `${stats.lowStockItems} inventory item(s) are at or below their reorder threshold.`,
        actionLabel: "Review inventory",
        href: "/inventory",
      })
    );
  }

  if (stats.inventoryTraceIssues > 0) {
    alerts.push(
      alert({
        id: "inventory-trace-issues",
        area: "inventory",
        severity: "watch",
        title: "Inventory trace gaps",
        detail: `${stats.inventoryTraceIssues} item(s) are missing barcode, serial, lot, or HCPCS trace details.`,
        actionLabel: "Fix inventory",
        href: "/inventory",
      })
    );
  }

  if (stats.failedImports > 0) {
    alerts.push(
      alert({
        id: "imports-failed",
        area: "imports",
        severity: "high",
        title: "Failed or blocked imports",
        detail: `${stats.failedImports} import job(s) need review before the database can be trusted.`,
        actionLabel: "Open imports",
        href: "/reports/upload",
      })
    );
  }

  if (stats.patientIdentityGaps > 0) {
    alerts.push(
      alert({
        id: "patients-identity-gaps",
        area: "patients",
        severity: "high",
        title: "Patient identity gaps",
        detail: `${stats.patientIdentityGaps} patient index record(s) are missing name or DOB matching fields.`,
        actionLabel: "Review patients",
        href: "/reports/patients",
      })
    );
  }

  if (stats.chartDocumentGaps > 0) {
    alerts.push(
      alert({
        id: "patients-chart-gaps",
        area: "documents",
        severity: "watch",
        title: "Chart document gaps",
        detail: `${stats.chartDocumentGaps} patient record(s) do not show delivery documents or current equipment in the index snapshot.`,
        actionLabel: "Review charts",
        href: "/reports/patients",
      })
    );
  }

  return alerts.slice(0, 9);
}

export function useProductionReadiness(isAdmin: boolean) {
  const [rows, setRows] = useState<SnapshotRows>(EMPTY_ROWS);
  const [loaded, setLoaded] = useState<LoadState>(EMPTY_LOAD_STATE);

  useEffect(() => {
    const subscriptions: Array<() => void> = [];
    const sources: Array<{
      key: keyof SnapshotRows;
      collectionName: string;
      adminOnly?: boolean;
    }> = [
      { key: "deliveryTickets", collectionName: "patientDeliveryTickets" },
      { key: "inventory", collectionName: "inventory" },
      { key: "imports", collectionName: "importJobs" },
      { key: "patients", collectionName: "patients_index" },
      {
        key: "techLocations",
        collectionName: "deliveryTechLocations",
        adminOnly: true,
      },
    ];

    for (const source of sources) {
      if (source.adminOnly && !isAdmin) {
        setLoaded((current) => ({ ...current, [source.key]: true }));
        continue;
      }

      const unsubscribe = onSnapshot(
        collection(db, source.collectionName),
        (snapshot) => {
          setRows((current) => ({
            ...current,
            [source.key]: snapshot.docs.slice(0, 150).map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })),
          }));
          setLoaded((current) => ({ ...current, [source.key]: true }));
        },
        (error) => {
          console.error(`PRODUCTION READINESS ${source.collectionName} ERROR:`, error);
          toast.error(`Unable to load ${source.collectionName} readiness data.`);
          setLoaded((current) => ({ ...current, [source.key]: true }));
        }
      );

      subscriptions.push(unsubscribe);
    }

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [isAdmin]);

  const stats = useMemo<ProductionReadinessStats>(() => {
    const activeDeliveries = rows.deliveryTickets.filter(isDeliveryActive);
    const deliveredTickets = rows.deliveryTickets.filter(
      (row) => lower(row.fulfillmentStatus || row.status) === "delivered"
    );
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    const missingSignatures = deliveredTickets.filter(
      (row) => lower(row.signatureStatus) !== "signed"
    ).length;
    const unassignedDeliveries = activeDeliveries.filter(
      (row) => !text(row.assignedTech || row.deliveryTechName)
    ).length;
    const loadedNotDelivered = activeDeliveries.filter(
      (row) =>
        number(row.loadedScanCount) > 0 &&
        number(row.deliveredScanCount) < Math.max(1, number(row.requiredScanCount))
    ).length;
    const staleTechCheckIns = rows.techLocations.filter((row) => {
      const recorded = timestampMillis(row.recordedAt || row.createdAt);
      return recorded > 0 && recorded < twoHoursAgo;
    }).length;
    const lowStockItems = rows.inventory.filter(
      (row) => hasThreshold(row) && inventoryAvailable(row) <= thresholdValue(row)
    ).length;
    const inventoryTraceIssues = rows.inventory.filter((row) => {
      return (
        !text(row.barcode) ||
        (!text(row.serial) && !text(row.serialNumber) && !text(row.lotNumber)) ||
        !text(row.hcpc || row.hcpcs)
      );
    }).length;
    const failedImports = rows.imports.filter((row) => {
      const status = lower(row.status || row.step);
      return status.includes("fail") || status.includes("error") || status.includes("blocked");
    }).length;
    const patientIdentityGaps = rows.patients.filter(identityGap).length;
    const chartDocumentGaps = rows.patients.filter(chartGap).length;

    const risk =
      missingSignatures * 9 +
      unassignedDeliveries * 6 +
      loadedNotDelivered * 7 +
      staleTechCheckIns * 3 +
      lowStockItems * 6 +
      inventoryTraceIssues * 2 +
      failedImports * 8 +
      patientIdentityGaps * 6 +
      chartDocumentGaps * 2;

    return {
      missingSignatures,
      unassignedDeliveries,
      loadedNotDelivered,
      staleTechCheckIns,
      lowStockItems,
      inventoryTraceIssues,
      failedImports,
      patientIdentityGaps,
      chartDocumentGaps,
      overallScore: Math.max(0, Math.min(100, 100 - risk)),
    };
  }, [rows]);

  const alerts = useMemo(() => buildProductionAlerts(stats), [stats]);
  const loading = !Object.values(loaded).every(Boolean);

  return {
    alerts,
    stats,
    loading,
  };
}
