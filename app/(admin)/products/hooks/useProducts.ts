"use client";

import { useCallback, useRef, useState } from "react";
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
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";

import {
  BATCH_SIZE,
  PAGE_SIZE,
  type Product,
  type ProductForm,
} from "../utils/productTypes";
import {
  buildSearchKeywords,
  normalizeProduct,
  normalizeSearchText,
  toSafeNumber,
} from "../utils/productNormalize";
import { writeProductAuditLog } from "../utils/productAudit";

type UserLike = {
  uid?: string | null;
  email?: string | null;
} | null;

export function useProducts(args: {
  canRead: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  user: UserLike;
}) {
  const { canRead, canWrite, isAdmin, user } = args;

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasMoreRef = useRef(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [hasMore, setHasMore] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [purging, setPurging] = useState(false);

  const loadProducts = useCallback(
    async (mode: "reset" | "more" = "reset") => {
      if (!canRead) {
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      const currentLastDoc = lastDocRef.current;
      const currentHasMore = hasMoreRef.current;

      if (mode === "reset") {
        setLoadingProducts(true);
        lastDocRef.current = null;
        hasMoreRef.current = true;
        setHasMore(true);
      } else {
        if (!currentLastDoc || !currentHasMore) return;
        setLoadingMore(true);
      }

      try {
        const productsQuery =
          mode === "more" && currentLastDoc
            ? query(
                collection(db, "products"),
                orderBy("name", "asc"),
                startAfter(currentLastDoc),
                limit(PAGE_SIZE)
              )
            : query(
                collection(db, "products"),
                orderBy("name", "asc"),
                limit(PAGE_SIZE)
              );

        const snapshot = await getDocs(productsQuery);

        const rows = snapshot.docs
          .map((docSnap) =>
            normalizeProduct(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
          .filter((product) => !product.deleted);

        setProducts((current) => {
          const next = mode === "more" ? [...current, ...rows] : rows;

          setSelectedIds((selected) =>
            selected.filter((id) => next.some((product) => product.id === id))
          );

          return next;
        });

        const nextLastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
        const nextHasMore = snapshot.docs.length === PAGE_SIZE;

        lastDocRef.current = nextLastDoc;
        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);
      } catch (error) {
        console.error("LOAD PRODUCTS ERROR:", error);
        toast.error("Products could not be loaded. Check Firestore rules/indexes.");
      } finally {
        setLoadingProducts(false);
        setLoadingMore(false);
      }
    },
    [canRead]
  );

  const saveProduct = useCallback(
    async (form: ProductForm) => {
      if (!canWrite) {
        toast.error("You do not have permission to save products.");
        return false;
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
        return false;
      }

      if (!category) {
        toast.error("Category is required.");
        return false;
      }

      if (basePrice < 0 || defaultPurchasePrice < 0 || defaultRentalRate < 0) {
        toast.error("Prices cannot be negative.");
        return false;
      }

      if (reorderLevel < 0 || warrantyMonths < 0) {
        toast.error("Reorder level and warranty months cannot be negative.");
        return false;
      }

      setSaving(true);

      try {
        const isRentalItem = form.isRentalItem || form.productType === "rental";

        const isSerialized =
          form.isSerialized ||
          form.productType === "serialized" ||
          form.requiresSerialTracking;

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
          const before =
            products.find((product) => product.id === form.id) ?? null;

          await updateDoc(doc(db, "products", form.id), payload);

          await writeProductAuditLog({
            action: "update",
            entityId: form.id,
            before,
            after: payload,
            user,
          });

          toast.success("Product updated.");
        } else {
          const createdRef = await addDoc(collection(db, "products"), {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: user?.uid ?? null,
            createdByEmail: user?.email ?? null,
          });

          await writeProductAuditLog({
            action: "create",
            entityId: createdRef.id,
            after: payload,
            user,
          });

          toast.success("Product created.");
        }

        await loadProducts("reset");
        return true;
      } catch (error) {
        console.error("SAVE PRODUCT ERROR:", error);
        toast.error("Product could not be saved.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [canWrite, loadProducts, products, user]
  );

  const softDeleteProduct = useCallback(
    async (product: Product) => {
      if (!canWrite) {
        toast.error("You do not have permission to delete products.");
        return false;
      }

      const confirmed = window.confirm(
        `Archive "${product.name}" from the product catalog? Inventory history will stay intact.`
      );

      if (!confirmed) return false;

      try {
        await updateDoc(doc(db, "products", product.id), {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user?.uid ?? null,
          deletedByEmail: user?.email ?? null,
          status: "discontinued",
          updatedAt: serverTimestamp(),
        });

        await writeProductAuditLog({
          action: "soft-delete",
          entityId: product.id,
          before: product,
          user,
        });

        setProducts((current) =>
          current.filter((row) => row.id !== product.id)
        );

        setSelectedIds((current) =>
          current.filter((id) => id !== product.id)
        );

        toast.success("Product archived.");
        return true;
      } catch (error) {
        console.error("SOFT DELETE PRODUCT ERROR:", error);
        toast.error("Product could not be archived.");
        return false;
      }
    },
    [canWrite, user]
  );

  const batchSoftDeleteProducts = useCallback(async () => {
    if (!canWrite) {
      toast.error("You do not have permission to delete products.");
      return false;
    }

    if (!selectedIds.length) {
      toast.error("Select products first.");
      return false;
    }

    const confirmed = window.confirm(
      `Archive ${selectedIds.length} selected product(s)? Inventory history will stay intact.`
    );

    if (!confirmed) return false;

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

      await writeProductAuditLog({
        action: "bulk-soft-delete",
        count: selectedIds.length,
        user,
      });

      setProducts((current) =>
        current.filter((product) => !selectedIds.includes(product.id))
      );

      toast.success(`Archived ${selectedIds.length} product(s).`);
      setSelectedIds([]);

      return true;
    } catch (error) {
      console.error("BATCH SOFT DELETE PRODUCTS ERROR:", error);
      toast.error("Selected products could not be archived.");
      return false;
    } finally {
      setDeleting(false);
    }
  }, [canWrite, selectedIds, user]);

  const purgeLoadedProducts = useCallback(async () => {
    if (!isAdmin) {
      toast.error("Only admins can purge products.");
      return false;
    }

    const confirmed = window.confirm(
      "Danger zone: permanently delete the currently loaded product records? Use this only for test resets."
    );

    if (!confirmed) return false;

    const typed = window.prompt('Type "PURGE PRODUCTS" to confirm.');

    if (typed !== "PURGE PRODUCTS") {
      toast.error("Purge cancelled.");
      return false;
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

      await writeProductAuditLog({
        action: "purge",
        count: ids.length,
        user,
      });

      setProducts([]);
      setSelectedIds([]);

      toast.success(`Purged ${ids.length} loaded product(s).`);
      return true;
    } catch (error) {
      console.error("PURGE PRODUCTS ERROR:", error);
      toast.error("Products could not be purged.");
      return false;
    } finally {
      setPurging(false);
    }
  }, [isAdmin, products, user]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  }

  function selectVisible(ids: string[]) {
    setSelectedIds((current) => Array.from(new Set([...current, ...ids])));
  }

  function unselectVisible(ids: string[]) {
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  }

  return {
    products,
    setProducts,

    selectedIds,
    setSelectedIds,
    toggleSelected,
    selectVisible,
    unselectVisible,

    hasMore,
    loadingProducts,
    loadingMore,
    saving,
    deleting,
    purging,

    loadProducts,
    saveProduct,
    softDeleteProduct,
    batchSoftDeleteProducts,
    purgeLoadedProducts,
  };
}