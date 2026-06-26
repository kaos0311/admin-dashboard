"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Building2,
  HeartHandshake,
  PackageCheck,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import toast from "react-hot-toast";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { buttons, colors, glass, tiles, typography } from "@/theme";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";

import { normalizeBarcode } from "@/lib/barcode";
import { auth, db } from "@/lib/firebase";

import { InventoryEmptyState } from "./components/InventoryEmptyState";
import { InventoryFilters } from "./components/InventoryFilters";
import { InventoryForm } from "./components/InventoryForm";
import { InventoryHeader } from "./components/InventoryHeader";
import { InventoryLoadingState } from "./components/InventoryLoadingState";
import { type InventoryStatKey, InventoryStats } from "./components/InventoryStats";
import { InventoryStatsDrilldownModal } from "./components/InventoryStatsDrilldownModal";
import { JarvisNoticeModal } from "./components/JarvisNoticeModal";
import { type ScanAssignmentChoice, ScanAssignmentModal } from "./components/ScanAssignmentModal";
import { ScanSuccessModal } from "./components/ScanSuccessModal";

import { useInventoryActions } from "./hooks/useInventoryActions";
import { useInventoryData } from "./hooks/useInventoryData";
import { useInventoryFilters } from "./hooks/useInventoryFilters";
import { useInventoryForm } from "./hooks/useInventoryForm";
import { useInventorySettings } from "./hooks/useInventorySettings";

import { isActiveAssetRecord } from "./lib/assetRecords";
import { isLowStock, isServiceDue, isWarrantyExpired } from "./lib/inventoryAlerts";
import { buildSearchText } from "./lib/inventoryNormalize";
import type { InventoryItem, ScanTarget } from "./lib/inventoryTypes";
import { isRentalProperty } from "./lib/rentalProperty";
import type { PatientIndex } from "../reports/patients/lib/patientTypes";

type DeceasedPatientSummary = {
  id: string;
  fullName: string;
  dateOfDeath?: string;
  phone: string;
  lastDeliveryDate: string;
  lastPickupDate: string;
};

type DeceasedPickupCandidate = {
  item: InventoryItem;
  patient: DeceasedPatientSummary;
  lastDeliveryDate: string;
  pickupDate?: string;
  needsDateReview: boolean;
  reason: "deceased" | "pickup_after_delivery";
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateMs(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestDate(...values: string[]): string {
  return values
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] ?? "";
}

function formatDate(value: string): string {
  if (!value) return "Not listed";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString();
}

function normalizePatientMatchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapPatientForPickup(id: string, data: Record<string, unknown>): DeceasedPatientSummary | null {
  const dateOfDeath = cleanText(data.dateOfDeath) || cleanText(data.dod);

  const deliverySummary =
    data.deliverySummary && typeof data.deliverySummary === "object"
      ? (data.deliverySummary as Record<string, unknown>)
      : {};
  const billing =
    data.billing && typeof data.billing === "object"
      ? (data.billing as Record<string, unknown>)
      : {};
  const lastDeliveryDate = latestDate(
    cleanText(deliverySummary.actualDeliveryDate),
    cleanText(deliverySummary.scheduledDeliveryDate),
    cleanText(data.lastTreatmentDate),
    cleanText(data.lastEquipmentDate),
  );
  const lastPickupDate = latestDate(
    cleanText(billing.lastPickupDate),
    cleanText(data.lastPickupDate),
    cleanText(data.lastEquipmentDate),
  );

  if (!dateOfDeath && !(parseDateMs(lastPickupDate) > parseDateMs(lastDeliveryDate))) {
    return null;
  }

  return {
    id,
    fullName: cleanText(data.fullName) || cleanText(data.sourceFullName) || "Unnamed Patient",
    dateOfDeath,
    phone: cleanText(data.phone),
    lastDeliveryDate,
    lastPickupDate,
  };
}

function patientForInventoryItem(
  item: InventoryItem,
  patientsById: Map<string, DeceasedPatientSummary>,
  patientsByName: Map<string, DeceasedPatientSummary>
): DeceasedPatientSummary | null {
  for (const key of [item.patientKey, item.patientId]) {
    if (key && patientsById.has(key)) return patientsById.get(key) ?? null;
  }

  const nameKey = normalizePatientMatchKey(item.patientName ?? "");
  return nameKey ? patientsByName.get(nameKey) ?? null : null;
}

function buildDeceasedPickupCandidates(
  items: InventoryItem[],
  deceasedPatients: DeceasedPatientSummary[]
): DeceasedPickupCandidate[] {
  const patientsById = new Map(deceasedPatients.map((patient) => [patient.id, patient]));
  const patientsByName = new Map(
    deceasedPatients.map((patient) => [
      normalizePatientMatchKey(patient.fullName),
      patient,
    ])
  );

  return items
    .filter(isRentalProperty)
    .flatMap((item) => {
      const patient = patientForInventoryItem(item, patientsById, patientsByName);
      if (!patient) return [];

      const lastDeliveryDate = latestDate(
        item.lastDeliveredAt ?? "",
        item.originalDos ?? "",
        patient.lastDeliveryDate
      );
      const deathDateMs = parseDateMs(patient.dateOfDeath ?? "");
      const deliveryDateMs = parseDateMs(lastDeliveryDate);
      const pickupDateMs = parseDateMs(patient.lastPickupDate);

      const deceasedAfterDelivery =
        deathDateMs > 0 && (deliveryDateMs === 0 || deathDateMs >= deliveryDateMs);
      const pickupAfterDelivery =
        pickupDateMs > 0 && deliveryDateMs > 0 && pickupDateMs > deliveryDateMs;
      const reason: DeceasedPickupCandidate["reason"] = pickupAfterDelivery
        ? "pickup_after_delivery"
        : "deceased";

      if (!deceasedAfterDelivery && !pickupAfterDelivery) {
        return [];
      }

      return [{
        item,
        patient,
        lastDeliveryDate,
        pickupDate: patient.lastPickupDate,
        needsDateReview: !pickupAfterDelivery && (deliveryDateMs === 0 || deathDateMs === 0),
        reason,
      }];
    })
    .sort(
      (a, b) =>
        a.patient.fullName.localeCompare(b.patient.fullName) ||
        a.item.name.localeCompare(b.item.name)
    );
}

function equipmentMatchesInventory(
  equipment: Record<string, unknown>,
  item: InventoryItem
): boolean {
  return [
    [cleanText(equipment.inventoryId), item.id],
    [cleanText(equipment.productId), item.productId],
    [cleanText(equipment.serialNumber) || cleanText(equipment.serial), item.serial],
    [cleanText(equipment.lotNumber), item.lotNumber],
    [cleanText(equipment.itemId), item.sku || item.productId],
    [cleanText(equipment.itemName), item.name],
  ].some(([left, right]) => Boolean(left && right && left === right));
}

function archiveCurrentEquipmentArray(
  value: unknown,
  item: InventoryItem,
  archivedAt: string
): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null;

  let changed = false;
  const archived = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;

    const equipment = entry as Record<string, unknown>;
    if (!equipmentMatchesInventory(equipment, item)) return equipment;

    changed = true;
    return {
      ...equipment,
      status: "archived_returned",
      retrievalStatus: "picked_up_returned_to_inventory",
      archivedAt,
      returnedAt: archivedAt,
      lastUpdated: archivedAt,
    };
  });

  return changed ? (archived as Array<Record<string, unknown>>) : null;
}

export default function InventoryPage() {
  const {
    loading: authLoading,
    isAdmin,
    isAdminOrStaff,
  } = useAuthRole();

  const canRead =
    isAdminOrStaff;

  const canWrite =
    isAdminOrStaff;

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [saving, setSaving] =
    useState(false);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [scanTarget, setScanTarget] =
    useState<ScanTarget>(null);

  const [deceasedPatients, setDeceasedPatients] =
    useState<DeceasedPatientSummary[]>([]);

  const [checkingInItemId, setCheckingInItemId] =
    useState("");

  const [selectedStatKey, setSelectedStatKey] =
    useState<InventoryStatKey | null>(null);

  const [jarvisIdentifying, setJarvisIdentifying] =
    useState(false);

  const [scanSuccess, setScanSuccess] =
    useState<{
      title: string;
      message: string;
    } | null>(null);

  const [_scanOutCode, setScanOutCode] =
    useState<string | null>(null);

  const [_scanOutReason, setScanOutReason] =
    useState<"rental" | "purchase" | "maintenance">("rental");

  const [jarvisNotice, setJarvisNotice] =
    useState<{
      title: string;
      message: string;
    } | null>(null);

  const [pendingScan, setPendingScan] =
    useState<{ code: string; target: ScanTarget } | null>(null);

  const inventoryThresholds = useInventorySettings();

  const {
    items,
    loading,
    lastLoadedAt,
  } = useInventoryData({
    authLoading,
    canRead,
    refreshKey,
  });

  useEffect(() => {
    if (authLoading || !canRead) {
      setDeceasedPatients([]);
      return;
    }

    const patientsQuery = query(collection(db, "patients"), limit(2500));

    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        setDeceasedPatients(
          snapshot.docs.flatMap((patientDoc) => {
            const patient = mapPatientForPickup(
              patientDoc.id,
              patientDoc.data() as Partial<PatientIndex> as Record<string, unknown>
            );

            return patient ? [patient] : [];
          })
        );
      },
      (error) => {
        console.error("LOAD DECEASED PATIENT PICKUP CHECK ERROR:", error);
        toast.error("Could not load deceased patient pickup checks.");
        setDeceasedPatients([]);
      }
    );

    return unsubscribe;
  }, [authLoading, canRead]);

  const {
    form,
    updateForm,
    resetForm,
  } = useInventoryForm();

  const {
    search,
    setSearch,

    statusFilter,
    setStatusFilter,

    lifecycleFilter,
    setLifecycleFilter,

    alertFilter,
    setAlertFilter,

    sortKey,
    sortDirection,
    handleSortChange,

    filteredItems,
    summary,

    resetFilters,
  } = useInventoryFilters(items, inventoryThresholds);

  const {
    handleSubmit,
    handleScanMovement,
  } = useInventoryActions({
    form,
    canWrite,
    isAdmin,
    selectedIds: [],
    resetForm,
    removeSelectedId: () => {},
    clearSelected: () => {},
    setSaving,
  });

  const deceasedPickupCandidates = useMemo(
    () => buildDeceasedPickupCandidates(items, deceasedPatients),
    [deceasedPatients, items]
  );

  async function handleCheckInDeceasedPickup(candidate: DeceasedPickupCandidate) {
    if (!canWrite) {
      toast.error("You do not have permission to check inventory back in.");
      return;
    }

    const { item, patient } = candidate;
    const patientKey = item.patientKey || item.patientId || patient.id;

    if (!patientKey) {
      toast.error("This item is missing a patient key, so it cannot update the patient record.");
      return;
    }

    const confirmed = window.confirm(
      `Check "${item.name}" back into inventory from ${patient.fullName}? This will archive the matching equipment in the patient record and return the item to available inventory.`
    );

    if (!confirmed) return;

    const returnQuantity = Math.max(item.onRent ?? 0, item.status === "rental_out" ? 1 : 0, 1);
    const nextItem = {
      ...item,
      status: "available" as const,
      available: item.available + returnQuantity,
      onRent: 0,
      patientKey: "",
      patientId: "",
      patientName: "",
      patientDob: "",
      patientPhone: "",
      insuranceName: "",
      payor: "",
      planType: "",
      salesOrderId: "",
      salesOrderDetailId: "",
      nextBillingDate: "",
      nextDos: "",
      returnedFromPatientKey: patientKey,
      returnedFromPatientName: patient.fullName,
      activeAssetArchived: true,
      patientEquipmentArchived: true,
    };

    setCheckingInItemId(item.id);

    try {
      const now = serverTimestamp();
      const archivedAt = new Date().toISOString();
      const actor = auth.currentUser;
      const returnReason =
        candidate.reason === "pickup_after_delivery"
          ? "pickup_after_delivery_return"
          : "deceased_patient_pickup";
      const patientRef = doc(db, "patients", patientKey);
      const patientSnap = await getDoc(patientRef);
      const currentEquipmentUpdate = patientSnap.exists()
        ? archiveCurrentEquipmentArray(
            patientSnap.data().currentEquipment,
            item,
            archivedAt
          )
        : null;

      await updateDoc(doc(db, "inventory", item.id), {
        status: "available",
        available: nextItem.available,
        onRent: 0,
        patientKey: "",
        patientId: "",
        patientName: "",
        patientDob: "",
        patientPhone: "",
        insuranceName: "",
        payor: "",
        planType: "",
        salesOrderId: "",
        salesOrderDetailId: "",
        nextBillingDate: "",
        nextDos: "",
        returnedFromPatientKey: patientKey,
        returnedFromPatientName: patient.fullName,
        activeAssetArchived: true,
        patientEquipmentArchived: true,
        lastReturnedAt: now,
        returnReason,
        updatedAt: now,
        searchText: buildSearchText(nextItem),
      });

      if (currentEquipmentUpdate) {
        await updateDoc(patientRef, {
          currentEquipment: currentEquipmentUpdate,
          currentEquipmentArchivedAt: now,
          updatedAt: now,
        });
      }

      await addDoc(collection(db, "stockMovements"), {
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        serial: item.serial,
        lotNumber: item.lotNumber,
        type: returnReason,
        quantity: returnQuantity,
        source: "inventory",
        sourceId: item.id,
        patientKey,
        patientName: patient.fullName,
        dateOfDeath: patient.dateOfDeath ?? "",
        pickupDate: candidate.pickupDate ?? "",
        lastDeliveryDate: candidate.lastDeliveryDate,
        notes:
          candidate.reason === "pickup_after_delivery"
            ? "Checked back into inventory because pickup date is after delivery date."
            : "Checked back into inventory after deceased patient pickup review.",
        createdBy: actor?.uid ?? "",
        createdByEmail: actor?.email ?? "",
        createdAt: now,
      });

      await setDoc(
        doc(db, "patients", patientKey, "equipment", item.id),
        {
          inventoryId: item.id,
          productId: item.productId,
          itemName: item.name,
          barcode: item.barcode,
          serialNumber: item.serial,
          lotNumber: item.lotNumber,
          status: "returned",
          archived: true,
          archivedAt: now,
          archiveReason: returnReason,
          returnReason,
          returnedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "patients", patientKey, "timeline"), {
        type: "equipment_returned",
        title: "Equipment archived and checked back into inventory",
        body:
          candidate.reason === "pickup_after_delivery"
            ? `${item.name || "Equipment"} was archived from active equipment because pickup date is after delivery date and was returned to inventory.`
            : `${item.name || "Equipment"} was checked back into inventory after deceased patient pickup review.`,
        metadata: {
          inventoryId: item.id,
          productId: item.productId,
          barcode: item.barcode,
          serial: item.serial,
          lotNumber: item.lotNumber,
          dateOfDeath: patient.dateOfDeath ?? "",
          pickupDate: candidate.pickupDate ?? "",
          lastDeliveryDate: candidate.lastDeliveryDate,
          returnReason,
          archivedCurrentEquipment: Boolean(currentEquipmentUpdate),
        },
        actorUid: actor?.uid ?? null,
        actorEmail: actor?.email ?? null,
        createdAt: now,
      });

      toast.success(`${item.name || "Equipment"} checked back into inventory.`);
    } catch (error) {
      console.error("DECEASED PATIENT PICKUP CHECK-IN ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Could not check equipment back in.");
    } finally {
      setCheckingInItemId("");
    }
  }

  function openScanner(
    target: ScanTarget
  ) {
    setScanTarget(target);
    setScannerOpen(true);
  }

  function handleAssignmentConfirm(choice: ScanAssignmentChoice) {
    if (!pendingScan) return;

    const { code } = pendingScan;

    switch (choice) {
      case "lotNumber":
        updateForm("lotNumber", code);
        break;
      case "serial":
        updateForm("serial", code);
        break;
      case "barcodeSku":
        if (pendingScan.target === "lotNumber") {
          updateForm("lotNumber", code);
        } else {
          updateForm("barcode", code);
        }
        break;
      case "next":
        break;
      case "none":
      default:
        break;
    }

    setPendingScan(null);
    toast.success("Barcode scan captured.");
  }

  function handleScanDetected(
    code: string
  ) {
    const clean =
      normalizeBarcode(code);

    switch (scanTarget) {
      case "serial":
      case "lotNumber":
      case null:
        setPendingScan({ code: clean, target: scanTarget });
        return;

      case "scanIn":
        void handleScanMovement(clean, "in").then((success) => {
          if (!success) return;

          setScanSuccess({
            title: "Scan In Complete",
            message: `${clean} was saved to inventory successfully.`,
          });
        });
        return;

      case "scanOut":
        setScanOutCode(clean);
        setScanOutReason("rental");
        return;

      default:
        updateForm(
          "barcode",
          clean
        );
        break;
    }

    toast.success(
      "Barcode scan captured."
    );
  }

  const inventoryAutofillOptions = useMemo(() => {
    function unique(values: string[]) {
      return Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean))
      )
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 250);
    }

    return {
      itemNames: unique(items.map((item) => item.name)),
      categories: unique(items.map((item) => item.category)),
      skus: unique(items.map((item) => item.sku)),
      hcpcs: unique(items.map((item) => item.hcpc)),
      manufacturers: unique(items.map((item) => item.manufacturer)),
      locations: unique(items.map((item) => item.locationName)),
    };
  }, [items]);

  const rentalPropertyCount = useMemo(
    () => filteredItems.filter(isRentalProperty).length,
    [filteredItems]
  );

  const assetRecordCount = useMemo(
    () => filteredItems.filter(isActiveAssetRecord).length,
    [filteredItems]
  );

  const statDrilldowns = useMemo(() => {
    const entries: Record<
      InventoryStatKey,
      {
        title: string;
        description: string;
        items: InventoryItem[];
      }
    > = {
      items: {
        title: "All Inventory Items",
        description: "Every inventory record currently loaded from the inventory pipeline.",
        items,
      },
      available: {
        title: "Available Products",
        description: "Products currently marked with an available inventory status.",
        items: items.filter((item) => item.status === "available"),
      },
      lowStock: {
        title: "Low Stock Products",
        description: "Products at or below the configured reorder threshold.",
        items: items.filter((item) => isLowStock(item, inventoryThresholds)),
      },
      discontinued: {
        title: "Discontinued Products",
        description: "Products currently marked as discontinued.",
        items: items.filter((item) => item.status === "discontinued"),
      },
      serviceDue: {
        title: "Service Due Products",
        description: "Products with a next service date due today or earlier.",
        items: items.filter(isServiceDue),
      },
      warrantyExpired: {
        title: "Warranty Expired Products",
        description: "Products with warranty end dates earlier than today.",
        items: items.filter(isWarrantyExpired),
      },
      value: {
        title: "Inventory Value Products",
        description: "Products included in the total inventory value calculation.",
        items: items.filter((item) => item.totalValue !== 0 || item.quantityOnHand > 0),
      },
    };

    return entries;
  }, [inventoryThresholds, items]);

  const selectedStatDrilldown = selectedStatKey
    ? statDrilldowns[selectedStatKey]
    : null;

  function handleRefresh() {
    setRefreshKey(
      (current) =>
        current + 1
    );
  }

  function handleResetFilters() {
    resetFilters();
  }

  function handleScannerClose() {
    setScannerOpen(false);
    setScanTarget(null);
  }

  async function handleJarvisIdentifyCurrentItem() {
    if (!form.id) {
      toast.error("Select or save an inventory item before running Jarvis identify.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("You must be signed in to run Jarvis identify.");
      return;
    }

    setJarvisIdentifying(true);

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/jarvis/product-enrichment", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "identifyInventory",
          inventoryId: form.id,
          code: form.barcode || form.sku || form.serial,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        product?: {
          name?: string;
          category?: string;
          sku?: string;
          barcode?: string;
          manufacturer?: string;
          modelNumber?: string;
        };
      };

      if (!response.ok) {
        setJarvisNotice({
          title: "No Matching Product Found",
          message:
            "Jarvis is unable to find a matching product. The scan was kept for review so you can enter the product details manually.",
        });
        return;
      }

      if (result.product) {
        if (result.product.name) updateForm("name", result.product.name);
        if (result.product.category) updateForm("category", result.product.category);
        if (result.product.sku) updateForm("sku", result.product.sku);
        if (result.product.barcode) updateForm("barcode", result.product.barcode);
        if (result.product.manufacturer) updateForm("manufacturer", result.product.manufacturer);
        if (result.product.modelNumber) updateForm("modelNumber", result.product.modelNumber);
      }

      toast.success("Jarvis identified and updated the product record.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Jarvis identify failed.");
    } finally {
      setJarvisIdentifying(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Permission Gate
  |--------------------------------------------------------------------------
  */

  if (
    !authLoading &&
    !canRead
  ) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className={tiles.alert}>
            Inventory access denied.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={tiles.label}>
                <ShieldCheck className="h-3.5 w-3.5" />

                Inventory Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Inventory Command
                  Center
                </h1>

                <p className={`mt-3 max-w-3xl ${typography.body}`}>
                  Operational inventory
                  management for
                  lifecycle tracking,
                  warranty monitoring,
                  service due alerts,
                  batch actions,
                  barcode intake,
                  discontinuation, and
                  stock oversight.
                  Because eventually
                  someone loses a serial
                  number and pretends it
                  was never there.
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm p-4 sm:p-5`}>
              <div className="flex items-center gap-4">
                <div className={tiles.compact}>
                  <ScanLine className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className={typography.cardTitle}>
                      Inventory Scanner
                    </p>

                    <span className={tiles.label}>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />

                      Online
                    </span>
                  </div>

                  <p className={typography.caption}>
                    Camera, handheld, or manual scan intake.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openScanner("scanIn")}
                  className={buttons.success}
                  disabled={!canWrite}
                >
                  <ScanLine className="h-4 w-4" />
                  Scan In
                </button>

                <button
                  type="button"
                  onClick={() => openScanner("scanOut")}
                  className={buttons.warning}
                  disabled={!canWrite}
                >
                  <ScanLine className="h-4 w-4" />
                  Scan Out
                </button>
              </div>

              <div className={`${glass.inset} mt-3 px-3 py-2 ${typography.caption}`}>
                Writes to inventory and stock movements when a matching record is found.
              </div>
            </div>
          </div>
        </section>

        <InventoryHeader
          lastLoadedAt={
            lastLoadedAt
          }
          onResetFilters={
            handleResetFilters
          }
          onRefresh={
            handleRefresh
          }
        />

        <InventoryStats
          totalItems={
            summary.totalItems
          }
          available={
            summary.available
          }
          lowStock={
            summary.lowStock
          }
          discontinued={
            summary.discontinued
          }
          serviceDue={
            summary.serviceDue
          }
          warrantyExpired={
            summary.warrantyExpired
          }
          totalValue={
            summary.totalValue
          }
          onSelect={setSelectedStatKey}
        />

        <section className="space-y-6">
          <InventoryForm
            form={form}
            autofillOptions={inventoryAutofillOptions}
            saving={saving}
            canWrite={canWrite}
            onSubmit={
              handleSubmit
            }
            onReset={
              resetForm
            }
            onUpdate={
              updateForm
            }
            onOpenScanner={
              openScanner
            }
            onJarvisIdentify={() => {
              void handleJarvisIdentifyCurrentItem();
            }}
            jarvisIdentifying={jarvisIdentifying}
          />

          <section className={`${glass.panel} min-w-0 overflow-hidden`}>
            <div className={colors.grid} />

            <div className="relative p-4 sm:p-6">
              <div className="mb-5 space-y-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className={`${typography.sectionTitle} break-words`}>
                      Inventory Records
                    </h2>

                    <p className={`mt-2 ${typography.bodyMuted}`}>
                      {filteredItems.length.toLocaleString()} visible records
                    </p>
                  </div>

                </div>

                <InventoryFilters
                  search={search}
                  statusFilter={
                    statusFilter
                  }
                  lifecycleFilter={
                    lifecycleFilter
                  }
                  alertFilter={
                    alertFilter
                  }
                  sortKey={sortKey}
                  sortDirection={
                    sortDirection
                  }
                  onSearchChange={
                    setSearch
                  }
                  onStatusFilterChange={
                    setStatusFilter
                  }
                  onLifecycleFilterChange={
                    setLifecycleFilter
                  }
                  onAlertFilterChange={
                    setAlertFilter
                  }
                  onSortChange={
                    handleSortChange
                  }
                />
              </div>

              <div className="mt-5">
                {authLoading ||
                loading ? (
                  <InventoryLoadingState />
                ) : filteredItems.length ===
                  0 ? (
                  <InventoryEmptyState />
                ) : (
                  <div className="space-y-6">
                    <PickupReturnArchivePanel
                      candidates={deceasedPickupCandidates}
                      canWrite={canWrite}
                      checkingInItemId={checkingInItemId}
                      onCheckIn={(candidate) => {
                        void handleCheckInDeceasedPickup(candidate);
                      }}
                    />

                    <RentalPropertyRouteTile
                      visibleCount={rentalPropertyCount}
                    />

                    <AssetRecordsRouteTile
                      visibleCount={assetRecordCount}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={
          handleScannerClose
        }
        onDetected={
          handleScanDetected
        }
      />

      <InventoryStatsDrilldownModal
        open={Boolean(selectedStatDrilldown)}
        title={selectedStatDrilldown?.title ?? ""}
        description={selectedStatDrilldown?.description ?? ""}
        items={selectedStatDrilldown?.items ?? []}
        canWrite={canWrite}
        isAdmin={isAdmin}
        autofillOptions={inventoryAutofillOptions}
        onClose={() => setSelectedStatKey(null)}
      />

      <ScanAssignmentModal
        open={Boolean(pendingScan)}
        code={pendingScan?.code ?? ""}
        target={pendingScan?.target ?? null}
        saving={saving}
        onClose={() => setPendingScan(null)}
        onConfirm={handleAssignmentConfirm}
      />

      <ScanSuccessModal
        open={Boolean(scanSuccess)}
        title={scanSuccess?.title ?? ""}
        message={scanSuccess?.message ?? ""}
        onClose={() => setScanSuccess(null)}
      />

      <JarvisNoticeModal
        open={Boolean(jarvisNotice)}
        title={jarvisNotice?.title ?? ""}
        message={jarvisNotice?.message ?? ""}
        onClose={() => setJarvisNotice(null)}
      />
    </main>
  );
}

function AssetRecordsRouteTile({ visibleCount }: { visibleCount: number }) {
  return (
    <Link
      href="/inventory/asset-records"
      className={`${glass.cardPadded} group flex min-w-0 flex-col gap-4 transition hover:-translate-y-0.5 hover:border-[#7a9a5e]/35 hover:bg-[#242424] sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={tiles.icon}>
          <PackageCheck className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className={tiles.label}>Moved to dedicated page</p>
          <h2 className={`${typography.cardTitle} mt-1`}>
            Asset Records
          </h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Open asset title groups, patient links, serials, HCPCS, and asset
            detail records away from the active inventory workspace.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={tiles.badge}>
          {visibleCount.toLocaleString()} visible assets
        </span>
        <span className={buttons.compactSecondary}>Open</span>
      </div>
    </Link>
  );
}

function RentalPropertyRouteTile({ visibleCount }: { visibleCount: number }) {
  return (
    <Link
      href="/inventory/rental-property"
      className={`${glass.cardPadded} group flex min-w-0 flex-col gap-4 transition hover:-translate-y-0.5 hover:border-[#7a9a5e]/35 hover:bg-[#242424] sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={tiles.icon}>
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className={tiles.label}>Moved to dedicated page</p>
          <h2 className={`${typography.cardTitle} mt-1`}>
            Insurance Rental Property
          </h2>
          <p className={`${typography.bodyMuted} mt-1`}>
            Review Hospice and insurance rental patients without crowding the
            active inventory records.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={tiles.badge}>
          {visibleCount.toLocaleString()} visible rentals
        </span>
        <span className={buttons.compactSecondary}>Open</span>
      </div>
    </Link>
  );
}

function PickupReturnArchivePanel({
  candidates,
  canWrite,
  checkingInItemId,
  onCheckIn,
}: {
  candidates: DeceasedPickupCandidate[];
  canWrite: boolean;
  checkingInItemId: string;
  onCheckIn: (candidate: DeceasedPickupCandidate) => void;
}) {
  return (
    <section className={`${glass.panel} min-w-0 overflow-hidden`}>
      <div className={colors.grid} />

      <div className="relative p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className={tiles.label}>
              <HeartHandshake className="h-3.5 w-3.5" />
              Pickup Return Archive Check
            </div>

            <h2 className={`${typography.sectionTitle} mt-3`}>
              Equipment Needing Pickup Archive
            </h2>

            <p className={`${typography.bodyMuted} mt-2 max-w-4xl`}>
              Rented inventory assigned to patients with a pickup date after
              the last delivery/date-of-service signal, plus deceased-patient
              pickup records. Use this to archive the equipment in the patient
              digital record and return the item to inventory.
            </p>
          </div>

          <span className={tiles.badge}>
            {candidates.length.toLocaleString()} flagged
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className={`${glass.insetPadded} mt-5 ${typography.bodyMuted}`}>
            No pickup-after-delivery rental candidates are visible in the
            current inventory load.
          </div>
        ) : (
          <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
            {candidates.map((candidate) => {
              const { item, patient } = candidate;
              const checkingIn = checkingInItemId === item.id;

              return (
                <article key={`${patient.id}-${item.id}`} className={glass.cardPadded}>
                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className={`${typography.bodyStrong} break-words`}>
                        {patient.fullName}
                      </p>
                      <p className={`${typography.smallMuted} mt-1`}>
                        Pickup {formatDate(candidate.pickupDate ?? "")} | Last delivery{" "}
                        {formatDate(candidate.lastDeliveryDate)}
                      </p>
                      {patient.dateOfDeath ? (
                        <p className={`${typography.smallMuted} mt-1`}>
                          DOD {formatDate(patient.dateOfDeath)}
                        </p>
                      ) : null}
                      {candidate.needsDateReview ? (
                        <p className={`${typography.warningText} mt-2 text-sm`}>
                          Date review needed before check-in.
                        </p>
                      ) : null}
                    </div>

                    <Link
                      href={`/reports/patients/${encodeURIComponent(patient.id)}?tab=items`}
                      className={buttons.compactSecondary}
                    >
                      Open Record
                    </Link>
                  </div>

                  <div className={`${glass.insetPadded} mt-4`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                      <div className="min-w-0">
                        <p className={`${typography.bodyStrong} break-words`}>
                          {item.name || "Unnamed equipment"}
                        </p>
                        <p className={`${typography.smallMuted} mt-1 break-words`}>
                          Serial {item.serial || "-"} | Barcode {item.barcode || "-"} |
                          HCPCS {item.hcpc || "-"}
                        </p>
                        <p className={`${typography.smallMuted} mt-1`}>
                          On rent {item.onRent.toLocaleString()} | Available{" "}
                          {item.available.toLocaleString()} | Location{" "}
                          {item.locationName || "Main Location"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttons.success}
                      disabled={!canWrite || checkingIn || candidate.needsDateReview}
                      onClick={() => onCheckIn(candidate)}
                    >
                      <PackageCheck className="h-4 w-4" />
                      {checkingIn ? "Checking in..." : "Archive and Return"}
                    </button>

                    {candidate.needsDateReview ? (
                      <span className={tiles.tagMuted}>
                        Verify death and delivery dates first
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}








