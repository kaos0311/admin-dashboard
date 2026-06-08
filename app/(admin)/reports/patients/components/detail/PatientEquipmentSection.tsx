"use client";

import { PackageCheck } from "lucide-react";

import { EquipmentTable } from "../../../../../components/PatientTables";
import type { PatientDetailProps } from "./patient-detail-types";

import { Section } from "../PatientUI";

const SECTION_FULL_WIDTH_CLASS = "md:col-span-3";

export function PatientEquipmentSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const equipmentItems = selected.currentEquipment ?? [];

  return (
    <Section
      title="Current Equipment"
      icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
    >
      <div className={SECTION_FULL_WIDTH_CLASS}>
        <EquipmentTable items={equipmentItems} />
      </div>
    </Section>
  );
}

