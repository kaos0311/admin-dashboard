"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import toast from "react-hot-toast";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { auth, db } from "@/lib/firebase";

import {
  initialRentalForm,
  PRODUCTS_LIMIT,
  RENTALS_LIMIT,
} from "../constants/rentalConstants";

import {
  calculateMonthsUsed,
  dateFromInput,
  deriveRentalStatus,
  todayInputValue,
} from "../utils/rentalCalculations";

import {
  normalizeProduct,
  normalizeRental,
  toSafeNumber,
} from "../utils/rentalNormalize";

import {
  buildSearchTokens,
  normalizeSearchText,
} from "../utils/rentalSearch";

import type {
  DeliveryStatus,
  ProductOption,
  Rental,
  RentalForm,
  RentalStatus,
} from "../types/rentalTypes";

export function useRentalsData() {
  const { loading: authLoading, isAdmin, isStaff } = useAuthRole();

  const mountedRef = useRef(false);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);

  const [form, setForm] = useState<RentalForm>(initialRentalForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | RentalStatus>("all");

  const [deliveryFilter, setDeliveryFilter] =
    useState<"all" | DeliveryStatus>("all");

  const [showDeleted, setShowDeleted] = useState(false);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [saving, setSaving] = useState(false);

  const canRead = isAdmin || isStaff;
  const canWrite = isAdmin || isStaff;

  const loading =
    authLoading || loadingProducts || loadingRentals;

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
      setRentals([]);

      setLoadingProducts(false);
      setLoadingRentals(false);

      toast.error("No permission to view rentals.");
      return;
    }

    const productsQuery = query(
      collection(db, "products"),
      orderBy("name", "asc"),
      limit(PRODUCTS_LIMIT)
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        if (!mountedRef.current) return;

        const rows = snapshot.docs
          .map((docSnap) =>
            normalizeProduct(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
          .filter((product) => product.status === "active");

        setProducts(rows);
        setLoadingProducts(false);
      },
      (error) => {
        console.error("LOAD PRODUCTS ERROR:", error);

        setLoadingProducts(false);

        toast.error("Failed loading products.");
      }
    );

    return () => unsubscribe();
  }, [authLoading, canRead]);

  useEffect(() => {
    if (authLoading || !canRead) return;

    const rentalsQuery = query(
      collection(db, "rentals"),
      orderBy("rentalStartDate", "desc"),
      limit(RENTALS_LIMIT)
    );

    const unsubscribe = onSnapshot(
      rentalsQuery,
      (snapshot) => {
        if (!mountedRef.current) return;

        const rows = snapshot.docs.map((docSnap) =>
          normalizeRental(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          )
        );

        setRentals(rows);
        setLoadingRentals(false);
      },
      (error) => {
        console.error("LOAD RENTALS ERROR:", error);

        setLoadingRentals(false);

        toast.error("Failed loading rentals.");
      }
    );

    return () => unsubscribe();
  }, [authLoading, canRead]);

  const rentalProducts = useMemo(() => {
    const flagged = products.filter(
      (product) => product.isRentalItem
    );

    return flagged.length ? flagged : products;
  }, [products]);

  const previewMonthsUsed = useMemo(() => {
    return calculateMonthsUsed(
      form.rentalStartDate,
      form.rentalEndDate
    );
  }, [form.rentalStartDate, form.rentalEndDate]);

  const previewTotalCharges = useMemo(() => {
    return (
      previewMonthsUsed *
      toSafeNumber(form.monthlyRate)
    );
  }, [previewMonthsUsed, form.monthlyRate]);

  const filteredRentals = useMemo(() => {
    const term = normalizeSearchText(search);

    return rentals.filter((rental) => {
      if (!showDeleted && rental.status === "Deleted") {
        return false;
      }

      if (
        statusFilter !== "all" &&
        rental.status !== statusFilter
      ) {
        return false;
      }

      if (
        deliveryFilter !== "all" &&
        rental.deliveryStatus !== deliveryFilter
      ) {
        return false;
      }

      if (!term) return true;

      const haystack = normalizeSearchText(
        [
          rental.productName,
          rental.customerName,
          rental.patientName,
          rental.patientId,
          rental.serialNumber,
          rental.sku,
          rental.location,
          rental.notes,
        ].join(" ")
      );

      return haystack.includes(term);
    });
  }, [
    rentals,
    search,
    statusFilter,
    deliveryFilter,
    showDeleted,
  ]);

  const stats = useMemo(() => {
    const active = rentals.filter(
      (r) => r.status === "Active"
    ).length;

    const returned = rentals.filter(
      (r) => r.status === "Returned"
    ).length;

    const cancelled = rentals.filter(
      (r) => r.status === "Cancelled"
    ).length;

    const pastDue = rentals.filter(
      (r) => r.status === "Past Due"
    ).length;

    const openCharges = rentals
      .filter(
        (r) =>
          r.status === "Active" ||
          r.status === "Past Due"
      )
      .reduce((sum, r) => sum + r.totalCharges, 0);

    const totalCharges = rentals
      .filter((r) => r.status !== "Deleted")
      .reduce((sum, r) => sum + r.totalCharges, 0);

    return {
      active,
      returned,
      cancelled,
      pastDue,
      openCharges,
      totalCharges,
    };
  }, [rentals]);

  function updateForm<K extends keyof RentalForm>(
    key: K,
    value: RentalForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(initialRentalForm);
  }

  function softRefresh() {
    setSearch("");
    setStatusFilter("all");
    setDeliveryFilter("all");

    resetForm();

    toast.success("Rental view refreshed.");
  }

  function applyProduct(productId: string) {
    const product = products.find(
      (item) => item.id === productId
    );

    if (!product) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      productId: product.id,
      productName: product.name,
      category: product.category,
      sku: product.sku,
      monthlyRate:
        prev.monthlyRate ||
        String(product.basePrice || ""),
    }));
  }

  function handleEdit(rental: Rental) {
    setForm({
      id: rental.id,
      productId: rental.productId,
      productName: rental.productName,
      category: rental.category,
      sku: rental.sku,
      serialNumber: rental.serialNumber,
      lotNumber: rental.lotNumber,
      customerName: rental.customerName,
      patientName: rental.patientName,
      patientId: rental.patientId,
      payerName: rental.payerName,
      insuranceType: rental.insuranceType,
      authorizationNumber:
        rental.authorizationNumber,
      rentalStartDate: rental.rentalStartDate,
      rentalEndDate: rental.rentalEndDate,
      monthlyRate: String(rental.monthlyRate),
      billingCycle: rental.billingCycle,
      status: rental.status,
      deliveryStatus: rental.deliveryStatus,
      deliveryDate: rental.deliveryDate,
      pickupDate: rental.pickupDate,
      location: rental.location,
      assignedTo: rental.assignedTo,
      notes: rental.notes,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function markReturned(rental: Rental) {
    try {
      const endDate = todayInputValue();

      const monthsUsed = calculateMonthsUsed(
        rental.rentalStartDate,
        endDate
      );

      const totalCharges =
        monthsUsed * rental.monthlyRate;

      await updateDoc(doc(db, "rentals", rental.id), {
        rentalEndDate: endDate,
        pickupDate: rental.pickupDate || endDate,
        monthsUsed,
        totalCharges,
        status: "Returned",
        updatedAt: serverTimestamp(),
      });

      toast.success("Rental returned.");
    } catch (error) {
      console.error(error);

      toast.error("Failed updating rental.");
    }
  }

  async function archiveRental(rental: Rental) {
    try {
      await updateDoc(doc(db, "rentals", rental.id), {
        status: "Deleted",
        deletedAt: serverTimestamp(),
      });

      toast.success("Rental archived.");
    } catch (error) {
      console.error(error);

      toast.error("Failed archiving rental.");
    }
  }

  async function submitRental() {
    if (!canWrite) {
      toast.error("No permission to save rentals.");
      return;
    }

    const monthlyRate = toSafeNumber(form.monthlyRate);

    const monthsUsed = calculateMonthsUsed(
      form.rentalStartDate,
      form.rentalEndDate
    );

    const totalCharges =
      monthsUsed * monthlyRate;

    const status = deriveRentalStatus(
      form.status,
      form.rentalEndDate
    );

    const searchSource = [
      form.productName,
      form.customerName,
      form.patientName,
      form.patientId,
      form.serialNumber,
      form.sku,
      form.notes,
    ].join(" ");

    const payload = {
      ...form,
      monthsUsed,
      monthlyRate,
      totalCharges,
      status,
      searchText:
        normalizeSearchText(searchSource),
      searchTokens:
        buildSearchTokens(searchSource),
      updatedAt: serverTimestamp(),
    };

    try {
      setSaving(true);

      if (form.id) {
        await updateDoc(
          doc(db, "rentals", form.id),
          payload
        );

        toast.success("Rental updated.");
      } else {
        await addDoc(collection(db, "rentals"), {
          ...payload,
          createdAt: serverTimestamp(),
        });

        toast.success("Rental added.");
      }

      resetForm();
    } catch (error) {
      console.error(error);

      toast.error("Failed saving rental.");
    } finally {
      setSaving(false);
    }
  }

  return {
    canWrite,
    loading,
    saving,

    form,
    rentals: filteredRentals,
    rentalProducts,

    stats,

    search,
    setSearch,

    statusFilter,
    setStatusFilter,

    deliveryFilter,
    setDeliveryFilter,

    showDeleted,
    setShowDeleted,

    previewMonthsUsed,
    previewTotalCharges,

    updateForm,
    resetForm,
    softRefresh,
    applyProduct,

    handleEdit,
    markReturned,
    archiveRental,
    submitRental,
  };
}