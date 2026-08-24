"use client";

import { useEffect, useMemo, useState } from "react";

import { PackageSearch, X } from "lucide-react";
import toast from "react-hot-toast";

import { buttons, colors, glass, tiles, typography } from "@/theme";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";

import { normalizeBarcode } from "@/lib/barcode";

import { useInventoryActions } from "../hooks/useInventoryActions";
import { useInventoryForm } from "../hooks/useInventoryForm";
import type { InventoryItem, ScanTarget } from "../lib/inventoryTypes";
import { auth } from "@/lib/firebase";
import { identifyInventoryProduct } from "@/services/inventory/inventory-jarvis.service";

import { InventoryForm } from "./InventoryForm";
import { JarvisNoticeModal } from "./JarvisNoticeModal";
import { ScanSuccessModal } from "./ScanSuccessModal";

type InventoryStatsDrilldownModalProps = {
  open: boolean;
  title: string;
  description: string;
  items: InventoryItem[];
  canWrite: boolean;
  isAdmin: boolean;
  autofillOptions: {
    itemNames: string[];
    categories: string[];
    skus: string[];
    hcpcs: string[];
    manufacturers: string[];
    locations: string[];
  };
  onClose: () => void;
};

export function InventoryStatsDrilldownModal({
  open,
  title,
  description,
  items,
  canWrite,
  isAdmin,
  autofillOptions,
  onClose,
}: InventoryStatsDrilldownModalProps) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);
  const [jarvisIdentifying, setJarvisIdentifying] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [jarvisNotice, setJarvisNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const {
    form,
    updateForm,
    resetForm,
    editItem,
    syncStockFields,
  } = useInventoryForm();

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId]
  );

  const {
    handleSubmit,
    handleScanMovement,
  } = useInventoryActions({
    form,
    items,
    canWrite,
    isAdmin,
    selectedIds: [],
    resetForm,
    removeSelectedId: () => {},
    clearSelected: () => {},
    setSaving,
  });

  useEffect(() => {
    if (!open) return;

    const nextItem = items.find((item) => item.id === selectedItemId) ?? items[0];

    if (!nextItem) {
      resetForm();
      setSelectedItemId("");
      return;
    }

    if (selectedItemId && nextItem.id === selectedItemId) {
      return;
    }

    setSelectedItemId(nextItem.id);
    editItem(nextItem, { scroll: false });
  }, [editItem, items, open, resetForm, selectedItemId]);

  useEffect(() => {
    if (!open || !form.id) return;

    const liveItem = items.find((item) => item.id === form.id);
    if (!liveItem) return;

    syncStockFields(liveItem);
  }, [items, form.id, open, syncStockFields]);

  if (!open) return null;

  function handleSelectItem(item: InventoryItem) {
    setSelectedItemId(item.id);
    editItem(item, { scroll: false });
  }

  function openScanner(target: ScanTarget) {
    setScanTarget(target);
    setScannerOpen(true);
  }

  async function handleInventoryMovementScan(
    clean: string,
    direction: "in" | "out",
  ) {
    try {
      const success =
        await handleScanMovement(clean, direction);

      if (!success) {
        return;
      }

      setScanSuccess({
        title:
          direction === "in"
            ? "Scan In Complete"
            : "Scan Out Complete",
        message:
          direction === "in"
            ? `${clean} was saved to inventory successfully.`
            : `${clean} was removed from available inventory successfully.`,
      });
    } catch (error: unknown) {
      console.error(
        "INVENTORY DRILLDOWN SCAN ERROR:",
        {
          direction,
          error,
        },
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Inventory scan could not be completed.",
      );
    }
  }

  function handleScanDetected(code: string) {
    const clean = normalizeBarcode(code);

    switch (scanTarget) {
      case "serial":
        updateForm("serial", clean);
        break;

      case "lotNumber":
        updateForm("lotNumber", clean);
        break;

      case "scanIn":
        void handleInventoryMovementScan(
          clean,
          "in",
        );
        return;

      case "scanOut":
        void handleInventoryMovementScan(
          clean,
          "out",
        );
        return;

      default:
        updateForm("barcode", clean);
        break;
    }

    toast.success("Barcode scan captured.");
  }

  async function handleJarvisIdentifyCurrentItem() {
    if (!form.id) {
      toast.error("Select an inventory item before running Jarvis identify.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("You must be signed in to run Jarvis identify.");
      return;
    }

    setJarvisIdentifying(true);

    try {
      const result = await identifyInventoryProduct({
        currentUser,
        inventoryId: form.id,
        code: form.barcode || form.sku || form.serial,
      });

      if (!result.ok) {
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

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-xl sm:p-6">
        <div className="mx-auto flex min-h-full w-full max-w-7xl items-start justify-center">
          <section className={`${glass.panel} w-full overflow-hidden`}>
            <div className={colors.grid} />

            <div className="relative flex min-w-0 flex-col gap-5 p-4 sm:p-6">
              <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className={tiles.label}>
                    <PackageSearch className="h-3.5 w-3.5" />
                    Inventory Drilldown
                  </div>

                  <h2 className={`${typography.sectionTitle} mt-3`}>
                    {title}
                  </h2>
                  <p className={`${typography.bodyMuted} mt-2 max-w-3xl`}>
                    {description}
                  </p>
                </div>

                <button
                  type="button"
                  className={buttons.icon}
                  onClick={onClose}
                  aria-label="Close inventory drilldown"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {items.length === 0 ? (
                <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                  No inventory records are tied to this tile right now.
                </div>
              ) : (
                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,360px)_1fr]">
                  <aside className={`${glass.insetPadded} max-h-[74vh] overflow-y-auto`}>
                    <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                      <p className={typography.cardTitle}>
                        Products
                      </p>
                      <span className={tiles.badge}>
                        {items.length.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {items.map((item) => {
                        const selected = item.id === selectedItem?.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={[
                              glass.listItem,
                              "w-full text-left",
                              selected ? glass.selectedListItem : "",
                            ].join(" ")}
                            onClick={() => handleSelectItem(item)}
                          >
                            <p className={`${typography.bodyStrong} break-words`}>
                              {item.name || "Unnamed product"}
                            </p>
                            <p className={`${typography.smallMuted} mt-1 break-words`}>
                              SKU {item.sku || "-"} | HCPCS {item.hcpc || "-"}
                            </p>
                            <p className={`${typography.smallMuted} mt-1`}>
                              Qty {item.quantityOnHand.toLocaleString()} | Available{" "}
                              {item.available.toLocaleString()} | {item.status.replaceAll("_", " ")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </aside>

                  <div className="min-w-0 max-h-[74vh] overflow-y-auto">
                    <InventoryForm
                      form={form}
                      autofillOptions={autofillOptions}
                      saving={saving}
                      canWrite={canWrite}
                      onSubmit={handleSubmit}
                      onReset={resetForm}
                      onUpdate={updateForm}
                      onOpenScanner={openScanner}
                      onJarvisIdentify={() => {
                        void handleJarvisIdentifyCurrentItem();
                      }}
                      jarvisIdentifying={jarvisIdentifying}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScanTarget(null);
        }}
        onDetected={handleScanDetected}
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
    </>
  );
}
