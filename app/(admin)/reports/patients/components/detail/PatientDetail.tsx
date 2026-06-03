"use client";


import type { PatientDetailProps } from "./patient-detail-types";

import { PatientBillingSection } from "./PatientBillingSection";
import { PatientCpapSection } from "./PatientCpapSection";
import { PatientDeliverySection } from "./PatientDeliverySection";
import { PatientEquipmentSection } from "./PatientEquipmentSection";
import { PatientHeader } from "./PatientHeader";
import { PatientIdentitySection } from "./PatientIdentitySection";
import { PatientInsuranceSection } from "./PatientInsuranceSection";
import { PatientPurchasesSection } from "./PatientPurchasesSection";
import { PatientRiskFlags } from "./PatientRiskFlags";

export function PatientDetail(props: PatientDetailProps) {
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

      {/* Roadmap */}
      {/* <PatientTasksSection /> */}
      {/* <PatientNotesSection /> */}
      {/* <PatientRetentionSection /> */}
    </div>
  );
}

