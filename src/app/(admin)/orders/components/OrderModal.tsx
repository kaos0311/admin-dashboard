"use client";

import type { HTMLAttributes } from "react";
import { Loader2, ScanLine, X } from "lucide-react";

import { buttons, colors, glass, spacing, typography } from "@/theme";

import type {
  FacilityAutofillOption,
  PatientAutofillOption,
  ProductAutofillOption,
} from "@/repositories/firestore/order.types";
import type { OrderFormState, OrderStatus } from "../lib/orderTypes";

const statusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function OrderModal({
  title,
  description,
  form,
  busy,
  error,
  mode,
  onClose,
  onChange,
  patientOptions,
  productOptions,
  facilityOptions,
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
  patientOptions: PatientAutofillOption[];
  productOptions: ProductAutofillOption[];
  facilityOptions: FacilityAutofillOption[];
  onSave: () => void;
  onScan?: () => void;
  onLoadBarcode: () => void;
}) {
  const patientListId = `${mode}-patient-options`;
  const productListId = `${mode}-product-options`;
  const productIdListId = `${mode}-product-id-options`;
  const facilityListId = `${mode}-facility-options`;

  function applyPatientAutofill(value: string) {
    const clean = value.trim().toLowerCase();
    const match = patientOptions.find(
      (patient) => patient.name.toLowerCase() === clean
    );

    if (!match) return;

    onChange("patientName", match.name);
    if (match.phone) onChange("phone", match.phone);
    if (match.address) onChange("patientAddress", match.address);
    if (match.facilityName) onChange("facilityName", match.facilityName);
  }

  function applyProductAutofill(value: string) {
    const clean = value.trim().toLowerCase();
    const match = productOptions.find((product) =>
      [product.name, product.id, product.sku, product.barcode]
        .filter(Boolean)
        .some((candidate) => candidate.toLowerCase() === clean)
    );

    if (!match) return;

    onChange("productId", match.id);
    onChange("productType", match.name || match.sku || match.id);
    if (match.barcode) onChange("barcode", match.barcode);
    if (match.price) onChange("purchaseCost", match.price);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-xl"
    >
      <div
        className={`${glass.panel} max-h-[92vh] w-full max-w-5xl overflow-hidden`}
      >
        <div
          className={`flex items-start justify-between gap-4 border-b ${glass.divider} ${spacing.section}`}
        >
          <div className="min-w-0">
            <h2 id="order-modal-title" className={typography.sectionTitle}>
              {title}
            </h2>

            <p className={`${typography.bodyMuted} mt-1`}>{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={buttons.icon}
            aria-label="Close order modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5">
          {error ? (
            <div
              className={`${glass.inset} ${colors.dangerBadge} mb-4 p-3 text-sm font-medium`}
            >
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              id={`${mode}-patient-name`}
              label="Patient name"
              value={form.patientName}
              onChange={(value) => {
                onChange("patientName", value);
                applyPatientAutofill(value);
              }}
              onBlur={() => applyPatientAutofill(form.patientName)}
              list={patientListId}
              required
            />

            <datalist id={patientListId}>
              {patientOptions.map((patient) => (
                <option key={patient.id} value={patient.name}>
                  {[patient.phone, patient.address].filter(Boolean).join(" - ")}
                </option>
              ))}
            </datalist>

            <TextField
              id={`${mode}-phone`}
              label="Phone"
              value={form.phone}
              onChange={(value) => onChange("phone", value)}
            />

            <div className="md:col-span-2">
              <TextField
                id={`${mode}-patient-address`}
                label="Patient address"
                value={form.patientAddress}
                onChange={(value) => onChange("patientAddress", value)}
                required
              />
            </div>

            <TextField
              id={`${mode}-facility-name`}
              label="Facility"
              value={form.facilityName}
              onChange={(value) => onChange("facilityName", value)}
              list={facilityListId}
            />

            <datalist id={facilityListId}>
              {facilityOptions.map((facility) => (
                <option key={facility.id} value={facility.name}>
                  {[facility.group, facility.phone, facility.address]
                    .filter(Boolean)
                    .join(" - ")}
                </option>
              ))}
            </datalist>

            <div>
              <label htmlFor={`${mode}-status`} className={typography.formLabel}>
                Status
              </label>

              <select
                id={`${mode}-status`}
                value={form.status}
                onChange={(event) =>
                  onChange("status", event.target.value as OrderStatus)
                }
                className={`${glass.select} mt-2`}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${mode}-barcode`} className={typography.formLabel}>
                Barcode
              </label>

              <div className="mt-2 flex gap-2">
                <input
                  id={`${mode}-barcode`}
                  value={form.barcode}
                  onChange={(event) => onChange("barcode", event.target.value)}
                  className={`${glass.input} px-4 py-3`}
                  placeholder="Scan or enter barcode"
                />

                {onScan ? (
                  <button
                    type="button"
                    onClick={onScan}
                    disabled={busy}
                    className={buttons.icon}
                    aria-label="Open barcode scanner"
                  >
                    <ScanLine className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onLoadBarcode}
                disabled={busy || !form.barcode.trim()}
                className={`${buttons.secondary} mt-2 px-3 py-1.5 text-xs`}
              >
                Load inventory from barcode
              </button>
            </div>

            <TextField
              id={`${mode}-product-id`}
              label="Inventory product ID"
              value={form.productId}
              onChange={(value) => {
                onChange("productId", value);
                applyProductAutofill(value);
              }}
              onBlur={() => applyProductAutofill(form.productId)}
              list={productIdListId}
              required
            />

            <TextField
              id={`${mode}-product-type`}
              label="Product"
              value={form.productType}
              onChange={(value) => {
                onChange("productType", value);
                applyProductAutofill(value);
              }}
              onBlur={() => applyProductAutofill(form.productType)}
              list={productListId}
              required
            />

            <datalist id={productIdListId}>
              {productOptions.map((product) => (
                <option key={`${product.id}-id`} value={product.id}>
                  {product.name}
                </option>
              ))}
            </datalist>

            <datalist id={productListId}>
              {productOptions.map((product) => (
                <option key={`${product.id}-name`} value={product.name || product.sku || product.id}>
                  {[product.sku, product.barcode].filter(Boolean).join(" - ")}
                </option>
              ))}
            </datalist>

            <TextField
              id={`${mode}-purchase-cost`}
              label="Purchase cost"
              value={form.purchaseCost}
              onChange={(value) => onChange("purchaseCost", value)}
              inputMode="decimal"
              required
            />

            <TextField
              id={`${mode}-quantity`}
              label="Quantity"
              value={form.quantity}
              onChange={(value) => onChange("quantity", value)}
              inputMode="numeric"
              required
            />

            <div className="md:col-span-2">
              <label htmlFor={`${mode}-notes`} className={typography.formLabel}>
                Notes
              </label>

              <textarea
                id={`${mode}-notes`}
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                className={`${glass.input} mt-2 min-h-28 resize-y px-4 py-3`}
                placeholder="Internal order notes"
              />
            </div>
          </div>
        </div>

        <div
          className={`flex flex-col-reverse gap-3 border-t ${glass.divider} ${spacing.section} sm:flex-row sm:justify-end`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={buttons.danger}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className={buttons.primary}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
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
  list,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  list?: string;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={typography.formLabel}>
        {label}
        {required ? <span className="text-rose-300"> *</span> : null}
      </label>

      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${glass.input} mt-2 px-4 py-3`}
        inputMode={inputMode}
        list={list}
      />
    </div>
  );
}
