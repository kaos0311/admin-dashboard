"use client";

import { useState } from "react";

import { initialInventoryForm } from "../lib/inventoryConstants";
import type { InventoryForm, InventoryItem } from "../lib/inventoryTypes";

export function useInventoryForm() {
  const [form, setForm] = useState<InventoryForm>(initialInventoryForm);

  function resetForm() {
    setForm(initialInventoryForm);
  }

  function updateForm<K extends keyof InventoryForm>(
    key: K,
    value: InventoryForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function editItem(item: InventoryItem) {
    setForm({
      id: item.id,
      productId: item.productId,
      name: item.name,
      category: item.category,
      sku: item.sku,
      barcode: item.barcode,
      serial: item.serial,
      lotNumber: item.lotNumber,
      locationName: item.locationName,
      binLocation: item.binLocation,
      quantityOnHand: String(item.quantityOnHand),
      committed: String(item.committed),
      onRent: String(item.onRent),
      onOrder: String(item.onOrder),
      reorderLevel: String(item.reorderLevel),
      unitCost: String(item.unitCost),
      status: item.status,
      manufacturer: item.manufacturer,
      manufacturerItemId: item.manufacturerItemId,
      modelNumber: item.modelNumber,
      warrantyProvider: item.warrantyProvider,
      warrantyStartDate: item.warrantyStartDate,
      warrantyEndDate: item.warrantyEndDate,
      warrantyNotes: item.warrantyNotes,
      purchaseDate: item.purchaseDate,
      usefulLifeMonths: String(item.usefulLifeMonths || 60),
      lifecycleStatus: item.lifecycleStatus,
      nextServiceDate: item.nextServiceDate,
      lifecycleNotes: item.lifecycleNotes,
      notes: item.notes,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return {
    form,
    setForm,
    updateForm,
    resetForm,
    editItem,
  };
}