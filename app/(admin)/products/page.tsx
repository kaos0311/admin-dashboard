"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Database,
  Filter,
  ImageIcon,
  Loader2,
  Package2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import BarcodeScannerModal from "@/app/components/barcode/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";

type ProductStatus = "active" | "inactive" | "discontinued";

type ProductType =
  | "resale"
  | "rental"
  | "consumable"
  | "serialized"
  | "service"
  | "oxygen"
  | "cpap"
  | "other";

type SortMode =
  | "name-asc"
  | "name-desc"
  | "price-desc"
  | "price-asc"
  | "missing-info"
  | "risk-desc";

type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  productType: ProductType;
  manufacturer: string;
  manufacturerItemId: string;
  primaryVendor: string;
  secondaryVendor: string;
  sku: string;
  upc: string;
  hcpcs: string;
  ndc: string;
  basePrice: number;
  defaultPurchasePrice: number;
  defaultRentalRate: number;
  unitOfMeasure: string;
  reorderLevel: number;
  warrantyMonths: number;
  weight: string;
  dimensions: string;
  imageUrl: string;
  thumbnailUrl: string;
  status: ProductStatus;
  isRentalItem: boolean;
  isSerialized: boolean;
  requiresPrescription: boolean;
  requiresSerialTracking: boolean;
  lotTracking: boolean;
  expirationTracking: boolean;
  recallFlagged: boolean;
  notes: string;
  deleted: boolean;
};

type ProductForm = Omit<
  Product,
  | "basePrice"
  | "defaultPurchasePrice"
  | "defaultRentalRate"
  | "reorderLevel"
  | "warrantyMonths"
  | "deleted"
> & {
  basePrice: string;
  defaultPurchasePrice: string;
  defaultRentalRate: string;
  reorderLevel: string;
  warrantyMonths: string;
};

const PAGE_SIZE = 75;
const BATCH_SIZE = 400;

const initialForm: ProductForm = {
  id: "",
  name: "",
  brand: "",
  model: "",
  category: "",
  productType: "resale",
  manufacturer: "",
  manufacturerItemId: "",
  primaryVendor: "",
  secondaryVendor: "",
  sku: "",
  upc: "",
  hcpcs: "",
  ndc: "",
  basePrice: "",
  defaultPurchasePrice: "",
  defaultRentalRate: "",
  unitOfMeasure: "each",
  reorderLevel: "",
  warrantyMonths: "",
  weight: "",
  dimensions: "",
  imageUrl: "",
  thumbnailUrl: "",
  status: "active",
  isRentalItem: false,
  isSerialized: false,
  requiresPrescription: false,
  requiresSerialTracking: false,
  lotTracking: false,
  expirationTracking: false,
  recallFlagged: false,
  notes: "",
};

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeNumber(value: unknown): number {
  if (value === "" || value == null) return 0;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildSearchKeywords(values: string[]): string[] {
  const words = values
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  return Array.from(new Set(words)).slice(0, 100);
}

function normalizeStatus(value: unknown): ProductStatus {
  if (value === "inactive") return "inactive";
  if (value === "discontinued") return "discontinued";
  return "active";
}

function normalizeType(value: unknown): ProductType {
  const allowed: ProductType[] = [
    "resale",
    "rental",
    "consumable",
    "serialized",
    "service",
    "oxygen",
    "cpap",
    "other",
  ];

  return allowed.includes(value as ProductType) ? (value as ProductType) : "resale";
}

function normalizeProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    name: toSafeString(data.name),
    brand: toSafeString(data.brand),
    model: toSafeString(data.model),
    category: toSafeString(data.category),
    productType: normalizeType(data.productType),
    manufacturer: toSafeString(data.manufacturer),
    manufacturerItemId: toSafeString(data.manufacturerItemId),
    primaryVendor: toSafeString(data.primaryVendor),
    secondaryVendor: toSafeString(data.secondaryVendor),
    sku: toSafeString(data.sku),
    upc: toSafeString(data.upc),
    hcpcs: toSafeString(data.hcpcs),
    ndc: toSafeString(data.ndc),
    basePrice: toSafeNumber(data.basePrice),
    defaultPurchasePrice: toSafeNumber(data.defaultPurchasePrice),
    defaultRentalRate: toSafeNumber(data.defaultRentalRate),
    unitOfMeasure: toSafeString(data.unitOfMeasure) || "each",
    reorderLevel: toSafeNumber(data.reorderLevel),
    warrantyMonths: toSafeNumber(data.warrantyMonths),
    weight: toSafeString(data.weight),
    dimensions: toSafeString(data.dimensions),
    imageUrl: toSafeString(data.imageUrl),
    thumbnailUrl: toSafeString(data.thumbnailUrl),
    status: normalizeStatus(data.status),
    isRentalItem: Boolean(data.isRentalItem),
    isSerialized: Boolean(data.isSerialized),
    requiresPrescription: Boolean(data.requiresPrescription),
    requiresSerialTracking: Boolean(data.requiresSerialTracking),
    lotTracking: Boolean(data.lotTracking),
    expirationTracking: Boolean(data.expirationTracking),
    recallFlagged: Boolean(data.recallFlagged),
    notes: toSafeString(data.notes),
    deleted: Boolean(data.deleted),
  };
}

function productRiskScore(product: Product): number {
  let score = 0;

  if (!product.name) score += 25;
  if (!product.category) score += 20;
  if (!product.hcpcs) score += 15;
  if (!product.sku && !product.upc && !product.manufacturerItemId) score += 15;
  if (product.recallFlagged) score += 30;
  if (product.requiresSerialTracking && !product.isSerialized) score += 20;
  if (product.productType === "rental" && product.defaultRentalRate <= 0) score += 10;
  if (product.basePrice <= 0 && product.productType !== "service") score += 10;

  return Math.min(score, 100);
}

function qualityWarnings(product: Product): string[] {
  const warnings: string[] = [];

  if (!product.category) warnings.push("Missing category");
  if (!product.hcpcs) warnings.push("Missing HCPCS");
  if (!product.sku && !product.upc && !product.manufacturerItemId) {
    warnings.push("Missing item identifier");
  }
  if (product.recallFlagged) warnings.push("Recall flagged");
  if (product.requiresSerialTracking && !product.isSerialized) {
    warnings.push("Serial tracking mismatch");
  }
  if (product.productType === "rental" && product.defaultRentalRate <= 0) {
    warnings.push("Missing rental rate");
  }

  return warnings;
}

function uniqueOptions(products: Product[], key: keyof Product): string[] {
  return Array.from(
    new Set(
      products
        .map((product) => product[key])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export default function ProductsPage() {
  const { loading: authLoading, isAdmin, isStaff, user } = useAuthRole();

  const mountedRef = useRef(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState<ProductForm>(initialForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [purging, setPurging] = useState(false);

  const canRead = isAdmin || isStaff;
  const canWrite = isAdmin || isStaff;

  const loadProducts = useCallback(
    async (mode: "reset" | "more" = "reset") => {
      if (!canRead) {
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      if (mode === "reset") {
        setLoadingProducts(true);
        setLastDoc(null);
        setHasMore(true);
      } else {
        if (!lastDoc || !hasMore) return;
        setLoadingMore(true);
      }

      try {
        const productsQuery =
          mode === "more" && lastDoc
            ? query(
                collection(db, "products"),
                orderBy("name", "asc"),
                startAfter(lastDoc),
                limit(PAGE_SIZE)
              )
            : query(collection(db, "products"), orderBy("name", "asc"), limit(PAGE_SIZE));

        const snapshot = await getDocs(productsQuery);

        const rows = snapshot.docs
          .map((docSnap) =>
            normalizeProduct(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
          .filter((product) => !product.deleted);

        if (!mountedRef.current) return;

        setProducts((current) => {
          const next = mode === "more" ? [...current, ...rows] : rows;

          setSelectedIds((selected) =>
            selected.filter((id) => next.some((product) => product.id === id))
          );

          return next;
        });

        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (error) {
        console.error("LOAD PRODUCTS ERROR:", error);
        toast.error("Products could not be loaded. Check Firestore rules/indexes.");
      } finally {
        if (mountedRef.current) {
          setLoadingProducts(false);
          setLoadingMore(false);
        }
      }
    },
    [canRead, hasMore, lastDoc]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!canRead) {
      setProducts([]);
      setLoadingProducts(false);
      toast.error("You do not have permission to view products.");
      return;
    }

    void loadProducts("reset");
  }, [authLoading, canRead, loadProducts]);

  const categories = useMemo(() => uniqueOptions(products, "category"), [products]);
  const manufacturers = useMemo(
    () => uniqueOptions(products, "manufacturer"),
    [products]
  );

  const vendors = useMemo(() => {
    return Array.from(
      new Set(
        products
          .flatMap((product) => [product.primaryVendor, product.secondaryVendor])
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = normalizeSearchText(search);

    const filtered = products.filter((product) => {
      const warnings = qualityWarnings(product);

      const haystack = normalizeSearchText(
        [
          product.name,
          product.brand,
          product.model,
          product.category,
          product.productType,
          product.manufacturer,
          product.manufacturerItemId,
          product.primaryVendor,
          product.secondaryVendor,
          product.sku,
          product.upc,
          product.hcpcs,
          product.ndc,
          product.status,
          product.notes,
        ].join(" ")
      );

      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus = statusFilter === "all" || product.status === statusFilter;
      const matchesType = typeFilter === "all" || product.productType === typeFilter;
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;
      const matchesManufacturer =
        manufacturerFilter === "all" || product.manufacturer === manufacturerFilter;
      const matchesVendor =
        vendorFilter === "all" ||
        product.primaryVendor === vendorFilter ||
        product.secondaryVendor === vendorFilter;

      const matchesIssue =
        issueFilter === "all" ||
        (issueFilter === "recall" && product.recallFlagged) ||
        (issueFilter === "missing-info" && warnings.length > 0) ||
        (issueFilter === "serialized" && product.isSerialized) ||
        (issueFilter === "rental" && product.isRentalItem) ||
        (issueFilter === "rx" && product.requiresPrescription);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesCategory &&
        matchesManufacturer &&
        matchesVendor &&
        matchesIssue
      );
    });

    return filtered.sort((a, b) => {
      if (sortMode === "name-desc") return b.name.localeCompare(a.name);
      if (sortMode === "price-desc") return b.basePrice - a.basePrice;
      if (sortMode === "price-asc") return a.basePrice - b.basePrice;
      if (sortMode === "missing-info") {
        return qualityWarnings(b).length - qualityWarnings(a).length;
      }
      if (sortMode === "risk-desc") return productRiskScore(b) - productRiskScore(a);

      return a.name.localeCompare(b.name);
    });
  }, [
    products,
    search,
    statusFilter,
    typeFilter,
    categoryFilter,
    manufacturerFilter,
    vendorFilter,
    issueFilter,
    sortMode,
  ]);

  const stats = useMemo(() => {
    const missingInfo = products.filter((product) => qualityWarnings(product).length > 0);
    const highRisk = products.filter((product) => productRiskScore(product) >= 50);

    return {
      total: products.length,
      active: products.filter((p) => p.status === "active").length,
      inactive: products.filter((p) => p.status === "inactive").length,
      discontinued: products.filter((p) => p.status === "discontinued").length,
      rental: products.filter((p) => p.isRentalItem).length,
      serialized: products.filter((p) => p.isSerialized).length,
      recall: products.filter((p) => p.recallFlagged).length,
      missingInfo: missingInfo.length,
      highRisk: highRisk.length,
    };
  }, [products]);

  const formWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (!form.name.trim()) warnings.push("Product name is required.");
    if (!form.category.trim()) warnings.push("Category is required.");
    if (!form.hcpcs.trim()) warnings.push("HCPCS is missing.");
    if (!form.sku.trim() && !form.upc.trim() && !form.manufacturerItemId.trim()) {
      warnings.push("At least one item identifier is recommended.");
    }
    if (form.productType === "rental" && toSafeNumber(form.defaultRentalRate) <= 0) {
      warnings.push("Rental items should have a default rental rate.");
    }
    if (form.requiresSerialTracking && !form.isSerialized) {
      warnings.push("Serial tracking requires Serialized item enabled.");
    }

    return warnings;
  }, [form]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedIds.includes(product.id));

  function resetForm() {
    setForm(initialForm);
    setShowAdvanced(false);
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCategoryFilter("all");
    setManufacturerFilter("all");
    setVendorFilter("all");
    setIssueFilter("all");
    setSortMode("name-asc");
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  }

  function toggleSelectVisible() {
    const visibleIds = filteredProducts.map((product) => product.id);

    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function handleEdit(product: Product) {
    setForm({
      ...product,
      basePrice: product.basePrice ? String(product.basePrice) : "",
      defaultPurchasePrice: product.defaultPurchasePrice
        ? String(product.defaultPurchasePrice)
        : "",
      defaultRentalRate: product.defaultRentalRate
        ? String(product.defaultRentalRate)
        : "",
      reorderLevel: product.reorderLevel ? String(product.reorderLevel) : "",
      warrantyMonths: product.warrantyMonths ? String(product.warrantyMonths) : "",
    });

    setShowAdvanced(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function writeAuditLog(args: {
    action: "create" | "update" | "soft-delete" | "bulk-soft-delete" | "purge";
    entityId?: string;
    before?: unknown;
    after?: unknown;
    count?: number;
  }) {
    try {
      await addDoc(collection(db, "auditLogs"), {
        entityType: "product",
        action: args.action,
        entityId: args.entityId ?? null,
        count: args.count ?? null,
        before: args.before ?? null,
        after: args.after ?? null,
        userId: user?.uid ?? null,
        userEmail: user?.email ?? null,
        actorUid: user?.uid ?? null,
        actorEmail: user?.email ?? null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("AUDIT LOG WRITE FAILED:", error);
    }
  }

  async function handleSoftDelete(product: Product) {
    if (!canWrite) {
      toast.error("You do not have permission to delete products.");
      return;
    }

    const confirmed = window.confirm(
      `Archive "${product.name}" from the product catalog? Inventory history will stay intact.`
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "products", product.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user?.uid ?? null,
        deletedByEmail: user?.email ?? null,
        status: "discontinued",
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "soft-delete",
        entityId: product.id,
        before: product,
      });

      toast.success("Product archived.");
      setProducts((current) => current.filter((p) => p.id !== product.id));
      setSelectedIds((current) => current.filter((id) => id !== product.id));

      if (form.id === product.id) resetForm();
    } catch (error) {
      console.error("SOFT DELETE PRODUCT ERROR:", error);
      toast.error("Product could not be archived.");
    }
  }

  async function handleBatchSoftDelete() {
    if (!canWrite) {
      toast.error("You do not have permission to delete products.");
      return;
    }

    if (!selectedIds.length) {
      toast.error("Select products first.");
      return;
    }

    const confirmed = window.confirm(
      `Archive ${selectedIds.length} selected product(s)? Inventory history will stay intact.`
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = selectedIds.slice(i, i + BATCH_SIZE);

        chunk.forEach((id) => {
          batch.update(doc(db, "products", id), {
            deleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: user?.uid ?? null,
            deletedByEmail: user?.email ?? null,
            status: "discontinued",
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      await writeAuditLog({
        action: "bulk-soft-delete",
        count: selectedIds.length,
      });

      toast.success(`Archived ${selectedIds.length} product(s).`);

      setProducts((current) =>
        current.filter((product) => !selectedIds.includes(product.id))
      );

      if (form.id && selectedIds.includes(form.id)) resetForm();

      setSelectedIds([]);
    } catch (error) {
      console.error("BATCH SOFT DELETE PRODUCTS ERROR:", error);
      toast.error("Selected products could not be archived.");
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }

  async function handlePurgeVisibleProducts() {
    if (!isAdmin) {
      toast.error("Only admins can purge products.");
      return;
    }

    const confirmed = window.confirm(
      "Danger zone: permanently delete the currently loaded product records? Use this only for test resets."
    );

    if (!confirmed) return;

    const typed = window.prompt('Type "PURGE PRODUCTS" to confirm.');

    if (typed !== "PURGE PRODUCTS") {
      toast.error("Purge cancelled.");
      return;
    }

    setPurging(true);

    try {
      const ids = products.map((product) => product.id);

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + BATCH_SIZE);

        chunk.forEach((id) => {
          batch.delete(doc(db, "products", id));
        });

        await batch.commit();
      }

      await writeAuditLog({
        action: "purge",
        count: ids.length,
      });

      toast.success(`Purged ${ids.length} loaded product(s).`);
      setProducts([]);
      setSelectedIds([]);
      resetForm();
    } catch (error) {
      console.error("PURGE PRODUCTS ERROR:", error);
      toast.error("Products could not be purged.");
    } finally {
      if (mountedRef.current) setPurging(false);
    }
  }

  function handleScanDetected(code: string) {
    const clean = normalizeBarcode(code);
    setForm((prev) => ({ ...prev, upc: clean }));
    setSearch(clean);
    toast.success("UPC captured.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canWrite) {
      toast.error("You do not have permission to save products.");
      return;
    }

    const name = form.name.trim();
    const category = form.category.trim();
    const brand = form.brand.trim();
    const model = form.model.trim();
    const manufacturer = form.manufacturer.trim();
    const manufacturerItemId = form.manufacturerItemId.trim();
    const primaryVendor = form.primaryVendor.trim();
    const secondaryVendor = form.secondaryVendor.trim();
    const sku = form.sku.trim();
    const upc = form.upc.trim() ? normalizeBarcode(form.upc) : "";
    const hcpcs = form.hcpcs.trim().toUpperCase();
    const ndc = form.ndc.trim();
    const unitOfMeasure = form.unitOfMeasure.trim() || "each";
    const basePrice = toSafeNumber(form.basePrice);
    const defaultPurchasePrice = toSafeNumber(form.defaultPurchasePrice);
    const defaultRentalRate = toSafeNumber(form.defaultRentalRate);
    const reorderLevel = toSafeNumber(form.reorderLevel);
    const warrantyMonths = toSafeNumber(form.warrantyMonths);
    const weight = form.weight.trim();
    const dimensions = form.dimensions.trim();
    const imageUrl = form.imageUrl.trim();
    const thumbnailUrl = form.thumbnailUrl.trim();
    const notes = form.notes.trim();

    if (!name) {
      toast.error("Product name is required.");
      return;
    }

    if (!category) {
      toast.error("Category is required.");
      return;
    }

    if (basePrice < 0 || defaultPurchasePrice < 0 || defaultRentalRate < 0) {
      toast.error("Prices cannot be negative.");
      return;
    }

    if (reorderLevel < 0 || warrantyMonths < 0) {
      toast.error("Reorder level and warranty months cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      const searchValues = [
        name,
        brand,
        model,
        category,
        form.productType,
        manufacturer,
        manufacturerItemId,
        primaryVendor,
        secondaryVendor,
        sku,
        upc,
        hcpcs,
        ndc,
        form.status,
        notes,
      ];

      const isRentalItem = form.isRentalItem || form.productType === "rental";
      const isSerialized =
        form.isSerialized ||
        form.productType === "serialized" ||
        form.requiresSerialTracking;

      const payload = {
        name,
        brand,
        model,
        category,
        productType: form.productType,
        manufacturer,
        manufacturerItemId,
        primaryVendor,
        secondaryVendor,
        sku,
        upc,
        hcpcs,
        ndc,
        basePrice,
        defaultPurchasePrice,
        defaultRentalRate,
        unitOfMeasure,
        reorderLevel,
        warrantyMonths,
        weight,
        dimensions,
        imageUrl,
        thumbnailUrl,
        status: form.status,
        isRentalItem,
        isSerialized,
        requiresPrescription: form.requiresPrescription,
        requiresSerialTracking: form.requiresSerialTracking,
        lotTracking: form.lotTracking,
        expirationTracking: form.expirationTracking,
        recallFlagged: form.recallFlagged,
        notes,
        deleted: false,
        searchText: normalizeSearchText(searchValues.join(" ")),
        searchKeywords: buildSearchKeywords(searchValues),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid ?? null,
        updatedByEmail: user?.email ?? null,
      };

      if (form.id) {
        const before = products.find((product) => product.id === form.id) ?? null;

        await updateDoc(doc(db, "products", form.id), payload);

        await writeAuditLog({
          action: "update",
          entityId: form.id,
          before,
          after: payload,
        });

        toast.success("Product updated.");
      } else {
        const createdRef = await addDoc(collection(db, "products"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.uid ?? null,
          createdByEmail: user?.email ?? null,
        });

        await writeAuditLog({
          action: "create",
          entityId: createdRef.id,
          after: payload,
        });

        toast.success("Product created.");
      }

      resetForm();
      await loadProducts("reset");
    } catch (error) {
      console.error("SAVE PRODUCT ERROR:", error);
      toast.error("Product could not be saved.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Package2 className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">Products</h1>
                <p className="text-sm text-neutral-400">
                  Master catalog for DME/HME items. Inventory handles stock,
                  serials, lots, movement history, and counts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadProducts("reset")}
                disabled={loadingProducts}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingProducts ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                )}
                Refresh
              </button>

              <button
                type="button"
                onClick={() => void handlePurgeVisibleProducts()}
                disabled={!isAdmin || purging || products.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {purging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Purge Loaded
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Loaded Products" value={stats.total} icon="box" />
          <StatCard label="Active" value={stats.active} icon="box" />
          <StatCard label="Rental Items" value={stats.rental} icon="money" />
          <StatCard label="Serialized" value={stats.serialized} icon="clipboard" />
          <StatCard label="Inactive" value={stats.inactive} icon="box" />
          <StatCard label="Discontinued" value={stats.discontinued} icon="warning" />
          <StatCard label="Recall Flagged" value={stats.recall} icon="warning" />
          <StatCard label="Needs Cleanup" value={stats.missingInfo} icon="risk" />
        </section>

        {stats.highRisk > 0 ? (
          <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Catalog cleanup needed</h2>
                <p className="mt-1 text-sm text-amber-100/80">
                  {stats.highRisk.toLocaleString()} loaded product record
                  {stats.highRisk === 1 ? "" : "s"} have high-risk catalog issues.
                  Missing identifiers, HCPCS gaps, recall flags, and serial mismatches
                  are how databases become haunted houses with billing codes.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                {form.id ? (
                  <Pencil className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5" aria-hidden="true" />
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  {form.id ? "Edit Product" : "Add Product"}
                </h2>
                <p className="text-sm text-neutral-400">
                  Define catalog identity, billing hints, and tracking rules.
                </p>
              </div>
            </div>

            {formWarnings.length > 0 ? (
              <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Smart catalog warnings
                </div>

                <ul className="list-inside list-disc space-y-1 text-amber-100/80">
                  {formWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-4">
              <TextInput
                id="product-name"
                label="Product Name"
                value={form.name}
                onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                required
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  id="brand"
                  label="Brand"
                  value={form.brand}
                  onChange={(value) => setForm((prev) => ({ ...prev, brand: value }))}
                />

                <TextInput
                  id="model"
                  label="Model"
                  value={form.model}
                  onChange={(value) => setForm((prev) => ({ ...prev, model: value }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  id="category"
                  label="Category"
                  value={form.category}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, category: value }))
                  }
                  list="category-options"
                  required
                />

                <SelectInput
                  id="product-type"
                  label="Product Type"
                  value={form.productType}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      productType: value as ProductType,
                      isRentalItem: value === "rental" ? true : prev.isRentalItem,
                      isSerialized:
                        value === "serialized" ? true : prev.isSerialized,
                    }))
                  }
                  options={[
                    ["resale", "Resale"],
                    ["rental", "Rental"],
                    ["consumable", "Consumable"],
                    ["serialized", "Serialized"],
                    ["service", "Service"],
                    ["oxygen", "Oxygen"],
                    ["cpap", "CPAP"],
                    ["other", "Other"],
                  ]}
                />
              </div>

              <datalist id="category-options">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>

              <TextInput
                id="manufacturer"
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, manufacturer: value }))
                }
                list="manufacturer-options"
              />

              <datalist id="manufacturer-options">
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer} value={manufacturer} />
                ))}
              </datalist>

              <TextInput
                id="manufacturer-item-id"
                label="Manufacturer Item ID"
                value={form.manufacturerItemId}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, manufacturerItemId: value }))
                }
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  id="sku"
                  label="SKU / Item ID"
                  value={form.sku}
                  onChange={(value) => setForm((prev) => ({ ...prev, sku: value }))}
                />

                <TextInput
                  id="hcpcs"
                  label="HCPCS"
                  value={form.hcpcs}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, hcpcs: value.toUpperCase() }))
                  }
                />
              </div>

              <div>
                <label htmlFor="upc" className="mb-2 block text-sm text-neutral-300">
                  UPC / Barcode
                </label>

                <div className="flex gap-2">
                  <input
                    id="upc"
                    value={form.upc}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, upc: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                    placeholder="Scan or type barcode"
                  />

                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 transition hover:bg-white/15"
                    title="Scan barcode"
                    aria-label="Scan barcode"
                  >
                    <Barcode className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  id="base-price"
                  label="Base Price"
                  type="number"
                  value={form.basePrice}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, basePrice: value }))
                  }
                />

                <SelectInput
                  id="status"
                  label="Status"
                  value={form.status}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value as ProductStatus }))
                  }
                  options={[
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                    ["discontinued", "Discontinued"],
                  ]}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15"
              >
                Advanced Catalog Fields
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showAdvanced ? (
                <div className="space-y-4 rounded-3xl border border-white/10 bg-black/40 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      id="primary-vendor"
                      label="Primary Vendor"
                      value={form.primaryVendor}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, primaryVendor: value }))
                      }
                      list="vendor-options"
                    />

                    <TextInput
                      id="secondary-vendor"
                      label="Secondary Vendor"
                      value={form.secondaryVendor}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, secondaryVendor: value }))
                      }
                      list="vendor-options"
                    />
                  </div>

                  <datalist id="vendor-options">
                    {vendors.map((vendor) => (
                      <option key={vendor} value={vendor} />
                    ))}
                  </datalist>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      id="ndc"
                      label="NDC"
                      value={form.ndc}
                      onChange={(value) => setForm((prev) => ({ ...prev, ndc: value }))}
                    />

                    <TextInput
                      id="unit-of-measure"
                      label="Unit of Measure"
                      value={form.unitOfMeasure}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, unitOfMeasure: value }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      id="purchase-price"
                      label="Default Purchase Price"
                      type="number"
                      value={form.defaultPurchasePrice}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          defaultPurchasePrice: value,
                        }))
                      }
                    />

                    <TextInput
                      id="rental-rate"
                      label="Default Rental Rate"
                      type="number"
                      value={form.defaultRentalRate}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          defaultRentalRate: value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      id="reorder-level"
                      label="Reorder Level"
                      type="number"
                      value={form.reorderLevel}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, reorderLevel: value }))
                      }
                    />

                    <TextInput
                      id="warranty-months"
                      label="Warranty Months"
                      type="number"
                      value={form.warrantyMonths}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, warrantyMonths: value }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      id="weight"
                      label="Weight"
                      value={form.weight}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, weight: value }))
                      }
                    />

                    <TextInput
                      id="dimensions"
                      label="Dimensions"
                      value={form.dimensions}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, dimensions: value }))
                      }
                    />
                  </div>

                  <TextInput
                    id="image-url"
                    label="Image URL"
                    value={form.imageUrl}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, imageUrl: value }))
                    }
                  />

                  <TextInput
                    id="thumbnail-url"
                    label="Thumbnail URL"
                    value={form.thumbnailUrl}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, thumbnailUrl: value }))
                    }
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <CheckboxInput
                      label="Rental item"
                      checked={form.isRentalItem}
                      onChange={(checked) =>
                        setForm((prev) => ({ ...prev, isRentalItem: checked }))
                      }
                    />

                    <CheckboxInput
                      label="Serialized item"
                      checked={form.isSerialized}
                      onChange={(checked) =>
                        setForm((prev) => ({ ...prev, isSerialized: checked }))
                      }
                    />

                    <CheckboxInput
                      label="Requires prescription"
                      checked={form.requiresPrescription}
                      onChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          requiresPrescription: checked,
                        }))
                      }
                    />

                    <CheckboxInput
                      label="Requires serial tracking"
                      checked={form.requiresSerialTracking}
                      onChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          requiresSerialTracking: checked,
                          isSerialized: checked ? true : prev.isSerialized,
                        }))
                      }
                    />

                    <CheckboxInput
                      label="Lot tracking"
                      checked={form.lotTracking}
                      onChange={(checked) =>
                        setForm((prev) => ({ ...prev, lotTracking: checked }))
                      }
                    />

                    <CheckboxInput
                      label="Expiration tracking"
                      checked={form.expirationTracking}
                      onChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          expirationTracking: checked,
                        }))
                      }
                    />

                    <CheckboxInput
                      label="Recall flagged"
                      checked={form.recallFlagged}
                      onChange={(checked) =>
                        setForm((prev) => ({ ...prev, recallFlagged: checked }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label htmlFor="notes" className="mb-2 block text-sm text-neutral-300">
                  Notes
                </label>

                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                  placeholder="Optional catalog notes"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !canWrite}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Product
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
                >
                  Clear
                </button>
              </div>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold">Product Catalog</h2>
                <p className="text-sm text-neutral-400">
                  {filteredProducts.length.toLocaleString()} visible from{" "}
                  {products.length.toLocaleString()} loaded records
                </p>
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-500"
                  aria-hidden="true"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black py-3 pl-10 pr-10 text-sm text-white outline-none focus:border-white/30 lg:w-80"
                  placeholder="Search name, SKU, UPC, HCPCS..."
                  aria-label="Search products"
                />

                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-3.5 text-neutral-500 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-white/10 bg-black/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-300">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Adaptive Filters
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MiniSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as ProductStatus | "all")}
                  options={[
                    ["all", "All statuses"],
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                    ["discontinued", "Discontinued"],
                  ]}
                />

                <MiniSelect
                  label="Type"
                  value={typeFilter}
                  onChange={(value) => setTypeFilter(value as ProductType | "all")}
                  options={[
                    ["all", "All types"],
                    ["resale", "Resale"],
                    ["rental", "Rental"],
                    ["consumable", "Consumable"],
                    ["serialized", "Serialized"],
                    ["service", "Service"],
                    ["oxygen", "Oxygen"],
                    ["cpap", "CPAP"],
                    ["other", "Other"],
                  ]}
                />

                <MiniSelect
                  label="Category"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[
                    ["all", "All categories"],
                    ...categories.map((category) => [category, category] as [string, string]),
                  ]}
                />

                <MiniSelect
                  label="Manufacturer"
                  value={manufacturerFilter}
                  onChange={setManufacturerFilter}
                  options={[
                    ["all", "All manufacturers"],
                    ...manufacturers.map(
                      (manufacturer) => [manufacturer, manufacturer] as [string, string]
                    ),
                  ]}
                />

                <MiniSelect
                  label="Vendor"
                  value={vendorFilter}
                  onChange={setVendorFilter}
                  options={[
                    ["all", "All vendors"],
                    ...vendors.map((vendor) => [vendor, vendor] as [string, string]),
                  ]}
                />

                <MiniSelect
                  label="Issues"
                  value={issueFilter}
                  onChange={setIssueFilter}
                  options={[
                    ["all", "All records"],
                    ["missing-info", "Needs cleanup"],
                    ["recall", "Recall flagged"],
                    ["serialized", "Serialized"],
                    ["rental", "Rental"],
                    ["rx", "Prescription"],
                  ]}
                />

                <MiniSelect
                  label="Sort"
                  value={sortMode}
                  onChange={(value) => setSortMode(value as SortMode)}
                  options={[
                    ["name-asc", "Name A-Z"],
                    ["name-desc", "Name Z-A"],
                    ["price-desc", "Price high-low"],
                    ["price-asc", "Price low-high"],
                    ["missing-info", "Most cleanup needed"],
                    ["risk-desc", "Highest risk"],
                  ]}
                />

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectVisible}
                disabled={filteredProducts.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckSquare className="h-4 w-4" />
                {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
              </button>

              <button
                type="button"
                onClick={() => void handleBatchSoftDelete()}
                disabled={!selectedIds.length || deleting}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Archive Selected
              </button>

              <span className="rounded-2xl border border-white/10 bg-black px-4 py-2 text-sm text-neutral-400">
                Selected: {selectedIds.length}
              </span>
            </div>

            {loadingProducts || authLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black p-4 text-neutral-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black p-6 text-center text-sm text-neutral-400">
                No products found.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-2xl border border-white/10 xl:block">
                  <table className="w-full min-w-[1180px] text-left text-sm">
                    <thead className="bg-white/5 text-neutral-400">
                      <tr>
                        <th className="px-4 py-3">Select</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">UPC</th>
                        <th className="px-4 py-3">HCPCS</th>
                        <th className="px-4 py-3">Manufacturer</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Flags</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProducts.map((product) => (
                        <ProductTableRow
                          key={product.id}
                          product={product}
                          selected={selectedIds.includes(product.id)}
                          onSelect={() => toggleSelected(product.id)}
                          onEdit={() => handleEdit(product)}
                          onArchive={() => void handleSoftDelete(product)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 xl:hidden">
                  {filteredProducts.map((product) => (
                    <ProductMobileCard
                      key={product.id}
                      product={product}
                      selected={selectedIds.includes(product.id)}
                      onSelect={() => toggleSelected(product.id)}
                      onEdit={() => handleEdit(product)}
                      onArchive={() => void handleSoftDelete(product)}
                    />
                  ))}
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadProducts("more")}
                    disabled={!hasMore || loadingMore}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {hasMore ? "Load More" : "All Loaded"}
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanDetected}
      />
    </main>
  );
}

function ProductTableRow({
  product,
  selected,
  onSelect,
  onEdit,
  onArchive,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const risk = productRiskScore(product);

  return (
    <tr className="border-t border-white/10 align-top">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${product.name}`}
        />
      </td>

      <td className="px-4 py-3">
        <div className="flex gap-3">
          <ProductThumb product={product} />

          <div>
            <div className="font-semibold">{product.name || "Unnamed product"}</div>
            <div className="text-xs text-neutral-500">
              {[product.brand, product.model, product.category]
                .filter(Boolean)
                .join(" • ") || "No category"}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3 text-neutral-300">{product.sku || "-"}</td>
      <td className="px-4 py-3 text-neutral-300">{product.upc || "-"}</td>
      <td className="px-4 py-3 text-neutral-300">{product.hcpcs || "-"}</td>
      <td className="px-4 py-3 text-neutral-300">
        {product.manufacturer || "-"}
      </td>
      <td className="px-4 py-3 text-neutral-300">
        ${product.basePrice.toFixed(2)}
      </td>

      <td className="px-4 py-3">
        <ProductFlags product={product} />
      </td>

      <td className="px-4 py-3">
        <RiskBadge score={risk} />
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={product.status} />
      </td>

      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-white/10 bg-white/10 p-2 transition hover:bg-white/15"
            title="Edit product"
            aria-label={`Edit ${product.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onArchive}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
            title="Archive product"
            aria-label={`Archive ${product.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProductMobileCard({
  product,
  selected,
  onSelect,
  onEdit,
  onArchive,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${product.name}`}
          className="mt-1"
        />

        <ProductThumb product={product} />

        <div className="min-w-0 flex-1">
          <div className="font-semibold">{product.name || "Unnamed product"}</div>
          <div className="text-xs text-neutral-500">
            {[product.brand, product.model, product.category]
              .filter(Boolean)
              .join(" • ") || "No category"}
          </div>

          <div className="mt-3 grid gap-2 text-xs text-neutral-300">
            <InfoLine label="SKU" value={product.sku} />
            <InfoLine label="UPC" value={product.upc} />
            <InfoLine label="HCPCS" value={product.hcpcs} />
            <InfoLine label="Manufacturer" value={product.manufacturer} />
            <InfoLine label="Price" value={`$${product.basePrice.toFixed(2)}`} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={product.status} />
            <RiskBadge score={productRiskScore(product)} />
            <ProductFlags product={product} />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>

            <button
              type="button"
              onClick={onArchive}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Archive
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProductThumb({ product }: { product: Product }) {
  const src = product.thumbnailUrl || product.imageUrl;

  if (!src) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neutral-500">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 object-cover"
    />
  );
}

function ProductFlags({ product }: { product: Product }) {
  const warnings = qualityWarnings(product);

  const flags = [
    product.isRentalItem ? "Rental" : "",
    product.isSerialized ? "Serialized" : "",
    product.requiresPrescription ? "Rx" : "",
    product.lotTracking ? "Lot" : "",
    product.expirationTracking ? "Exp" : "",
    product.recallFlagged ? "Recall" : "",
    ...warnings,
  ].filter(Boolean);

  if (!flags.length) {
    return <span className="text-xs text-neutral-500">Clean</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(new Set(flags)).map((flag) => (
        <span
          key={flag}
          className={
            flag === "Recall" || flag.includes("Missing") || flag.includes("mismatch")
              ? "rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-300"
              : "rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-neutral-300"
          }
        >
          {flag}
        </span>
      ))}
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 50) {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-300">
        High {score}
      </span>
    );
  }

  if (score >= 20) {
    return (
      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
        Medium {score}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
      Low {score}
    </span>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs capitalize">
      {status}
    </span>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-right">{value || "-"}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: "box" | "money" | "warning" | "clipboard" | "risk";
}) {
  const Icon =
    icon === "money"
      ? CircleDollarSign
      : icon === "warning"
        ? AlertTriangle
        : icon === "clipboard"
          ? ClipboardList
          : icon === "risk"
            ? Database
            : Boxes;

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div>
          <p className="text-sm text-neutral-400">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  list,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  list?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-neutral-300">
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        required={required}
        list={list}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
      />
    </div>
  );
}

function SelectInput({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-neutral-300">
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function MiniSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const id = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs text-neutral-500">
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-white/30"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}