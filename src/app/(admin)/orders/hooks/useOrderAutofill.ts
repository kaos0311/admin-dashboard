"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useBrightreeReferences } from "@/app/hooks/useBrightreeReferences";

export type PatientAutofillOption = {
  id: string;
  name: string;
  address: string;
  phone: string;
  facilityName: string;
};

export type ProductAutofillOption = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
};

export type FacilityAutofillOption = {
  id: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  group: string;
};

type RolodexFacilityOption = FacilityAutofillOption & {
  contactType: string;
};

type InsuranceReference = {
  name?: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function moneyText(...values: unknown[]): string {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return String(parsed);
  }

  return "0";
}

function compactAddress(data: Record<string, unknown>): string {
  const direct = text(data.address || data.fullAddress || data.patientAddress);
  if (direct) return direct;

  return [
    text(data.address1 || data.streetAddress),
    text(data.city),
    text(data.state),
    text(data.zip || data.postalCode),
  ]
    .filter(Boolean)
    .join(", ");
}

export function useOrderAutofill() {
  const brightreeReferences = useBrightreeReferences();
  const [patients, setPatients] = useState<PatientAutofillOption[]>([]);
  const [products, setProducts] = useState<ProductAutofillOption[]>([]);
  const [facilities, setFacilities] = useState<FacilityAutofillOption[]>([]);

  useEffect(() => {
    const patientsQuery = query(collection(db, "patients_index"), limit(250));
    const productsQuery = query(collection(db, "products"), limit(250));
    const rolodexQuery = query(collection(db, "rolodexContacts"), limit(500));

    const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
      setPatients(
        snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            const name = text(
              data.patientName ||
                data.fullName ||
                [data.firstName, data.lastName]
                  .map(text)
                  .filter(Boolean)
                  .join(" ")
            );

            return {
              id: docSnapshot.id,
              name,
              address: compactAddress(data),
              phone: text(data.phone || data.mobilePhone || data.homePhone),
              facilityName: text(data.facility || data.facilityName),
            };
          })
          .filter((option) => option.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(
        snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            const name = text(data.name || data.itemName || data.description);

            return {
              id: docSnapshot.id,
              name,
              sku: text(data.sku || data.itemId),
              barcode: text(data.upc || data.barcode),
              price: moneyText(
                data.basePrice,
                data.defaultPurchasePrice,
                data.price,
                data.unitCost
              ),
            };
          })
          .filter((option) => option.name || option.sku || option.barcode)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });

    const unsubscribeRolodex = onSnapshot(rolodexQuery, (snapshot) => {
      setFacilities(
        snapshot.docs
          .map((docSnapshot): RolodexFacilityOption => {
            const data = docSnapshot.data() as Record<string, unknown>;

            return {
              id: docSnapshot.id,
              name: text(data.organization || data.name),
              address: text(data.address),
              phone: text(data.phone),
              fax: text(data.alternatePhone),
              group: text(data.roleTitle),
              contactType: text(data.contactType),
            };
          })
          .filter(
            (facility) => facility.contactType === "facility" && facility.name
          )
          .map(({ contactType: _contactType, ...facility }) => facility)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });

    return () => {
      unsubscribePatients();
      unsubscribeProducts();
      unsubscribeRolodex();
    };
  }, []);

  return useMemo(
    () => ({
      patients,
      products,
      facilities,
      insurances: (
        brightreeReferences.insuranceCompanies as InsuranceReference[]
      )
        .map((insurance) => insurance.name ?? "")
        .filter(Boolean),
    }),
    [brightreeReferences.insuranceCompanies, facilities, patients, products]
  );
}
