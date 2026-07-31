"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  cancelRentalWorkflow,
  createAndCheckoutRentalWorkflow,
  exchangeRentalWorkflow,
  returnRentalWorkflow,
} from "@/lib/domainWorkflows";
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
      const {
        status: workflowStatus,
        patientId: workflowPatientId,
        patientName: workflowPatientName,
        itemId: workflowItemId,
        ...metadataForm
      } = form;
      const rentalMetadata = {
        ...metadataForm,
        productName: cleanProductName,
        itemId: workflowItemId.trim(),
        itemGroup: form.itemGroup.trim(),
        procCode: form.procCode.trim(),
        modifiers: form.modifiers.trim(),
        serialNumber: cleanSerialNumber,
        assetNumber: form.assetNumber.trim(),
        assetTag: cleanAssetTag,
        patientName: workflowPatientName.trim(),
        patientId: workflowPatientId.trim(),
        patientDob: form.patientDob.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        monthlyRate: Number.isFinite(Number(form.monthlyRate))
          ? Number(form.monthlyRate)
          : 0,
        quantity: Number.isFinite(Number(form.quantity))
          ? Number(form.quantity)
          : 1,
        charge: Number.isFinite(Number(form.charge)) ? Number(form.charge) : 0,
        allow: Number.isFinite(Number(form.allow)) ? Number(form.allow) : 0,
        extCharge: Number.isFinite(Number(form.extCharge))
          ? Number(form.extCharge)
          : 0,
        extAllow: Number.isFinite(Number(form.extAllow))
          ? Number(form.extAllow)
          : 0,
        parNumber: form.parNumber.trim(),
        parExpiration: form.parExpiration.trim(),
        planType: form.planType.trim(),
        itemDiagnosis: form.itemDiagnosis.trim(),
        insuranceName: form.insuranceName.trim(),
        payor: form.payor.trim(),
        orderingDoctor: form.orderingDoctor.trim(),
        primaryDoctor: form.primaryDoctor.trim(),
        orderDocNpi: form.orderDocNpi.trim(),
        primaryDocNpi: form.primaryDocNpi.trim(),
        salesOrderId: form.salesOrderId.trim(),
        salesOrderDetailId: form.salesOrderDetailId.trim(),
        hospice: form.hospice,
        sourceReport: form.sourceReport.trim(),
      };

      if (editingId) {
        const safeMetadataPayload: Partial<typeof rentalMetadata> & { updatedAt?: ReturnType<typeof serverTimestamp> } = {
          ...rentalMetadata,
          updatedAt: serverTimestamp(),
        };
        delete safeMetadataPayload.itemId;
        delete safeMetadataPayload.patientId;
        delete safeMetadataPayload.patientName;
        await updateDoc(doc(db, RENTALS_COLLECTION, editingId), safeMetadataPayload);
      } else {
        if (workflowStatus === "checked_out") {
          const rentalId = doc(collection(db, RENTALS_COLLECTION)).id;
          const result = await createAndCheckoutRentalWorkflow({
            operationId: `rental-create-checkout-${rentalId}`,
            rentalId,
            inventoryItemId: workflowItemId.trim(),
            productId: form.productId.trim(),
            patientId: workflowPatientId.trim(),
            patientName: workflowPatientName.trim(),
            serialNumber: cleanSerialNumber,
            quantity: Number.isFinite(Number(form.quantity))
              ? Number(form.quantity)
              : 1,
            reason: "Rental created and checked out from rentals page.",
            rentalData: rentalMetadata,
          });

          if (result.status !== "success" && result.status !== "duplicate_operation") {
            throw new Error(result.message || "Rental create-and-checkout workflow failed.");
          }
        } else {
          await addDoc(collection(db, RENTALS_COLLECTION), {
            ...rentalMetadata,
            status: workflowStatus || "draft",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
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
      itemId: record.itemId,
      itemGroup: record.itemGroup,
      procCode: record.procCode,
      modifiers: record.modifiers,
      serialNumber: record.serialNumber,
      assetNumber: record.assetNumber,
      assetTag: record.assetTag,
      patientName: record.patientName,
      patientId: record.patientId,
      patientDob: record.patientDob,
      phone: record.phone,
      location: record.location,
      status: record.status,
      condition: record.condition,
      checkedOutDate: record.checkedOutDate,
      expectedReturnDate: record.expectedReturnDate,
      returnedDate: record.returnedDate,
      nextBillingDate: record.nextBillingDate,
      nextBillingPeriod: record.nextBillingPeriod,
      monthlyRate: record.monthlyRate,
      quantity: record.quantity,
      charge: record.charge,
      allow: record.allow,
      extCharge: record.extCharge,
      extAllow: record.extAllow,
      parNumber: record.parNumber,
      parExpiration: record.parExpiration,
      planType: record.planType,
      itemDiagnosis: record.itemDiagnosis,
      insuranceName: record.insuranceName,
      payor: record.payor,
      orderingDoctor: record.orderingDoctor,
      primaryDoctor: record.primaryDoctor,
      orderDocNpi: record.orderDocNpi,
      primaryDocNpi: record.primaryDocNpi,
      salesOrderId: record.salesOrderId,
      salesOrderDetailId: record.salesOrderDetailId,
      hospice: record.hospice,
      sourceReport: record.sourceReport,
      notes: record.notes,
    });
  }, []);

  const deleteRental = useCallback(async (recordId: string) => {
    const result = await cancelRentalWorkflow({
      operationId: `rental-cancel-${recordId}`,
      rentalId: recordId,
      reason: "Rental cancelled from rentals page.",
    });

    if (result.status !== "success" && result.status !== "duplicate_operation") {
      throw new Error(result.message || "Rental cancellation failed.");
    }
  }, []);

  const markReturned = useCallback(async (recordId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const record = records.find((item) => item.id === recordId);

    if (!record) {
      throw new Error("Rental record was not found.");
    }

    const result = await returnRentalWorkflow({
      operationId: `rental-return-${recordId}`,
      rentalId: recordId,
      inventoryItemId: record.itemId,
      productId: record.productId,
      serialNumber: record.serialNumber,
      quantity: Math.max(1, Number(record.quantity || 1)),
      patientId: record.patientId,
      reason: `Rental marked returned on ${today}.`,
    });

    if (result.status !== "success" && result.status !== "duplicate_operation") {
      throw new Error(result.message || "Rental return workflow failed.");
    }
  }, [records]);

  const exchangeRental = useCallback(async (params: {
    record: RentalRecord;
    replacementInventoryItemId: string;
    replacementSerialNumber?: string;
    reason: string;
  }) => {
    const replacementInventoryItemId = params.replacementInventoryItemId.trim();
    const reason = params.reason.trim();

    if (!replacementInventoryItemId) {
      throw new Error("Replacement inventory item ID is required.");
    }
    if (!reason) {
      throw new Error("Reason is required for rental exchange.");
    }

    const result = await exchangeRentalWorkflow({
      operationId: `rental-exchange-${params.record.id}-${replacementInventoryItemId}`,
      rentalId: params.record.id,
      inventoryItemId: params.record.itemId,
      replacementInventoryItemId,
      productId: params.record.productId,
      replacementProductId: params.record.productId,
      patientId: params.record.patientId,
      patientName: params.record.patientName,
      serialNumber: params.record.serialNumber,
      replacementSerialNumber: params.replacementSerialNumber?.trim(),
      quantity: Math.max(1, Number(params.record.quantity || 1)),
      reason,
    });

    if (result.status !== "success" && result.status !== "duplicate_operation") {
      throw new Error(result.message || "Rental exchange workflow failed.");
    }
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
    exchangeRental,
    resetForm,
  };
}


