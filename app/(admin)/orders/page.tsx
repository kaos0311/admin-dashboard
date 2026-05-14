"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes } from "firebase/storage";
import {
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  FileSearch,
  FileUp,
  Filter,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  Sparkles,
  Undo2,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import BarcodeScannerModal from "@/app/components/barcode/BarcodeScannerModal";
import { normalizeBarcode } from "@/lib/barcode";
import { auth, db, storage } from "@/lib/firebase";
import {
  allocateInventoryToOrder,
  findProductByBarcode,
  restoreInventoryFromOrder,
} from "@/lib/inventory";

type OrderStatus =
  | "processing"
  | "ready"
  | "delivered"
  | "cancelled"
  | "archived";

type FilterTab = OrderStatus | "all";

type ImportReportType =
  | "deliveryTickets"
  | "outstandingSalesOrders"
  | "billingReview"
  | "genericOrders";

type ImportJobStatus =
  | "uploaded"
  | "processing"
  | "complete"
  | "empty"
  | "failed";

type SmartReviewReason =
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

type SmartRouteTarget =
  | "orders"
  | "patients"
  | "hospicePatients"
  | "rentals"
  | "insurancePatients"
  | "analytics"
  | "review";

type OrderRow = {
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

type ImportJob = {
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

type OrderFormState = {
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

type SmartDetectionResult = {
  reportType: ImportReportType;
  confidence: number;
  reasons: string[];
};

type SmartFilters = {
  sourceReportType: string;
  facilityName: string;
  insurance: string;
  reviewOnly: boolean;
  inventoryOnly: boolean;
  hospiceRiskOnly: boolean;
  missingProductOnly: boolean;
  archiveReadyOnly: boolean;
};

const initialFormState: OrderFormState = {
  patientName: "",
  patientAddress: "",
  productId: "",
  productType: "",
  purchaseCost: "",
  quantity: "1",
  barcode: "",
  phone: "",
  facilityName: "",
  status: "processing",
  notes: "",
};

const initialSmartFilters: SmartFilters = {
  sourceReportType: "",
  facilityName: "",
  insurance: "",
  reviewOnly: false,
  inventoryOnly: false,
  hospiceRiskOnly: false,
  missingProductOnly: false,
  archiveReadyOnly: false,
};

const ORDERS_PAGE_SIZE = 75;
const IMPORT_SAMPLE_BYTES = 48_000;

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatDate(date: Date | null): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCompact(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

function normalizeDob(value: string): string {
  return normalizeSearchText(value);
}

function makePatientKey(input: {
  patientName: string;
  dob?: string;
  phone?: string;
  patientAddress?: string;
}): string {
  const name = normalizeSearchText(input.patientName);
  const dob = normalizeDob(input.dob || "");
  const phone = normalizePhone(input.phone || "");
  const address = normalizeCompact(input.patientAddress || "");

  if (name && dob) return `${name}|dob:${dob}`;
  if (name && phone) return `${name}|phone:${phone}`;
  if (name && address) return `${name}|addr:${address.slice(0, 36)}`;

  return name || "";
}

function makeOrderKey(input: {
  salesOrderNumber?: string;
  customerId?: string;
  patientName: string;
  dob?: string;
  productType: string;
  createdAt?: Date | null;
}): string {
  const salesOrderNumber = normalizeCompact(input.salesOrderNumber || "");
  const customerId = normalizeCompact(input.customerId || "");

  if (salesOrderNumber) return `so:${salesOrderNumber}`;

  if (customerId && input.productType) {
    return `customer:${customerId}|product:${normalizeCompact(
      input.productType
    )}`;
  }

  return normalizeSearchText(
    [
      input.patientName,
      input.dob || "",
      input.productType,
      input.createdAt ? input.createdAt.toISOString().slice(0, 10) : "",
    ].join(" ")
  );
}

function isHospiceText(value: string): boolean {
  return value.toLowerCase().includes("hospice");
}

function makeDuplicateImportKey(file: File, reportType: ImportReportType): string {
  return normalizeSearchText(`${reportType}_${file.name}_${file.size}`);
}

function getCurrentUserLabel(): string {
  return (
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    auth.currentUser?.uid ||
    "Unknown user"
  );
}

async function setDocSafe(
  docRef: DocumentReference,
  payload: Record<string, unknown>
): Promise<void> {
  await setDoc(docRef, payload, { merge: true });
}

function getReviewReasons(order: OrderRow): SmartReviewReason[] {
  const reasons = new Set<SmartReviewReason>();

  if (!order.patientName.trim()) reasons.add("missingPatientName");
  if (!order.patientAddress.trim()) reasons.add("missingAddress");
  if (!order.productType.trim()) reasons.add("missingProduct");
  if (!order.productId.trim()) reasons.add("missingProductId");
  if (!order.dob?.trim()) reasons.add("missingDob");
  if (!order.phone?.trim()) reasons.add("missingPhone");

  if (
    order.isHospice === true ||
    isHospiceText(order.insurance || "") ||
    isHospiceText(order.facilityName || "") ||
    isHospiceText(order.notes || "")
  ) {
    reasons.add("possibleHospice");
  }

  if (!order.inventoryAllocated && order.status !== "cancelled") {
    reasons.add("inventoryNotAllocated");
  }

  if (order.status === "cancelled" && order.inventoryRestored) {
    reasons.add("cancelledInventoryRestored");
  }

  if (order.status === "archived") reasons.add("archived");

  if (order.status === "delivered" || order.status === "cancelled") {
    reasons.add("deliveredReadyForArchive");
  }

  return [...reasons];
}

function getSmartRouteTargets(order: OrderRow): SmartRouteTarget[] {
  const targets = new Set<SmartRouteTarget>();

  targets.add("orders");
  targets.add("patients");
  targets.add("analytics");

  if (order.insurance) targets.add("insurancePatients");

  if (
    order.isHospice ||
    isHospiceText(order.insurance || "") ||
    isHospiceText(order.facilityName || "")
  ) {
    targets.add("hospicePatients");
  }

  if (order.needsReview || getReviewReasons(order).length > 0) {
    targets.add("review");
  }

  return [...targets];
}

function normalizeOrder(id: string, data: Record<string, unknown>): OrderRow {
  const statusRaw =
    typeof data.status === "string" ? data.status.toLowerCase() : "processing";

  const status: OrderStatus =
    statusRaw === "ready" ||
    statusRaw === "delivered" ||
    statusRaw === "cancelled" ||
    statusRaw === "archived"
      ? statusRaw
      : "processing";

  const createdAt = toDateSafe(data.createdAt);

  const baseOrder: OrderRow = {
    id,
    patientName:
      typeof data.patientName === "string"
        ? data.patientName
        : typeof data.customerName === "string"
          ? data.customerName
          : "",
    patientAddress:
      typeof data.patientAddress === "string"
        ? data.patientAddress
        : typeof data.address === "string"
          ? data.address
          : "",
    productId: typeof data.productId === "string" ? data.productId : "",
    productType:
      typeof data.productType === "string"
        ? data.productType
        : typeof data.item === "string"
          ? data.item
          : typeof data.productName === "string"
            ? data.productName
            : "",
    purchaseCost:
      typeof data.purchaseCost === "number"
        ? data.purchaseCost
        : typeof data.cost === "number"
          ? data.cost
          : typeof data.price === "number"
            ? data.price
            : 0,
    quantity:
      typeof data.quantity === "number" && Number.isFinite(data.quantity)
        ? data.quantity
        : 1,
    barcode: typeof data.barcode === "string" ? data.barcode : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    facilityName:
      typeof data.facilityName === "string"
        ? data.facilityName
        : typeof data.facility === "string"
          ? data.facility
          : "",
    status,
    notes: typeof data.notes === "string" ? data.notes : "",
    createdAt,
    updatedAt: toDateSafe(data.updatedAt),
    sourceImportId:
      typeof data.sourceImportId === "string" ? data.sourceImportId : "",
    sourceReportType:
      typeof data.sourceReportType === "string" ? data.sourceReportType : "",
    salesOrderNumber:
      typeof data.salesOrderNumber === "string" ? data.salesOrderNumber : "",
    customerId: typeof data.customerId === "string" ? data.customerId : "",
    dob: typeof data.dob === "string" ? data.dob : "",
    insurance: typeof data.insurance === "string" ? data.insurance : "",
    isHospice: data.isHospice === true,
    inventoryAllocated: data.inventoryAllocated === true,
    inventoryAllocationSourceId:
      typeof data.inventoryAllocationSourceId === "string"
        ? data.inventoryAllocationSourceId
        : "",
    inventoryRestored: data.inventoryRestored === true,
    searchText: typeof data.searchText === "string" ? data.searchText : "",
    patientKey: typeof data.patientKey === "string" ? data.patientKey : "",
    orderKey: typeof data.orderKey === "string" ? data.orderKey : "",
    normalizedName:
      typeof data.normalizedName === "string" ? data.normalizedName : "",
    normalizedDob:
      typeof data.normalizedDob === "string" ? data.normalizedDob : "",
    normalizedPhone:
      typeof data.normalizedPhone === "string" ? data.normalizedPhone : "",
    normalizedAddress:
      typeof data.normalizedAddress === "string" ? data.normalizedAddress : "",
    needsReview: data.needsReview === true,
    reviewReasons: Array.isArray(data.reviewReasons)
      ? data.reviewReasons.filter(
          (item): item is SmartReviewReason => typeof item === "string"
        )
      : [],
    smartRouteTargets: Array.isArray(data.smartRouteTargets)
      ? data.smartRouteTargets.filter(
          (item): item is SmartRouteTarget => typeof item === "string"
        )
      : [],
    linkedPatientId:
      typeof data.linkedPatientId === "string" ? data.linkedPatientId : "",
    linkedInventoryId:
      typeof data.linkedInventoryId === "string" ? data.linkedInventoryId : "",
  };

  const reviewReasons = baseOrder.reviewReasons?.length
    ? baseOrder.reviewReasons
    : getReviewReasons(baseOrder);

  const patientKey =
    baseOrder.patientKey ||
    makePatientKey({
      patientName: baseOrder.patientName,
      dob: baseOrder.dob,
      phone: baseOrder.phone,
      patientAddress: baseOrder.patientAddress,
    });

  const orderKey =
    baseOrder.orderKey ||
    makeOrderKey({
      salesOrderNumber: baseOrder.salesOrderNumber,
      customerId: baseOrder.customerId,
      patientName: baseOrder.patientName,
      dob: baseOrder.dob,
      productType: baseOrder.productType,
      createdAt,
    });

  return {
    ...baseOrder,
    patientKey,
    orderKey,
    normalizedName:
      baseOrder.normalizedName || normalizeSearchText(baseOrder.patientName),
    normalizedDob: baseOrder.normalizedDob || normalizeDob(baseOrder.dob || ""),
    normalizedPhone:
      baseOrder.normalizedPhone || normalizePhone(baseOrder.phone || ""),
    normalizedAddress:
      baseOrder.normalizedAddress ||
      normalizeSearchText(baseOrder.patientAddress),
    needsReview: baseOrder.needsReview || reviewReasons.length > 0,
    reviewReasons,
    smartRouteTargets: baseOrder.smartRouteTargets?.length
      ? baseOrder.smartRouteTargets
      : getSmartRouteTargets({ ...baseOrder, reviewReasons }),
  };
}

function normalizeImportJob(id: string, data: Record<string, unknown>): ImportJob {
  const statusRaw = typeof data.status === "string" ? data.status : "uploaded";

  const status: ImportJobStatus =
    statusRaw === "processing" ||
    statusRaw === "complete" ||
    statusRaw === "empty" ||
    statusRaw === "failed"
      ? statusRaw
      : "uploaded";

  return {
    id,
    reportType: typeof data.reportType === "string" ? data.reportType : "",
    detectedReportType:
      typeof data.detectedReportType === "string"
        ? data.detectedReportType
        : "",
    detectionConfidence:
      typeof data.detectionConfidence === "number"
        ? data.detectionConfidence
        : 0,
    fileName: typeof data.fileName === "string" ? data.fileName : "",
    fileSize: typeof data.fileSize === "number" ? data.fileSize : 0,
    status,
    rowCount: typeof data.rowCount === "number" ? data.rowCount : 0,
    skippedHospiceRows:
      typeof data.skippedHospiceRows === "number"
        ? data.skippedHospiceRows
        : 0,
    duplicateRows:
      typeof data.duplicateRows === "number" ? data.duplicateRows : 0,
    missingDobRows:
      typeof data.missingDobRows === "number" ? data.missingDobRows : 0,
    missingAddressRows:
      typeof data.missingAddressRows === "number"
        ? data.missingAddressRows
        : 0,
    missingProductRows:
      typeof data.missingProductRows === "number"
        ? data.missingProductRows
        : 0,
    needsReviewRows:
      typeof data.needsReviewRows === "number" ? data.needsReviewRows : 0,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : "",
    storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
    duplicateKey:
      typeof data.duplicateKey === "string" ? data.duplicateKey : "",
    createdAt: toDateSafe(data.createdAt),
    updatedAt: toDateSafe(data.updatedAt),
    completedAt: toDateSafe(data.completedAt),
  };
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

async function findRecentDuplicateImport(
  duplicateKey: string
): Promise<ImportJob | null> {
  const duplicateQuery = query(
    collection(db, "importJobs"),
    where("duplicateKey", "==", duplicateKey),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(duplicateQuery);
  if (snapshot.empty) return null;

  const first = snapshot.docs[0];
  return normalizeImportJob(first.id, first.data() as Record<string, unknown>);
}

async function readFileSample(file: File): Promise<string> {
  const blob = file.slice(0, IMPORT_SAMPLE_BYTES);
  return await blob.text();
}

async function detectReportTypeFromFile(
  file: File
): Promise<SmartDetectionResult> {
  const lowerName = file.name.toLowerCase();
  let sample = "";

  try {
    if (
      file.type.includes("csv") ||
      lowerName.endsWith(".csv") ||
      file.type.includes("text")
    ) {
      sample = await readFileSample(file);
    }
  } catch {
    sample = "";
  }

  const haystack = `${lowerName}\n${sample}`.toLowerCase();
  const reasons: string[] = [];

  let deliveryScore = 0;
  let outstandingScore = 0;
  let billingScore = 0;

  if (haystack.includes("delivery ticket")) {
    deliveryScore += 4;
    reasons.push("Found delivery ticket language.");
  }

  if (haystack.includes("ticket")) deliveryScore += 1;
  if (haystack.includes("delivery")) deliveryScore += 2;
  if (lowerName.endsWith(".pdf") || file.type.includes("pdf")) deliveryScore += 1;

  if (haystack.includes("outstanding sales")) {
    outstandingScore += 4;
    reasons.push("Found outstanding sales language.");
  }

  if (haystack.includes("sales order")) outstandingScore += 3;
  if (haystack.includes("so number")) outstandingScore += 2;
  if (haystack.includes("customer id")) outstandingScore += 1;

  if (haystack.includes("billing review")) {
    billingScore += 4;
    reasons.push("Found billing review language.");
  }

  if (haystack.includes("payor")) billingScore += 2;
  if (haystack.includes("insurance")) billingScore += 2;
  if (haystack.includes("balance")) billingScore += 1;
  if (haystack.includes("claim")) billingScore += 1;

  const scores: Array<{ type: ImportReportType; score: number }> = [
    { type: "deliveryTickets", score: deliveryScore },
    { type: "outstandingSalesOrders", score: outstandingScore },
    { type: "billingReview", score: billingScore },
    { type: "genericOrders", score: 1 },
  ];

  scores.sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const confidence = Math.min(0.98, Math.max(0.25, winner.score / 8));

  if (!reasons.length) {
    reasons.push("No strong report pattern found. Using generic fallback.");
  }

  return {
    reportType: winner.type,
    confidence,
    reasons,
  };
}

function getReportTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    deliveryTickets: "Delivery Tickets",
    outstandingSalesOrders: "Outstanding Sales Orders",
    billingReview: "Billing Review",
    genericOrders: "Generic Orders",
  };

  return labels[value] || value || "Unknown";
}

function getReviewReasonLabel(reason: SmartReviewReason): string {
  const labels: Record<SmartReviewReason, string> = {
    missingPatientName: "Missing patient",
    missingAddress: "Missing address",
    missingProduct: "Missing product",
    missingProductId: "No linked inventory",
    missingDob: "Missing DOB",
    missingPhone: "Missing phone",
    possibleHospice: "Possible hospice",
    inventoryNotAllocated: "Inventory not allocated",
    cancelledInventoryRestored: "Cancelled/restored",
    archived: "Archived",
    deliveredReadyForArchive: "Ready to archive",
    duplicateRisk: "Duplicate risk",
  };

  return labels[reason];
}

function isArchivedStatus(status: OrderStatus): boolean {
  return status === "delivered" || status === "cancelled" || status === "archived";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("processing");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [lastCursor, setLastCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [smartFilters, setSmartFilters] =
    useState<SmartFilters>(initialSmartFilters);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState<OrderFormState>(initialFormState);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OrderFormState>(initialFormState);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [importType, setImportType] =
    useState<ImportReportType>("deliveryTickets");
  const [detectedImport, setDetectedImport] =
    useState<SmartDetectionResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthed(Boolean(user));

      if (!user) {
        setOrders([]);
        setLoading(false);
        setLastCursor(null);
        setHasMore(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const buildOrdersQuery = useCallback(
    (
      currentTab: FilterTab,
      cursor?: QueryDocumentSnapshot<DocumentData> | null
    ) => {
      const baseCollection = collection(db, "orders");

      if (currentTab === "all") {
        return cursor
          ? query(
              baseCollection,
              where("isHospice", "==", false),
              orderBy("createdAt", "desc"),
              startAfter(cursor),
              limit(ORDERS_PAGE_SIZE)
            )
          : query(
              baseCollection,
              where("isHospice", "==", false),
              orderBy("createdAt", "desc"),
              limit(ORDERS_PAGE_SIZE)
            );
      }

      return cursor
        ? query(
            baseCollection,
            where("status", "==", currentTab),
            where("isHospice", "==", false),
            orderBy("createdAt", "desc"),
            startAfter(cursor),
            limit(ORDERS_PAGE_SIZE)
          )
        : query(
            baseCollection,
            where("status", "==", currentTab),
            where("isHospice", "==", false),
            orderBy("createdAt", "desc"),
            limit(ORDERS_PAGE_SIZE)
          );
    },
    []
  );

  const loadOrders = useCallback(
    async (mode: "initial" | "refresh" | "more" = "initial") => {
      if (!isAuthed) return;

      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        if (mode === "more") setLoadingMore(true);

        const cursor = mode === "more" ? lastCursor : null;
        const q = buildOrdersQuery(tab, cursor);
        const snapshot = await getDocs(q);

        const next = snapshot.docs
          .map((docSnap) =>
            normalizeOrder(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
          .filter(
            (order) =>
              !order.isHospice && !isHospiceText(order.insurance || "")
          );

        setOrders((prev) => {
          if (mode !== "more") return next;

          const existing = new Set(prev.map((order) => order.id));
          const uniqueNext = next.filter((order) => !existing.has(order.id));

          return [...prev, ...uniqueNext];
        });

        setHasMore(snapshot.docs.length === ORDERS_PAGE_SIZE);
        setLastCursor(
          snapshot.docs.length
            ? snapshot.docs[snapshot.docs.length - 1]
            : null
        );
      } catch (error: unknown) {
        console.error("LOAD ORDERS ERROR:", error);
        if (mode !== "more") setOrders([]);
        toast.error(
          error instanceof Error ? error.message : "Failed to load orders."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [buildOrdersQuery, isAuthed, lastCursor, tab]
  );

  useEffect(() => {
    if (!isAuthed) return;

    setLastCursor(null);
    void loadOrders("initial");
  }, [isAuthed, tab, loadOrders]);

  const summary = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      processing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      archived: 0,
    };

    let needsReview = 0;
    let inventoryIssues = 0;
    let hospiceRisks = 0;
    let missingProduct = 0;
    let archiveReady = 0;

    for (const order of orders) {
      counts[order.status] += 1;

      const reasons = order.reviewReasons || [];

      if (order.needsReview || reasons.length > 0) needsReview += 1;
      if (reasons.includes("inventoryNotAllocated")) inventoryIssues += 1;
      if (reasons.includes("possibleHospice")) hospiceRisks += 1;
      if (
        reasons.includes("missingProduct") ||
        reasons.includes("missingProductId")
      ) {
        missingProduct += 1;
      }
      if (reasons.includes("deliveredReadyForArchive")) archiveReady += 1;
    }

    return {
      ...counts,
      needsReview,
      inventoryIssues,
      hospiceRisks,
      missingProduct,
      archiveReady,
    };
  }, [orders]);

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "processing", label: "Processing", count: summary.processing },
    { key: "ready", label: "Ready", count: summary.ready },
    { key: "delivered", label: "Delivered", count: summary.delivered },
    { key: "cancelled", label: "Cancelled", count: summary.cancelled },
    { key: "archived", label: "Archived", count: summary.archived },
    { key: "all", label: "All Loaded", count: orders.length },
  ];

  const filterOptions = useMemo(() => {
    const reportTypes = new Set<string>();
    const facilities = new Set<string>();
    const insurances = new Set<string>();

    for (const order of orders) {
      if (order.sourceReportType) reportTypes.add(order.sourceReportType);
      if (order.facilityName) facilities.add(order.facilityName);
      if (order.insurance) insurances.add(order.insurance);
    }

    return {
      reportTypes: [...reportTypes].sort(),
      facilities: [...facilities].sort(),
      insurances: [...insurances].sort(),
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = normalizeSearchText(debouncedSearch);

    return orders.filter((order) => {
      const reasons = order.reviewReasons || [];

      if (
        smartFilters.sourceReportType &&
        order.sourceReportType !== smartFilters.sourceReportType
      ) {
        return false;
      }

      if (
        smartFilters.facilityName &&
        order.facilityName !== smartFilters.facilityName
      ) {
        return false;
      }

      if (smartFilters.insurance && order.insurance !== smartFilters.insurance) {
        return false;
      }

      if (smartFilters.reviewOnly && !order.needsReview) return false;

      if (
        smartFilters.inventoryOnly &&
        !reasons.includes("inventoryNotAllocated")
      ) {
        return false;
      }

      if (
        smartFilters.hospiceRiskOnly &&
        !reasons.includes("possibleHospice")
      ) {
        return false;
      }

      if (
        smartFilters.missingProductOnly &&
        !reasons.includes("missingProduct") &&
        !reasons.includes("missingProductId")
      ) {
        return false;
      }

      if (
        smartFilters.archiveReadyOnly &&
        !reasons.includes("deliveredReadyForArchive")
      ) {
        return false;
      }

      if (!term) return true;

      const haystack =
        order.searchText ||
        normalizeSearchText(
          [
            order.patientName,
            order.patientAddress,
            order.productType,
            order.phone,
            order.facilityName,
            order.notes,
            order.barcode,
            order.salesOrderNumber,
            order.customerId,
            order.dob,
            order.insurance,
            order.patientKey,
            order.orderKey,
          ].join(" ")
        );

      return haystack.includes(term);
    });
  }, [orders, debouncedSearch, smartFilters]);

  const resetCreateForm = () => {
    setForm(initialFormState);
    setCreateError("");
  };

  const resetEditForm = () => {
    setEditForm(initialFormState);
    setEditError("");
    setEditingOrderId(null);
  };

  const handleCreateChange = (field: keyof OrderFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditChange = (field: keyof OrderFormState, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    resetCreateForm();
  };

  const openEditModal = (order: OrderRow) => {
    setEditingOrderId(order.id);
    setEditError("");
    setEditForm({
      patientName: order.patientName,
      patientAddress: order.patientAddress,
      productId: order.productId,
      productType: order.productType,
      purchaseCost: order.purchaseCost ? String(order.purchaseCost) : "",
      quantity: String(order.quantity || 1),
      barcode: order.barcode,
      phone: order.phone,
      facilityName: order.facilityName,
      status: order.status === "archived" ? "processing" : order.status,
      notes: order.notes,
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (editing) return;
    setShowEditModal(false);
    resetEditForm();
  };

  async function fillProductFromBarcode(
    barcode: string,
    mode: "create" | "edit"
  ): Promise<void> {
    const clean = normalizeBarcode(barcode);

    if (!clean) {
      toast.error("Barcode is required.");
      return;
    }

    const product = await findProductByBarcode(clean);

    if (!product) {
      toast.error("No inventory item found for that barcode.");
      return;
    }

    const apply = (prev: OrderFormState): OrderFormState => ({
      ...prev,
      productId: product.id,
      productType: product.name,
      purchaseCost: String(product.price ?? 0),
      barcode: product.barcode ?? clean,
    });

    if (mode === "create") setForm(apply);
    else setEditForm(apply);

    toast.success(`Loaded inventory item: ${product.name}`);
  }

  function validateOrderForm(data: OrderFormState): string {
    if (!data.patientName.trim()) return "Patient name is required.";
    if (!data.patientAddress.trim()) return "Patient address is required.";
    if (!data.productType.trim()) return "Product type is required.";
    if (!data.productId.trim()) return "A linked inventory item is required.";

    const purchaseCost = Number(data.purchaseCost);
    if (Number.isNaN(purchaseCost) || purchaseCost < 0) {
      return "Purchase cost must be 0 or greater.";
    }

    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Quantity must be at least 1.";
    }

    return "";
  }

  function buildSmartOrderPayload(data: OrderFormState) {
    const patientName = data.patientName.trim();
    const patientAddress = data.patientAddress.trim();
    const productType = data.productType.trim();
    const phone = data.phone.trim();
    const barcode = normalizeBarcode(data.barcode);
    const facilityName = data.facilityName.trim();
    const notes = data.notes.trim();

    const patientKey = makePatientKey({
      patientName,
      phone,
      patientAddress,
    });

    const orderKey = makeOrderKey({
      patientName,
      productType,
      createdAt: new Date(),
    });

    const searchText = normalizeSearchText(
      [
        patientName,
        patientAddress,
        productType,
        phone,
        facilityName,
        notes,
        barcode,
        patientKey,
        orderKey,
      ].join(" ")
    );

    const reviewReasons: SmartReviewReason[] = [];
    if (!phone) reviewReasons.push("missingPhone");

    return {
      patientName,
      patientAddress,
      productId: data.productId.trim(),
      productType,
      purchaseCost: Number(data.purchaseCost),
      quantity: Number(data.quantity),
      barcode,
      phone,
      facilityName,
      status: data.status,
      notes,
      isHospice: false,
      inventoryAllocated: false,
      inventoryAllocationSourceId: "",
      inventoryRestored: false,
      patientKey,
      orderKey,
      normalizedName: normalizeSearchText(patientName),
      normalizedDob: "",
      normalizedPhone: normalizePhone(phone),
      normalizedAddress: normalizeSearchText(patientAddress),
      needsReview: reviewReasons.length > 0,
      reviewReasons,
      smartRouteTargets: ["orders", "patients", "analytics"],
      linkedPatientId: "",
      linkedInventoryId: data.productId.trim(),
      searchText,
    };
  }

  async function handleCreateOrder() {
    const validationError = validateOrderForm(form);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const payload = buildSmartOrderPayload(form);

      const orderRef = await addDoc(collection(db, "orders"), {
        ...payload,
        createdBy: getCurrentUserLabel(),
        createdByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await allocateInventoryToOrder({
        productId: form.productId.trim(),
        quantity: Number(form.quantity),
        sourceId: orderRef.id,
        notes: `Order for ${form.patientName.trim()}`,
      });

      await updateDoc(orderRef, {
        inventoryAllocated: true,
        inventoryAllocationSourceId: orderRef.id,
        inventoryRestored: false,
        needsReview: payload.reviewReasons.length > 0,
        updatedAt: serverTimestamp(),
      });

      setShowCreateModal(false);
      resetCreateForm();
      setLastCursor(null);
      await loadOrders("refresh");
      toast.success("Order created and inventory allocated.");
    } catch (error: unknown) {
      console.error("CREATE ORDER ERROR:", error);
      setCreateError(
        error instanceof Error ? error.message : "Failed to create order."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEditOrder() {
    if (!editingOrderId) {
      setEditError("No order selected.");
      return;
    }

    const validationError = validateOrderForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    try {
      setEditing(true);
      setEditError("");

      const payload = buildSmartOrderPayload(editForm);

      await updateDoc(doc(db, "orders", editingOrderId), {
        ...payload,
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      setOrders((prev) =>
        prev.map((order) =>
          order.id === editingOrderId
            ? normalizeOrder(order.id, {
                ...order,
                ...payload,
                updatedAt: new Date(),
              })
            : order
        )
      );

      setShowEditModal(false);
      resetEditForm();
      toast.success("Order updated.");
    } catch (error: unknown) {
      console.error("UPDATE ORDER ERROR:", error);
      setEditError("Failed to update order.");
    } finally {
      setEditing(false);
    }
  }

  async function handleDetectImportFile(file: File | null) {
    if (!file) {
      setDetectedImport(null);
      return;
    }

    const detection = await detectReportTypeFromFile(file);
    setDetectedImport(detection);
    setImportType(detection.reportType);
  }

  async function handleImportFile(file: File | null) {
    if (!file || importing) return;

    try {
      setImporting(true);
      setImportMessage("Detecting report type.");

      const detection = detectedImport ?? (await detectReportTypeFromFile(file));
      const resolvedImportType = detection.reportType;

      setImportType(resolvedImportType);
      setDetectedImport(detection);

      setImportMessage("Checking for duplicate upload.");

      const duplicateKey = makeDuplicateImportKey(file, resolvedImportType);
      const duplicate = await findRecentDuplicateImport(duplicateKey);

      if (
        duplicate &&
        duplicate.status !== "failed" &&
        duplicate.status !== "empty"
      ) {
        toast.error(
          `Possible duplicate: ${duplicate.fileName} was already uploaded.`
        );
        setImportMessage("");
        return;
      }

      setImportMessage("Uploading raw file to Firebase Storage.");

      const importJobRef = doc(collection(db, "importJobs"));
      const importId = importJobRef.id;

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const storagePath = `reports/uploads/${resolvedImportType}/${importId}/${safeFileName}`;
      const storageRef = ref(storage, storagePath);

      await setDocSafe(importJobRef, {
        reportType: resolvedImportType,
        detectedReportType: detection.reportType,
        detectionConfidence: detection.confidence,
        detectionReasons: detection.reasons,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        storagePath,
        duplicateKey,
        status: "uploaded",
        rowCount: 0,
        skippedHospiceRows: 0,
        duplicateRows: 0,
        missingDobRows: 0,
        missingAddressRows: 0,
        missingProductRows: 0,
        needsReviewRows: 0,
        errorMessage: "",
        smartRoutingEnabled: true,
        expectedRouteTargets: [
          "orders",
          "patients",
          "hospicePatients",
          "insurancePatients",
          "analytics",
          "review",
        ],
        createdBy: getCurrentUserLabel(),
        createdByUid: auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          importId,
          reportType: resolvedImportType,
          detectedReportType: detection.reportType,
          detectionConfidence: String(detection.confidence),
          duplicateKey,
          originalName: file.name,
          smartRoutingEnabled: "true",
          createdByUid: auth.currentUser?.uid ?? "",
        },
      });

      setImportMessage("");
      toast.success("File uploaded. Smart import job created.");
    } catch (error: unknown) {
      console.error("IMPORT UPLOAD ERROR:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload report."
      );
      setImportMessage("");
    } finally {
      setImporting(false);
      setDetectedImport(null);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function applyLocalStatusUpdate(orderId: string, status: OrderStatus) {
    const now = new Date();

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? normalizeOrder(order.id, {
              ...order,
              status,
              updatedAt: now,
            })
          : order
      )
    );
  }

  function revertLocalOrder(previousOrders: OrderRow[]) {
    setOrders(previousOrders);
  }

  async function handleUpdateStatus(orderId: string, status: OrderStatus) {
    const previousOrders = orders;
    const currentOrder = orders.find((order) => order.id === orderId);

    try {
      setSavingId(orderId);
      applyLocalStatusUpdate(orderId, status);

      const nextOrder = currentOrder
        ? normalizeOrder(orderId, { ...currentOrder, status })
        : null;

      await updateDoc(doc(db, "orders", orderId), {
        status,
        needsReview: nextOrder?.needsReview ?? false,
        reviewReasons: nextOrder?.reviewReasons ?? [],
        smartRouteTargets: nextOrder?.smartRouteTargets ?? [],
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      if (
        currentOrder &&
        status === "cancelled" &&
        currentOrder.productId &&
        currentOrder.inventoryAllocated === true &&
        currentOrder.inventoryRestored !== true
      ) {
        await restoreInventoryFromOrder({
          productId: currentOrder.productId,
          quantity: currentOrder.quantity,
          sourceId: orderId,
          notes: `Order cancelled for ${currentOrder.patientName}`,
        });

        await updateDoc(doc(db, "orders", orderId), {
          inventoryRestored: true,
          updatedAt: serverTimestamp(),
        });
      }

      if (tab !== "all" && tab !== status) {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success(`Order marked ${status}.`);
    } catch (error: unknown) {
      console.error("UPDATE ORDER STATUS ERROR:", error);
      revertLocalOrder(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to update order status."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleArchiveOrder(orderId: string) {
    const previousOrders = orders;

    try {
      setSavingId(orderId);
      applyLocalStatusUpdate(orderId, "archived");

      await updateDoc(doc(db, "orders", orderId), {
        status: "archived",
        needsReview: false,
        reviewReasons: ["archived"],
        archivedAt: serverTimestamp(),
        archivedBy: getCurrentUserLabel(),
        archivedByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      if (tab !== "all" && tab !== "archived") {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success("Order archived.");
    } catch (error: unknown) {
      console.error("ARCHIVE ORDER ERROR:", error);
      revertLocalOrder(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to archive order."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleRestoreOrder(orderId: string) {
    const previousOrders = orders;
    const currentOrder = orders.find((order) => order.id === orderId);

    try {
      setSavingId(orderId);
      applyLocalStatusUpdate(orderId, "processing");

      if (currentOrder?.productId && currentOrder.inventoryAllocated !== true) {
        await allocateInventoryToOrder({
          productId: currentOrder.productId,
          quantity: currentOrder.quantity,
          sourceId: orderId,
          notes: `Order restored for ${currentOrder.patientName}`,
        });
      }

      const nextOrder = currentOrder
        ? normalizeOrder(orderId, {
            ...currentOrder,
            status: "processing",
            inventoryAllocated: true,
            inventoryRestored: false,
          })
        : null;

      await updateDoc(doc(db, "orders", orderId), {
        status: "processing",
        inventoryAllocated: true,
        inventoryAllocationSourceId: orderId,
        inventoryRestored: false,
        needsReview: nextOrder?.needsReview ?? false,
        reviewReasons: nextOrder?.reviewReasons ?? [],
        smartRouteTargets: nextOrder?.smartRouteTargets ?? [],
        restoredAt: serverTimestamp(),
        restoredBy: getCurrentUserLabel(),
        restoredByUid: auth.currentUser?.uid ?? "",
        updatedBy: getCurrentUserLabel(),
        updatedByUid: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      });

      if (tab !== "all" && tab !== "processing") {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      }

      toast.success("Order restored.");
    } catch (error: unknown) {
      console.error("RESTORE ORDER ERROR:", error);
      revertLocalOrder(previousOrders);
      toast.error(
        error instanceof Error ? error.message : "Failed to restore order."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
            Smart Intake Enabled
          </div>

          <h1 className="mt-3 text-2xl font-bold text-white">Orders</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track patient orders, imported report orders, inventory allocation,
            smart review flags, and delivery progress.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Showing {orders.length.toLocaleString()} loaded order
            {orders.length === 1 ? "" : "s"} for the selected tab.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <label className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden={true}
            />
            <span className="sr-only">Search orders</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient, product, sales order, phone..."
              className="w-full rounded-xl border border-white/10 bg-[#0b1220] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-500/40"
            />
          </label>

          <button
            type="button"
            onClick={() => void loadOrders("refresh")}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCcw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden={true}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15"
          >
            <Plus className="h-4 w-4" aria-hidden={true} />
            Create Order
          </button>
        </div>
      </div>

      <SmartCommandStrip
        needsReview={summary.needsReview}
        inventoryIssues={summary.inventoryIssues}
        hospiceRisks={summary.hospiceRisks}
        missingProduct={summary.missingProduct}
        archiveReady={summary.archiveReady}
        onReviewOnly={() =>
          setSmartFilters((prev) => ({ ...prev, reviewOnly: true }))
        }
        onInventoryOnly={() =>
          setSmartFilters((prev) => ({ ...prev, inventoryOnly: true }))
        }
        onHospiceOnly={() =>
          setSmartFilters((prev) => ({ ...prev, hospiceRiskOnly: true }))
        }
        onMissingProductOnly={() =>
          setSmartFilters((prev) => ({ ...prev, missingProductOnly: true }))
        }
        onArchiveReadyOnly={() =>
          setSmartFilters((prev) => ({ ...prev, archiveReadyOnly: true }))
        }
      />

      <ImportPanel
        importType={importType}
        detectedImport={detectedImport}
        importing={importing}
        importMessage={importMessage}
        importInputRef={importInputRef}
        onImportTypeChange={(value) => {
          setImportType(value);
          setDetectedImport(null);
        }}
        onDetectFile={(file) => void handleDetectImportFile(file)}
        onImportFile={handleImportFile}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Processing" value={summary.processing} />
        <SummaryCard label="Ready" value={summary.ready} />
        <SummaryCard label="Delivered" value={summary.delivered} />
        <SummaryCard label="Cancelled" value={summary.cancelled} />
        <SummaryCard label="Archived" value={summary.archived} />
      </div>

      <SmartFiltersPanel
        filters={smartFilters}
        options={filterOptions}
        resultCount={filteredOrders.length}
        onChange={setSmartFilters}
        onReset={() => setSmartFilters(initialSmartFilters)}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const active = tab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(item.key)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                  : "border-white/10 bg-[#0b1220] text-zinc-300 hover:bg-white/5"
              }`}
            >
              {item.label} ({item.count ?? 0})
            </button>
          );
        })}
      </div>

      <OrdersTable
        loading={loading}
        orders={filteredOrders}
        savingId={savingId}
        onEdit={openEditModal}
        onUpdateStatus={handleUpdateStatus}
        onArchive={handleArchiveOrder}
        onRestore={handleRestoreOrder}
      />

      {!loading && hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadOrders("more")}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      ) : null}

      {showCreateModal ? (
        <OrderModal
          title="Create Order"
          description="Add a new order, build smart keys, and allocate inventory."
          form={form}
          busy={creating}
          error={createError}
          mode="create"
          onClose={closeCreateModal}
          onChange={handleCreateChange}
          onSave={() => void handleCreateOrder()}
          onScan={() => setScannerOpen(true)}
          onLoadBarcode={() =>
            void fillProductFromBarcode(form.barcode, "create")
          }
        />
      ) : null}

      {showEditModal ? (
        <OrderModal
          title="Edit Order"
          description="Update order details and rebuild smart handoff fields."
          form={editForm}
          busy={editing}
          error={editError}
          mode="edit"
          onClose={closeEditModal}
          onChange={handleEditChange}
          onSave={() => void handleSaveEditOrder()}
          onScan={undefined}
          onLoadBarcode={() =>
            void fillProductFromBarcode(editForm.barcode, "edit")
          }
        />
      ) : null}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          const clean = normalizeBarcode(code);
          handleCreateChange("barcode", clean);
          void fillProductFromBarcode(clean, "create");
          setScannerOpen(false);
        }}
        title="Scan Order Inventory Barcode"
      />
    </div>
  );
}

function SmartCommandStrip({
  needsReview,
  inventoryIssues,
  hospiceRisks,
  missingProduct,
  archiveReady,
  onReviewOnly,
  onInventoryOnly,
  onHospiceOnly,
  onMissingProductOnly,
  onArchiveReadyOnly,
}: {
  needsReview: number;
  inventoryIssues: number;
  hospiceRisks: number;
  missingProduct: number;
  archiveReady: number;
  onReviewOnly: () => void;
  onInventoryOnly: () => void;
  onHospiceOnly: () => void;
  onMissingProductOnly: () => void;
  onArchiveReadyOnly: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldAlert className="h-5 w-5 text-cyan-300" aria-hidden={true} />
            Smart Review Queue
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Fast filters for bad data, missing inventory links, hospice leakage,
            and archive cleanup.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SmartQueueButton
            label="Needs Review"
            value={needsReview}
            onClick={onReviewOnly}
          />
          <SmartQueueButton
            label="Inventory Issues"
            value={inventoryIssues}
            onClick={onInventoryOnly}
          />
          <SmartQueueButton
            label="Hospice Risk"
            value={hospiceRisks}
            onClick={onHospiceOnly}
          />
          <SmartQueueButton
            label="Missing Product"
            value={missingProduct}
            onClick={onMissingProductOnly}
          />
          <SmartQueueButton
            label="Archive Ready"
            value={archiveReady}
            onClick={onArchiveReadyOnly}
          />
        </div>
      </div>
    </section>
  );
}

function SmartQueueButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:bg-white/5"
    >
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">
        {value.toLocaleString()}
      </div>
    </button>
  );
}

function ImportPanel({
  importType,
  detectedImport,
  importing,
  importMessage,
  importInputRef,
  onImportTypeChange,
  onDetectFile,
  onImportFile,
}: {
  importType: ImportReportType;
  detectedImport: SmartDetectionResult | null;
  importing: boolean;
  importMessage: string;
  importInputRef: RefObject<HTMLInputElement | null>;
  onImportTypeChange: (value: ImportReportType) => void;
  onDetectFile: (file: File | null) => void;
  onImportFile: (file: File | null) => void;
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Smart Import Orders From Report
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload CSV/PDF reports. This creates an import job for Cloud
            Functions without displaying uploaded file history on this page.
          </p>

          {detectedImport ? (
            <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-200">
              <div className="font-medium">
                Detected: {getReportTypeLabel(detectedImport.reportType)}{" "}
                <span className="text-cyan-400">
                  ({Math.round(detectedImport.confidence * 100)}%)
                </span>
              </div>
              <ul className="mt-1 list-inside list-disc text-xs text-cyan-300/80">
                {detectedImport.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {importMessage ? (
            <p className="mt-2 text-sm text-cyan-300">{importMessage}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label
              htmlFor="orders-report-type"
              className="mb-2 block text-xs font-medium text-zinc-400"
            >
              Report type
            </label>
            <select
              id="orders-report-type"
              value={importType}
              onChange={(event) =>
                onImportTypeChange(event.target.value as ImportReportType)
              }
              disabled={importing}
              className="w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none disabled:opacity-50"
            >
              <option value="deliveryTickets">Delivery Tickets PDF</option>
              <option value="outstandingSalesOrders">
                Outstanding Sales Orders CSV
              </option>
              <option value="billingReview">Billing Review CSV</option>
              <option value="genericOrders">Generic Orders CSV</option>
            </select>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPendingFile(file);
              onDetectFile(file);
            }}
            className="hidden"
            aria-label="Upload order report file"
          />

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <FileSearch className="h-4 w-4" aria-hidden={true} />
            Choose File
          </button>

          <button
            type="button"
            onClick={() => onImportFile(pendingFile)}
            disabled={importing || !pendingFile}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
          >
            <FileUp className="h-4 w-4" aria-hidden={true} />
            {importing ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmartFiltersPanel({
  filters,
  options,
  resultCount,
  onChange,
  onReset,
}: {
  filters: SmartFilters;
  options: {
    reportTypes: string[];
    facilities: string[];
    insurances: string[];
  };
  resultCount: number;
  onChange: (filters: SmartFilters) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <Filter className="h-5 w-5 text-zinc-400" aria-hidden={true} />
            Adaptive Filters
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"}{" "}
            after filters.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" aria-hidden={true} />
          Reset Filters
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <FilterSelect
          id="filter-report-type"
          label="Source report"
          value={filters.sourceReportType}
          options={options.reportTypes}
          formatLabel={getReportTypeLabel}
          onChange={(value) =>
            onChange({ ...filters, sourceReportType: value })
          }
        />

        <FilterSelect
          id="filter-facility"
          label="Facility"
          value={filters.facilityName}
          options={options.facilities}
          onChange={(value) => onChange({ ...filters, facilityName: value })}
        />

        <FilterSelect
          id="filter-insurance"
          label="Insurance"
          value={filters.insurance}
          options={options.insurances}
          onChange={(value) => onChange({ ...filters, insurance: value })}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ToggleFilter
          label="Needs Review"
          active={filters.reviewOnly}
          onClick={() =>
            onChange({ ...filters, reviewOnly: !filters.reviewOnly })
          }
        />
        <ToggleFilter
          label="Inventory Issues"
          active={filters.inventoryOnly}
          onClick={() =>
            onChange({ ...filters, inventoryOnly: !filters.inventoryOnly })
          }
        />
        <ToggleFilter
          label="Hospice Risk"
          active={filters.hospiceRiskOnly}
          onClick={() =>
            onChange({ ...filters, hospiceRiskOnly: !filters.hospiceRiskOnly })
          }
        />
        <ToggleFilter
          label="Missing Product"
          active={filters.missingProductOnly}
          onClick={() =>
            onChange({
              ...filters,
              missingProductOnly: !filters.missingProductOnly,
            })
          }
        />
        <ToggleFilter
          label="Archive Ready"
          active={filters.archiveReadyOnly}
          onClick={() =>
            onChange({
              ...filters,
              archiveReadyOnly: !filters.archiveReadyOnly,
            })
          }
        />
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  formatLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  formatLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-zinc-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel ? formatLabel(option) : option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleFilter({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
          : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function OrdersTable({
  loading,
  orders,
  savingId,
  onEdit,
  onUpdateStatus,
  onArchive,
  onRestore,
}: {
  loading: boolean;
  orders: OrderRow[];
  savingId: string | null;
  onEdit: (order: OrderRow) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onArchive: (orderId: string) => Promise<void>;
  onRestore: (orderId: string) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Orders table</caption>

          <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Smart Review</th>
              <th className="px-4 py-3 font-medium">Sales Order</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Inventory</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-zinc-400">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-zinc-400">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isSaving = savingId === order.id;

                return (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 align-top last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                          <User className="h-4 w-4" aria-hidden={true} />
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {order.patientName || "Unnamed patient"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            DOB: {order.dob || "—"}
                          </div>
                          {order.facilityName ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              {order.facilityName}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <SmartReviewBadges order={order} />
                    </td>

                    <td className="px-4 py-4 text-zinc-300">
                      {order.salesOrderNumber || "—"}
                    </td>

                    <td className="max-w-xs px-4 py-4 text-zinc-300">
                      {order.patientAddress || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <Package className="mt-0.5 h-4 w-4 text-zinc-500" />
                        <div>
                          <div className="text-zinc-200">
                            {order.productType || "—"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            Barcode: {order.barcode || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-zinc-300">{order.quantity}</td>
                    <td className="px-4 py-4 text-zinc-300">
                      {formatCurrency(order.purchaseCost)}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      {order.phone || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-4 py-4">
                      <InventoryBadge order={order} />
                    </td>

                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {!isArchivedStatus(order.status) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(order)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              <Pencil className="h-4 w-4" aria-hidden={true} />
                              Edit
                            </button>

                            {order.status !== "ready" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void onUpdateStatus(order.id, "ready")
                                }
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                              >
                                <CheckCircle2
                                  className="h-4 w-4"
                                  aria-hidden={true}
                                />
                                Ready
                              </button>
                            ) : null}

                            {order.status !== "delivered" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void onUpdateStatus(order.id, "delivered")
                                }
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                              >
                                Delivered
                              </button>
                            ) : null}

                            {order.status !== "cancelled" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void onUpdateStatus(order.id, "cancelled")
                                }
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                              >
                                <Ban className="h-4 w-4" aria-hidden={true} />
                                Cancel
                              </button>
                            ) : null}

                            {order.status === "delivered" ||
                            order.status === "cancelled" ? (
                              <button
                                type="button"
                                onClick={() => void onArchive(order.id)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 rounded-xl border border-zinc-500/20 bg-zinc-500/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-500/15 disabled:opacity-50"
                              >
                                <Archive className="h-4 w-4" aria-hidden={true} />
                                Archive
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void onRestore(order.id)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                          >
                            <Undo2 className="h-4 w-4" aria-hidden={true} />
                            Restore
                          </button>
                        )}
                      </div>

                      {isSaving ? (
                        <div className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-500">
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden={true}
                          />
                          Saving.
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    processing: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    ready: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    delivered: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    cancelled: "border-red-500/20 bg-red-500/10 text-red-300",
    archived: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function SmartReviewBadges({ order }: { order: OrderRow }) {
  const reasons = order.reviewReasons || [];

  if (!reasons.length && !order.needsReview) {
    return (
      <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        Clean
      </span>
    );
  }

  return (
    <div className="flex max-w-xs flex-wrap gap-1.5">
      {reasons.slice(0, 4).map((reason) => (
        <span
          key={reason}
          className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden={true} />
          {getReviewReasonLabel(reason)}
        </span>
      ))}

      {reasons.length > 4 ? (
        <span className="rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-1 text-xs text-zinc-300">
          +{reasons.length - 4}
        </span>
      ) : null}
    </div>
  );
}

function InventoryBadge({ order }: { order: OrderRow }) {
  if (order.inventoryRestored) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
        Restored
      </span>
    );
  }

  if (order.inventoryAllocated) {
    return (
      <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        Allocated
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-zinc-500/20 bg-zinc-500/10 px-3 py-1 text-xs font-medium text-zinc-300">
      Not allocated
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function OrderModal({
  title,
  description,
  form,
  busy,
  error,
  mode,
  onClose,
  onChange,
  onSave,
  onScan,
  onLoadBarcode,
}: {
  title: string;
  description: string;
  form: OrderFormState;
  busy: boolean;
  error: string;
  mode: "create" | "edit";
  onClose: () => void;
  onChange: (field: keyof OrderFormState, value: string) => void;
  onSave: () => void;
  onScan?: () => void;
  onLoadBarcode: () => void;
}) {
  const prefix = `${mode}-order`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Close order modal"
          >
            <X className="h-4 w-4" aria-hidden={true} />
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            id={`${prefix}-patient-name`}
            label="Patient name"
            value={form.patientName}
            onChange={(value) => onChange("patientName", value)}
            required
          />

          <TextField
            id={`${prefix}-phone`}
            label="Phone"
            value={form.phone}
            onChange={(value) => onChange("phone", value)}
          />

          <TextField
            id={`${prefix}-address`}
            label="Patient address"
            value={form.patientAddress}
            onChange={(value) => onChange("patientAddress", value)}
            required
          />

          <TextField
            id={`${prefix}-facility`}
            label="Facility"
            value={form.facilityName}
            onChange={(value) => onChange("facilityName", value)}
          />

          <TextField
            id={`${prefix}-barcode`}
            label="Barcode"
            value={form.barcode}
            onChange={(value) => onChange("barcode", value)}
          />

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={onLoadBarcode}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
            >
              <Package className="h-4 w-4" aria-hidden={true} />
              Load Item
            </button>

            {onScan ? (
              <button
                type="button"
                onClick={onScan}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                <ScanLine className="h-4 w-4" aria-hidden={true} />
                <span className="sr-only">Scan barcode</span>
              </button>
            ) : null}
          </div>

          <TextField
            id={`${prefix}-product-id`}
            label="Product ID"
            value={form.productId}
            onChange={(value) => onChange("productId", value)}
            required
          />

          <TextField
            id={`${prefix}-product-type`}
            label="Product type"
            value={form.productType}
            onChange={(value) => onChange("productType", value)}
            required
          />

          <TextField
            id={`${prefix}-cost`}
            label="Purchase cost"
            value={form.purchaseCost}
            onChange={(value) => onChange("purchaseCost", value)}
            inputMode="decimal"
            required
          />

          <TextField
            id={`${prefix}-quantity`}
            label="Quantity"
            value={form.quantity}
            onChange={(value) => onChange("quantity", value)}
            inputMode="numeric"
            required
          />

          <div>
            <label
              htmlFor={`${prefix}-status`}
              className="mb-2 block text-xs font-medium text-zinc-400"
            >
              Status
            </label>
            <select
              id={`${prefix}-status`}
              value={form.status}
              onChange={(event) =>
                onChange("status", event.target.value as OrderStatus)
              }
              className="w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40"
            >
              <option value="processing">Processing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor={`${prefix}-notes`}
            className="mb-2 block text-xs font-medium text-zinc-400"
          >
            Notes
          </label>
          <textarea
            id={`${prefix}-notes`}
            value={form.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-500/40"
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} />
            ) : null}
            {busy ? "Saving..." : "Save Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  required,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search";
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-zinc-400">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-500/40"
      />
    </div>
  );
}