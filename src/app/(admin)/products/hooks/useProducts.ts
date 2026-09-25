"use client";

import { useCallback, useRef, useState } from "react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

import { normalizeBarcode } from "@/lib/barcode";
import { app } from "@/lib/firebase";
import { ProductRepository } from "@/repositories/firestore/product.repository";

import {
  BATCH_SIZE,
  PAGE_SIZE,
  type Product,
  type ProductForm,
} from "../utils/productTypes";
import {
  buildSearchKeywords,
  normalizeSearchText,
  toSafeNumber,
} from "../utils/productNormalize";
import { writeProductAuditLog } from "../utils/productAudit";
import {
  executePurgeProducts,
  PURGE_PRODUCTS_CONFIRM_TEXT,
  type PurgeProductsRequest,
  type PurgeProductsResult,
} from "../lib/purgeProductsClient";

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
        const { products: rows, nextCursor, hasMore: nextHasMore } =
          await ProductRepository.getPage(
            PAGE_SIZE,
            mode === "more" ? currentLastDoc : null,
          );

        setProducts((current) => {
          const next = mode === "more" ? [...current, ...rows] : rows;

          setSelectedIds((selected) =>
            selected.filter((id) => next.some((product) => product.id === id)),
          );

          return next;
        });

        lastDocRef.current = nextCursor;
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
    [canRead],
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
          updatedBy: user?.uid ?? null,
          updatedByEmail: user?.email ?? null,
        };

        if (form.id) {
          const before =
            products.find((product) => product.id === form.id) ?? null;

          await ProductRepository.update(form.id, payload);

          await writeProductAuditLog({
            action: "update",
            entityId: form.id,
            before,
            after: payload,
            user,
          });

          toast.success("Product updated.");
        } else {
          const createdRef = await ProductRepository.create({
            ...payload,
            createdBy: user?.uid ?? null,
            createdByEmail: user?.email ?? null,
          });

          await writeProductAuditLog({
            action: "create",
            entityId: createdRef,
            after: payload,
            user,
          });

          toast.success("Product created.");
        }

        if (/^[A-Z]\d{4}[A-Z0-9]{0,2}$/.test(hcpcs)) {
          await ProductRepository.upsertHcpcsCode(hcpcs, {
            code: hcpcs,
            shopDescription: name,
            shopCategory: category,
            observedInShop: true,
            lastObservedSource: "product_catalog",
          });
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
    [canWrite, loadProducts, products, user],
  );

  const softDeleteProduct = useCallback(
    async (product: Product) => {
      if (!canWrite) {
        toast.error("You do not have permission to delete products.");
        return false;
      }

      const confirmed = window.confirm(
        `Archive "${product.name}" from the product catalog? Inventory history will stay intact.`,
      );

      if (!confirmed) return false;

      try {
        await ProductRepository.softDelete(product.id, {
          deletedBy: user?.uid ?? null,
          deletedByEmail: user?.email ?? null,
        });

        await writeProductAuditLog({
          action: "soft-delete",
          entityId: product.id,
          before: product,
          user,
        });

        setProducts((current) =>
          current.filter((row) => row.id !== product.id),
        );

        setSelectedIds((current) =>
          current.filter((id) => id !== product.id),
        );

        toast.success("Product archived.");
        return true;
      } catch (error) {
        console.error("SOFT DELETE PRODUCT ERROR:", error);
        toast.error("Product could not be archived.");
        return false;
      }
    },
    [canWrite, user],
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
      `Archive ${selectedIds.length} selected product(s)? Inventory history will stay intact.`,
    );

    if (!confirmed) return false;

    setDeleting(true);

    try {
      await ProductRepository.batchSoftDelete(selectedIds, BATCH_SIZE, {
        deletedBy: user?.uid ?? null,
        deletedByEmail: user?.email ?? null,
      });

      await writeProductAuditLog({
        action: "bulk-soft-delete",
        count: selectedIds.length,
        user,
      });

      setProducts((current) =>
        current.filter((product) => !selectedIds.includes(product.id)),
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

  const purgeProducts = useCallback(async () => {
    if (!isAdmin) {
      toast.error("Only admins can purge products.");
      return false;
    }

    const confirmed = window.confirm(
      "Danger zone: permanently delete the ENTIRE product catalog? This cannot be undone.",
    );

    if (!confirmed) return false;

    const typed = window.prompt(
      `Type "${PURGE_PRODUCTS_CONFIRM_TEXT}" to confirm.`,
    );

    if (typed !== PURGE_PRODUCTS_CONFIRM_TEXT) {
      toast.error("Purge cancelled.");
      return false;
    }

    setPurging(true);

    try {
      const functions = getFunctions(app, "us-central1");
      const callable = httpsCallable<
        PurgeProductsRequest,
        PurgeProductsResult
      >(functions, "purgeProducts");

      const result = await executePurgeProducts(
        callable,
        typed,
      );

      setProducts([]);
      setSelectedIds([]);

      await loadProducts("reset");

      toast.success(
        `Purged ${result.deletedCount.toLocaleString()} product(s).`,
      );

      return true;
    } catch (error) {
      console.error("PURGE PRODUCTS ERROR:", error);
      toast.error("Products could not be purged.");
      return false;
    } finally {
      setPurging(false);
    }
  }, [isAdmin, loadProducts]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
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
    purgeProducts,
  };
}
