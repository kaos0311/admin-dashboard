"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_RENTAL_FILTERS,
  DEFAULT_RENTAL_FORM,
  RENTALS_COLLECTION,
} from "../rentals-constants";
import type {
  RentalFilters,
  RentalFormState,
  RentalRecord,
} from "../rentals-types";
import { filterRentalRecords } from "../utils/filters";
import { normalizeRentalRecord } from "../utils/normalize";

export function useRentals() {
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [filters, setFilters] = useState<RentalFilters>(
    DEFAULT_RENTAL_FILTERS
  );
  const [form, setForm] = useState<RentalFormState>(DEFAULT_RENTAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const rentalsQuery = query(
      collection(db, RENTALS_COLLECTION),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      rentalsQuery,
      (snapshot) => {
        const nextRecords = snapshot.docs.map((docSnap) =>
          normalizeRentalRecord(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          )
        );

        setRecords(nextRecords);
        setLoading(false);
      },
      () => {
        setRecords([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const filteredRecords = useMemo(
    () => filterRentalRecords(records, filters),
    [records, filters]
  );

  const resetForm = useCallback(() => {
    setForm(DEFAULT_RENTAL_FORM);
    setEditingId(null);
  }, []);

  const saveRental = useCallback(async () => {
    const cleanProductName = form.productName.trim();
    const cleanSerialNumber = form.serialNumber.trim();
    const cleanAssetTag = form.assetTag.trim();

    if (!cleanProductName || (!cleanSerialNumber && !cleanAssetTag)) {
      throw new Error(
        "Rental needs a product name and either a serial number or asset tag."
      );
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        productName: cleanProductName,
        serialNumber: cleanSerialNumber,
        assetTag: cleanAssetTag,
        patientName: form.patientName.trim(),
        patientId: form.patientId.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        monthlyRate: Number.isFinite(Number(form.monthlyRate))
          ? Number(form.monthlyRate)
          : 0,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, RENTALS_COLLECTION, editingId), payload);
      } else {
        await addDoc(collection(db, RENTALS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } finally {
      setSaving(false);
    }
  }, [editingId, form, resetForm]);

  const editRental = useCallback((record: RentalRecord) => {
    setEditingId(record.id);
    setForm({
      productId: record.productId,
      productName: record.productName,
      serialNumber: record.serialNumber,
      assetTag: record.assetTag,
      patientName: record.patientName,
      patientId: record.patientId,
      location: record.location,
      status: record.status,
      condition: record.condition,
      checkedOutDate: record.checkedOutDate,
      expectedReturnDate: record.expectedReturnDate,
      returnedDate: record.returnedDate,
      monthlyRate: record.monthlyRate,
      notes: record.notes,
    });
  }, []);

  const deleteRental = useCallback(async (recordId: string) => {
    await deleteDoc(doc(db, RENTALS_COLLECTION, recordId));
  }, []);

  const markReturned = useCallback(async (recordId: string) => {
    const today = new Date().toISOString().slice(0, 10);

    await updateDoc(doc(db, RENTALS_COLLECTION, recordId), {
      status: "available",
      patientName: "",
      patientId: "",
      returnedDate: today,
      updatedAt: serverTimestamp(),
    });
  }, []);

  return {
    records,
    filteredRecords,
    filters,
    setFilters,
    form,
    setForm,
    editingId,
    loading,
    saving,
    saveRental,
    editRental,
    deleteRental,
    markReturned,
    resetForm,
  };
}


