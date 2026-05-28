"use client";

import type { PatientDetailProps } from "./patient-detail-types";

import { PatientHeader } from "./PatientHeader";
import { PatientRiskFlags } from "./PatientRiskFlags";
import { PatientIdentitySection } from "./PatientIdentitySection";
import { PatientInsuranceSection } from "./PatientInsuranceSection";
import { PatientCpapSection } from "./PatientCpapSection";
import { PatientEquipmentSection } from "./PatientEquipmentSection";
import { PatientPurchasesSection } from "./PatientPurchasesSection";
import { PatientDeliverySection } from "./PatientDeliverySection";
import { PatientBillingSection } from "./PatientBillingSection";

export function PatientDetail(
  props: PatientDetailProps
) {
  return (
    <div className="space-y-6">
      <PatientHeader {...props} />

      <PatientRiskFlags {...props} />

      <PatientIdentitySection {...props} />

      <PatientInsuranceSection {...props} />

      <PatientCpapSection {...props} />

      <PatientEquipmentSection {...props} />

      <PatientPurchasesSection {...props} />

      <PatientDeliverySection {...props} />

      <PatientBillingSection {...props} />

      {/* NEXT */}
      {/* <PatientTasksSection /> */}
      {/* <PatientNotesSection /> */}
      {/* <PatientRetentionSection /> */}
    </div>
  );
}
