"use client";

import { useCallback, useState } from "react";

import { initialInventoryForm } from "../lib/inventoryConstants";
import type { InventoryForm, InventoryItem } from "../lib/inventoryTypes";

export function useInventoryForm() {
  const [form, setForm] = useState<InventoryForm>(initialInventoryForm);

  const resetForm = useCallback(function resetForm() {
    setForm(initialInventoryForm);
  }, []);

  const updateForm = useCallback(function updateForm<K extends keyof InventoryForm>(
    key: K,
    value: InventoryForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const editItem = useCallback(function editItem(
    item: InventoryItem,
    options: { scroll?: boolean } = {}
  ) {
    setForm({
      id: item.id,
      productId: item.productId,
      name: item.name,
      category: item.category,
      sku: item.sku,
      hcpc: item.hcpc,
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

    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  /**
   * Update only server-controlled stock fields without overwriting
   * unsaved user edits in name, category, manufacturer, or other fields.
   */
  const syncStockFields = useCallback(function syncStockFields(
    item: InventoryItem
  ) {
    setForm((previous) => {
      if (!previous.id || previous.id !== item.id) {
        return previous;
      }

      const nextQuantityOnHand = String(item.quantityOnHand);
      const nextCommitted = String(item.committed);
      const nextOnRent = String(item.onRent);
      const nextOnOrder = String(item.onOrder);

      if (
        previous.quantityOnHand === nextQuantityOnHand &&
        previous.committed === nextCommitted &&
        previous.onRent === nextOnRent &&
        previous.onOrder === nextOnOrder
      ) {
        return previous;
      }

      return {
        ...previous,
        quantityOnHand: nextQuantityOnHand,
        committed: nextCommitted,
        onRent: nextOnRent,
        onOrder: nextOnOrder,
      };
    });
  }, []);

  return {
    form,
    setForm,
    updateForm,
    resetForm,
    editItem,
    syncStockFields,
  };
}
