"use client";

import { Loader2, ScanLine, X } from "lucide-react";

import {
  dangerButton,
  glassButton,
  glassInput,
  glassPanel,
  glassSelect,
  labelText,
  primaryButton,
} from "../lib/orderUi";
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
  onSave: () => void;
  onScan?: () => void;
  onLoadBarcode: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-xl"
    >
      <div className={`${glassPanel} max-h-[92vh] w-full max-w-5xl overflow-hidden`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2
              id="order-modal-title"
              className="text-xl font-bold tracking-tight text-white"
            >
              {title}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-zinc-300 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close order modal"
          >
            <X className="h-5 w-5" aria-hidden={true} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm font-medium text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              id={`${mode}-patient-name`}
              label="Patient name"
              value={form.patientName}
              onChange={(value) => onChange("patientName", value)}
              required
            />

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
            />

            <div>
              <label htmlFor={`${mode}-status`} className={labelText}>
                Status
              </label>

              <select
                id={`${mode}-status`}
                value={form.status}
                onChange={(event) =>
                  onChange("status", event.target.value as OrderStatus)
                }
                className={glassSelect}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${mode}-barcode`} className={labelText}>
                Barcode
              </label>

              <div className="flex gap-2">
                <input
                  id={`${mode}-barcode`}
                  value={form.barcode}
                  onChange={(event) => onChange("barcode", event.target.value)}
                  className={glassInput}
                  placeholder="Scan or enter barcode"
                />

                {onScan ? (
                  <button
                    type="button"
                    onClick={onScan}
                    disabled={busy}
                    className={glassButton}
                    aria-label="Open barcode scanner"
                  >
                    <ScanLine className="h-4 w-4" aria-hidden={true} />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onLoadBarcode}
                disabled={busy || !form.barcode.trim()}
                className="mt-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Load inventory from barcode
              </button>
            </div>

            <TextField
              id={`${mode}-product-id`}
              label="Inventory product ID"
              value={form.productId}
              onChange={(value) => onChange("productId", value)}
              required
            />

            <TextField
              id={`${mode}-product-type`}
              label="Product"
              value={form.productType}
              onChange={(value) => onChange("productType", value)}
              required
            />

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
              <label htmlFor={`${mode}-notes`} className={labelText}>
                Notes
              </label>

              <textarea
                id={`${mode}-notes`}
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                className={`${glassInput} min-h-28 resize-y`}
                placeholder="Internal order notes"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={dangerButton}
          >
            Cancel
          </button>

          <button type="button" onClick={onSave} disabled={busy} className={primaryButton}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} />
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label htmlFor={id} className={labelText}>
        {label}
        {required ? <span className="text-rose-300"> *</span> : null}
      </label>

      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={glassInput}
        inputMode={inputMode}
      />
    </div>
  );
}