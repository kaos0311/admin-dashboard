"use client";

import {
  AlertTriangle,
  Barcode,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Save,
} from "lucide-react";
import type { FormEvent } from "react";

import type {
  ProductForm as ProductFormType,
  ProductStatus,
  ProductType,
} from "../utils/productTypes";
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
} from "../utils/productTypes";
import { productFormWarnings } from "../utils/productValidation";

import {
  CheckboxInput,
  SelectInput,
  TextInput,
} from "./ProductInputs";

type ProductFormProps = {
  form: ProductFormType;
  showAdvanced: boolean;
  categories: string[];
  manufacturers: string[];
  vendors: string[];
  saving: boolean;
  canWrite: boolean;

  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (updates: Partial<ProductFormType>) => void;
  onClear: () => void;
  onToggleAdvanced: () => void;
  onOpenScanner: () => void;
};

export function ProductForm({
  form,
  showAdvanced,
  categories,
  manufacturers,
  vendors,
  saving,
  canWrite,
  onSubmit,
  onFormChange,
  onClear,
  onToggleAdvanced,
  onOpenScanner,
}: ProductFormProps) {
  const warnings = productFormWarnings(form);

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[32px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-3xl 2xl:sticky 2xl:top-6 2xl:max-h-[calc(100vh-3rem)] 2xl:overflow-y-auto"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-white/5">
          {form.id ? (
            <Pencil className="h-5 w-5 text-sky-100" />
          ) : (
            <Plus className="h-5 w-5 text-sky-100" />
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">
            {form.id ? "Edit Product" : "Add Product"}
          </h2>

          <p className="text-sm text-slate-400">
            Catalog identity, billing references, tracking rules, and cleanup
            flags.
          </p>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Smart catalog warnings
          </div>

          <ul className="list-inside list-disc space-y-1 text-amber-100/80">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-4">
        <TextInput
          id="product-name"
          label="Product Name"
          value={form.name}
          onChange={(value) => onFormChange({ name: value })}
          required
        />

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            id="brand"
            label="Brand"
            value={form.brand}
            onChange={(value) => onFormChange({ brand: value })}
          />

          <TextInput
            id="model"
            label="Model"
            value={form.model}
            onChange={(value) => onFormChange({ model: value })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            id="category"
            label="Category"
            value={form.category}
            onChange={(value) => onFormChange({ category: value })}
            list="category-options"
            required
          />

          <SelectInput
            id="product-type"
            label="Product Type"
            value={form.productType}
            onChange={(value) =>
              onFormChange({
                productType: value as ProductType,
                isRentalItem:
                  value === "rental" ? true : form.isRentalItem,
                isSerialized:
                  value === "serialized" ? true : form.isSerialized,
              })
            }
            options={PRODUCT_TYPE_OPTIONS}
          />
        </div>

        <datalist id="category-options">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <TextInput
          id="manufacturer"
          label="Manufacturer"
          value={form.manufacturer}
          onChange={(value) => onFormChange({ manufacturer: value })}
          list="manufacturer-options"
        />

        <datalist id="manufacturer-options">
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer} value={manufacturer} />
          ))}
        </datalist>

        <TextInput
          id="manufacturer-item-id"
          label="Manufacturer Item ID"
          value={form.manufacturerItemId}
          onChange={(value) =>
            onFormChange({ manufacturerItemId: value })
          }
        />

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            id="sku"
            label="SKU / Item ID"
            value={form.sku}
            onChange={(value) => onFormChange({ sku: value })}
          />

          <TextInput
            id="hcpcs"
            label="HCPCS"
            value={form.hcpcs}
            onChange={(value) =>
              onFormChange({ hcpcs: value.toUpperCase() })
            }
          />
        </div>

        <div>
          <label
            htmlFor="upc"
            className="mb-2 block text-sm text-slate-200/80"
          >
            UPC / Barcode
          </label>

          <div className="flex gap-2">
            <input
              id="upc"
              value={form.upc}
              onChange={(event) =>
                onFormChange({ upc: event.target.value })
              }
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-white/[0.09]"
              placeholder="Scan or type barcode"
            />

            <button
              type="button"
              onClick={onOpenScanner}
              className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-white transition hover:bg-white/[0.14]"
              title="Scan barcode"
              aria-label="Scan barcode"
            >
              <Barcode className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            id="base-price"
            label="Base Price"
            type="number"
            value={form.basePrice}
            onChange={(value) => onFormChange({ basePrice: value })}
          />

          <SelectInput
            id="status"
            label="Status"
            value={form.status}
            onChange={(value) =>
              onFormChange({ status: value as ProductStatus })
            }
            options={PRODUCT_STATUS_OPTIONS}
          />
        </div>

        <button
          type="button"
          onClick={onToggleAdvanced}
          className="inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
        >
          Advanced Catalog Fields

          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showAdvanced ? (
          <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <TextInput
                id="primary-vendor"
                label="Primary Vendor"
                value={form.primaryVendor}
                onChange={(value) =>
                  onFormChange({ primaryVendor: value })
                }
                list="vendor-options"
              />

              <TextInput
                id="secondary-vendor"
                label="Secondary Vendor"
                value={form.secondaryVendor}
                onChange={(value) =>
                  onFormChange({ secondaryVendor: value })
                }
                list="vendor-options"
              />
            </div>

            <datalist id="vendor-options">
              {vendors.map((vendor) => (
                <option key={vendor} value={vendor} />
              ))}
            </datalist>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <TextInput
                id="ndc"
                label="NDC"
                value={form.ndc}
                onChange={(value) => onFormChange({ ndc: value })}
              />

              <TextInput
                id="unit-of-measure"
                label="Unit of Measure"
                value={form.unitOfMeasure}
                onChange={(value) =>
                  onFormChange({ unitOfMeasure: value })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <TextInput
                id="purchase-price"
                label="Default Purchase Price"
                type="number"
                value={form.defaultPurchasePrice}
                onChange={(value) =>
                  onFormChange({ defaultPurchasePrice: value })
                }
              />

              <TextInput
                id="rental-rate"
                label="Default Rental Rate"
                type="number"
                value={form.defaultRentalRate}
                onChange={(value) =>
                  onFormChange({ defaultRentalRate: value })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <TextInput
                id="reorder-level"
                label="Reorder Level"
                type="number"
                value={form.reorderLevel}
                onChange={(value) =>
                  onFormChange({ reorderLevel: value })
                }
              />

              <TextInput
                id="warranty-months"
                label="Warranty Months"
                type="number"
                value={form.warrantyMonths}
                onChange={(value) =>
                  onFormChange({ warrantyMonths: value })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <TextInput
                id="weight"
                label="Weight"
                value={form.weight}
                onChange={(value) => onFormChange({ weight: value })}
              />

              <TextInput
                id="dimensions"
                label="Dimensions"
                value={form.dimensions}
                onChange={(value) =>
                  onFormChange({ dimensions: value })
                }
              />
            </div>

            <TextInput
              id="image-url"
              label="Image URL"
              value={form.imageUrl}
              onChange={(value) => onFormChange({ imageUrl: value })}
            />

            <TextInput
              id="thumbnail-url"
              label="Thumbnail URL"
              value={form.thumbnailUrl}
              onChange={(value) =>
                onFormChange({ thumbnailUrl: value })
              }
            />

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
              <CheckboxInput
                label="Rental item"
                checked={form.isRentalItem}
                onChange={(checked) =>
                  onFormChange({ isRentalItem: checked })
                }
              />

              <CheckboxInput
                label="Serialized item"
                checked={form.isSerialized}
                onChange={(checked) =>
                  onFormChange({ isSerialized: checked })
                }
              />

              <CheckboxInput
                label="Requires prescription"
                checked={form.requiresPrescription}
                onChange={(checked) =>
                  onFormChange({ requiresPrescription: checked })
                }
              />

              <CheckboxInput
                label="Requires serial tracking"
                checked={form.requiresSerialTracking}
                onChange={(checked) =>
                  onFormChange({
                    requiresSerialTracking: checked,
                    isSerialized: checked ? true : form.isSerialized,
                  })
                }
              />

              <CheckboxInput
                label="Lot tracking"
                checked={form.lotTracking}
                onChange={(checked) =>
                  onFormChange({ lotTracking: checked })
                }
              />

              <CheckboxInput
                label="Expiration tracking"
                checked={form.expirationTracking}
                onChange={(checked) =>
                  onFormChange({ expirationTracking: checked })
                }
              />

              <CheckboxInput
                label="Recall flagged"
                checked={form.recallFlagged}
                onChange={(checked) =>
                  onFormChange({ recallFlagged: checked })
                }
              />
            </div>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="notes"
            className="mb-2 block text-sm text-slate-200/80"
          >
            Notes
          </label>

          <textarea
            id="notes"
            value={form.notes}
            onChange={(event) =>
              onFormChange({ notes: event.target.value })
            }
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-white/[0.09]"
            placeholder="Optional catalog notes. Do not enter PHI here."
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !canWrite}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            Save Product
          </button>

          <button
            type="button"
            onClick={onClear}
            className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-white transition hover:bg-white/[0.14]"
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}