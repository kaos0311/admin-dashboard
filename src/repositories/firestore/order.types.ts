// ---------------------------------------------------------------------------
// Autofill option types (returned by repository subscription methods)
// ---------------------------------------------------------------------------

export interface PatientAutofillOption {
  id: string;
  name: string;
  address: string;
  phone: string;
  facilityName: string;
}

export interface ProductAutofillOption {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
}

export interface FacilityAutofillOption {
  id: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  group: string;
}

// ---------------------------------------------------------------------------
// Callback types
// ---------------------------------------------------------------------------

export type ErrorCallback = (error: unknown) => void;
export type PatientAutofillCallback = (patients: PatientAutofillOption[]) => void;
export type ProductAutofillCallback = (products: ProductAutofillOption[]) => void;
export type FacilityAutofillCallback = (facilities: FacilityAutofillOption[]) => void;
