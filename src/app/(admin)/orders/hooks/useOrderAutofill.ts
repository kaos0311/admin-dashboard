"use client";

import { useEffect, useMemo, useState } from "react";

import { OrderRepository } from "@/repositories/firestore/order.repository";
import { useBrightreeReferences } from "@/app/hooks/useBrightreeReferences";

import type {
  FacilityAutofillOption,
  PatientAutofillOption,
  ProductAutofillOption,
} from "@/repositories/firestore/order.types";

type InsuranceReference = {
  name?: string;
};

export function useOrderAutofill() {
  const brightreeReferences = useBrightreeReferences();
  const [patients, setPatients] = useState<PatientAutofillOption[]>([]);
  const [products, setProducts] = useState<ProductAutofillOption[]>([]);
  const [facilities, setFacilities] = useState<FacilityAutofillOption[]>([]);

  useEffect(() => {
    const unsubscribePatients = OrderRepository.subscribeToPatientsForAutofill(
      setPatients,
    );

    const unsubscribeProducts = OrderRepository.subscribeToProductsForAutofill(
      setProducts,
    );

    const unsubscribeFacilities =
      OrderRepository.subscribeToFacilitiesForAutofill(setFacilities);

    return () => {
      unsubscribePatients();
      unsubscribeProducts();
      unsubscribeFacilities();
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
    [brightreeReferences.insuranceCompanies, facilities, patients, products],
  );
}