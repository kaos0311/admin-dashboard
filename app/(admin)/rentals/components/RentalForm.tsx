"use client";

import { Loader2, Pencil, Plus, Save } from "lucide-react";

import type {
  BillingCycle,
  DeliveryStatus,
  ProductOption,
  RentalForm as RentalFormType,
  RentalStatus,
} from "../types/rentalTypes";

import { money } from "../utils/rentalCalculations";

import { SelectField } from "../fields/SelectField";
import { TextInput } from "../fields/TextInput";
import { Textarea } from "../fields/Textarea";

type RentalFormProps = {
  form: RentalFormType;
  products: ProductOption[];
  saving: boolean;
  canWrite: boolean;
  previewMonthsUsed: number;
  previewTotalCharges: number;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  updateForm: <K extends keyof RentalFormType>(
    key: K,
    value: RentalFormType[K]
  ) => void;
  applyProduct: (productId: string) => void;
};

export function RentalForm({
  form,
  products,
  saving,
  canWrite,
  previewMonthsUsed,
  previewTotalCharges,
  onSubmit,
  onReset,
  updateForm,
  applyProduct,
}: RentalFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-inner shadow-white/10">
          {form.id ? (
            <Pencil className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Plus className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">
            {form.id ? "Edit Rental" : "Add Rental"}
          </h2>

          <p className="text-sm text-slate-400">
            Billing updates automatically from rental dates because calculators
            are apparently still useful in 2026.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <SelectField
          label="Rental Product"
          value={form.productId}
          onChange={applyProduct}
          options={[
            { value: "", label: "Manual / unlinked product" },
            ...products.map((product) => ({
              value: product.id,
              label: `${product.name}${
                product.sku ? ` • ${product.sku}` : ""
              }`,
            })),
          ]}
        />

        <TextInput
          label="Product Name"
          value={form.productName}
          onChange={(value: string) => updateForm("productName", value)}
          required
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Category"
            value={form.category}
            onChange={(value: string) => updateForm("category", value)}
          />

          <TextInput
            label="SKU"
            value={form.sku}
            onChange={(value: string) => updateForm("sku", value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Serial Number"
            value={form.serialNumber}
            onChange={(value: string) => updateForm("serialNumber", value)}
          />

          <TextInput
            label="Lot Number"
            value={form.lotNumber}
            onChange={(value: string) => updateForm("lotNumber", value)}
          />
        </div>

        <TextInput
          label="Customer Name"
          value={form.customerName}
          onChange={(value: string) => updateForm("customerName", value)}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Patient Name"
            value={form.patientName}
            onChange={(value: string) => updateForm("patientName", value)}
          />

          <TextInput
            label="Patient ID"
            value={form.patientId}
            onChange={(value: string) => updateForm("patientId", value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Payer Name"
            value={form.payerName}
            onChange={(value: string) => updateForm("payerName", value)}
          />

          <TextInput
            label="Insurance Type"
            value={form.insuranceType}
            onChange={(value: string) => updateForm("insuranceType", value)}
          />
        </div>

        <TextInput
          label="Authorization Number"
          value={form.authorizationNumber}
          onChange={(value: string) => updateForm("authorizationNumber", value)}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Start Date"
            type="date"
            value={form.rentalStartDate}
            onChange={(value: string) => updateForm("rentalStartDate", value)}
            required
          />

          <TextInput
            label="End Date"
            type="date"
            value={form.rentalEndDate}
            onChange={(value: string) => updateForm("rentalEndDate", value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Monthly Rate"
            type="number"
            value={form.monthlyRate}
            onChange={(value: string) => updateForm("monthlyRate", value)}
          />

          <SelectField
            label="Billing Cycle"
            value={form.billingCycle}
            onChange={(value: string) =>
              updateForm("billingCycle", value as BillingCycle)
            }
            options={[
              { value: "Monthly", label: "Monthly" },
              { value: "Weekly", label: "Weekly" },
              { value: "Daily", label: "Daily" },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Rental Status"
            value={form.status}
            onChange={(value: string) =>
              updateForm("status", value as RentalStatus)
            }
            options={[
              { value: "Active", label: "Active" },
              { value: "Returned", label: "Returned" },
              { value: "Past Due", label: "Past Due" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />

          <SelectField
            label="Delivery Status"
            value={form.deliveryStatus}
            onChange={(value: string) =>
              updateForm("deliveryStatus", value as DeliveryStatus)
            }
            options={[
              { value: "Not Scheduled", label: "Not Scheduled" },
              { value: "Scheduled", label: "Scheduled" },
              { value: "Delivered", label: "Delivered" },
              {
                value: "Pickup Scheduled",
                label: "Pickup Scheduled",
              },
              { value: "Picked Up", label: "Picked Up" },
              { value: "Cleaning", label: "Cleaning" },
              { value: "Ready", label: "Ready" },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Delivery Date"
            type="date"
            value={form.deliveryDate}
            onChange={(value: string) => updateForm("deliveryDate", value)}
          />

          <TextInput
            label="Pickup Date"
            type="date"
            value={form.pickupDate}
            onChange={(value: string) => updateForm("pickupDate", value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Location / Bin"
            value={form.location}
            onChange={(value: string) => updateForm("location", value)}
          />

          <TextInput
            label="Assigned To"
            value={form.assignedTo}
            onChange={(value: string) => updateForm("assignedTo", value)}
          />
        </div>

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(value: string) => updateForm("notes", value)}
          placeholder="Optional rental notes, delivery details, pickup notes, or billing context."
        />

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
          Rental time:{" "}
          <span className="font-semibold text-white">
            {previewMonthsUsed.toLocaleString()} month
            {previewMonthsUsed === 1 ? "" : "s"}
          </span>

          {" • "}

          Total charges:{" "}
          <span className="font-semibold text-white">
            {money(previewTotalCharges)}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !canWrite}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            Save Rental
          </button>

          <button
            type="button"
            onClick={onReset}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/15"
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}