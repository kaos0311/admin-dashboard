"use client";

import { Banknote } from "lucide-react";

import { PurchaseTable } from "../../../../../components/PatientTables";
import type { PatientDetailProps } from "./patient-detail-types";

import { Section } from "../PatientUI";

const FULL_WIDTH_SECTION = "md:col-span-3";

export function PatientPurchasesSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const purchases = selected.purchasesLast90Days ?? [];

  return (
    <Section
      title="Purchases Last 90 Days"
      icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
    >
      <div className={FULL_WIDTH_SECTION}>
        <PurchaseTable items={purchases} />
      </div>
    </Section>
  );
}
