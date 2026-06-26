import { tiles } from "@/theme";
import type { PatientRecord, PatientTask } from "../patient-detail-types";

import { StatCard } from "./PatientDetailPrimitives";

type Props = {
  patient: PatientRecord;
  openTasks: PatientTask[];
  riskScore: number;
};

export function PatientStatsGrid({ patient, openTasks, riskScore }: Props) {
  return (
    <section className={tiles.gridMetrics}>
      <StatCard label="Open Tasks" value={openTasks.length} />

      <StatCard
        label="Equipment"
        value={
          patient.currentEquipmentCount || patient.currentEquipment?.length || 0
        }
      />

      <StatCard
        label="90-Day Purchases"
        value={
          patient.purchasesLast90DaysCount ||
          patient.purchasesLast90Days?.length ||
          0
        }
      />

      <StatCard label="Risk Score" value={riskScore} />
    </section>
  );
}


