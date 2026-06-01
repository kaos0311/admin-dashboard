"use client";

import { Banknote } from "lucide-react";

import { PurchaseTable } from "../../../../../components/PatientTables";
import type { PatientDetailProps } from "./patient-detail-types";

import { Section } from "../PatientUI";

export function PatientPurchasesSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="Purchases Last 90 Days"
      icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="md:col-span-3">
        <PurchaseTable items={selected.purchasesLast90Days ?? []} />
      </div>
    </Section>
  );
}


