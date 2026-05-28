import type { Dispatch, SetStateAction } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
import {
  RENTAL_CONDITIONS,
  RENTAL_STATUSES,
} from "../rentals-constants";
import type {
  RentalCondition,
  RentalFormState,
  RentalProductOption,
  RentalStatus,
} from "../rentals-types";
import { SelectField } from "./fields/SelectField";
import { Textarea } from "./fields/Textarea";
import { TextInput } from "./fields/TextInput";
import { GlassCard } from "./shared/GlassCard";
import { SectionHeader } from "./shared/SectionHeader";

type RentalFormProps = {
  form: RentalFormState;
  setForm: Dispatch<SetStateAction<RentalFormState>>;
  editingId: string | null;
  saving: boolean;
  products: RentalProductOption[];
  productsLoading: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
};

export function RentalForm({
  form,
  setForm,
  editingId,
  saving,
  products,
  productsLoading,
  onSave,
  onCancel,
}: RentalFormProps) {
  function updateForm<Key extends keyof RentalFormState>(
    key: Key,
    value: RentalFormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleProductSelect(productId: string) {
    const product = products.find((item) => item.id === productId);

    setForm((current) => ({
      ...current,
      productId,
      productName: product?.name ?? current.productName,
    }));
  }

  return (
    <GlassCard>
      <SectionHeader
        eyebrow="Rental control"
        title={editingId ? "Edit Rental Asset" : "Add Rental Asset"}
        description="Create or update rental assets with enough detail to keep accountability tight. Back in my day, this was a clipboard and somebody yelling across the warehouse. This is slightly less cursed."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <label className="block lg:col-span-2" htmlFor="rental-product">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Product
          </span>

          <select
            id="rental-product"
            value={form.productId}
            onChange={(event) => handleProductSelect(event.target.value)}
            aria-label="Rental product"
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
          >
            <option value="" className="bg-slate-950">
              {productsLoading ? "Loading products..." : "Select product"}
            </option>

            {products.map((product) => (
              <option
                key={product.id}
                value={product.id}
                className="bg-slate-950"
              >
                {product.name}
                {product.hcpcs ? ` • ${product.hcpcs}` : ""}
              </option>
            ))}
          </select>
        </label>

        <TextInput
          id="rental-product-name"
          label="Product Name"
          value={form.productName}
          onChange={(value) => updateForm("productName", value)}
          placeholder="Manual product name"
          required
        />

        <TextInput
          id="rental-monthly-rate"
          label="Monthly Rate"
          type="number"
          value={form.monthlyRate}
          onChange={(value) => updateForm("monthlyRate", Number(value))}
          placeholder="0.00"
        />

        <TextInput
          id="rental-serial-number"
          label="Serial Number"
          value={form.serialNumber}
          onChange={(value) => updateForm("serialNumber", value)}
          placeholder="Serial number"
        />

        <TextInput
          id="rental-asset-tag"
          label="Asset Tag"
          value={form.assetTag}
          onChange={(value) => updateForm("assetTag", value)}
          placeholder="Asset tag"
        />

        <SelectField<RentalStatus>
          id="rental-status"
          label="Status"
          value={form.status}
          options={RENTAL_STATUSES}
          onChange={(value) => updateForm("status", value)}
          required
        />

        <SelectField<RentalCondition>
          id="rental-condition"
          label="Condition"
          value={form.condition}
          options={RENTAL_CONDITIONS}
          onChange={(value) => updateForm("condition", value)}
          required
        />

        <TextInput
          id="rental-patient-name"
          label="Patient Name"
          value={form.patientName}
          onChange={(value) => updateForm("patientName", value)}
          placeholder="Assigned patient"
        />

        <TextInput
          id="rental-patient-id"
          label="Patient ID"
          value={form.patientId}
          onChange={(value) => updateForm("patientId", value)}
          placeholder="Brightree / internal ID"
        />

        <TextInput
          id="rental-location"
          label="Location"
          value={form.location}
          onChange={(value) => updateForm("location", value)}
          placeholder="Warehouse, branch, patient home"
        />

        <TextInput
          id="rental-checkout-date"
          label="Checked Out"
          type="date"
          value={form.checkedOutDate}
          onChange={(value) => updateForm("checkedOutDate", value)}
        />

        <TextInput
          id="rental-expected-return"
          label="Expected Return"
          type="date"
          value={form.expectedReturnDate}
          onChange={(value) => updateForm("expectedReturnDate", value)}
        />

        <TextInput
          id="rental-returned-date"
          label="Returned Date"
          type="date"
          value={form.returnedDate}
          onChange={(value) => updateForm("returnedDate", value)}
        />

        <div className="lg:col-span-4">
          <Textarea
            id="rental-notes"
            label="Notes"
            value={form.notes}
            onChange={(value) => updateForm("notes", value)}
            placeholder="Service notes, patient assignment details, damage notes, return issues..."
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {editingId ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        ) : null}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editingId ? (
            <Save className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}

          {editingId ? "Save Changes" : "Add Rental"}
        </button>
      </div>
    </GlassCard>
  );
}
