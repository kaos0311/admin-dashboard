"use client";

import { PackageCheck } from "lucide-react";

import { EquipmentTable } from "../../../../../components/PatientTables";
import type { PatientDetailProps } from "./patient-detail-types";

import { Section } from "../PatientUI";

export function PatientEquipmentSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="Current Equipment"
      icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="md:col-span-3">
        <EquipmentTable items={selected.currentEquipment ?? []} />
      </div>
    </Section>
  );
}