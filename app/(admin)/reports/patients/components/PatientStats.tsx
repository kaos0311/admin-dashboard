"use client";

import { UserRound } from "lucide-react";

import { colors, glass, spacing, typography } from "@/theme";

import type { PatientStats as PatientStatsType } from "../lib/patientTypes";
import { PATIENT_LIMIT } from "../lib/patientUtils";
import { Stat } from "./PatientUI";

export function PatientStats({ stats }: { stats: PatientStatsType }) {
  return (
    <header className={`${glass.panelPadded} ${glass.panelBefore}`}>
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className={glass.chip}>
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Owner-ready patient command panel</span>
          </div>

          <h1 className={`mt-4 ${typography.pageTitle}`}>Patient Index</h1>

          <p className={`mt-2 max-w-3xl ${typography.bodyMuted}`}>
            Review patient identity, birthdays, insurance, CPAP, equipment,
            delivery, billing, PAR/CMN, WIP, risk flags, care tasks, retention
            status, and internal notes from one place.
          </p>

          <p className={`mt-2 ${typography.helper}`}>
            Live Firestore view. Showing up to{" "}
            <span className={colors.textSecondary}>
              {PATIENT_LIMIT.toLocaleString()}
            </span>{" "}
            indexed records.
          </p>
        </div>

        <div className={`${spacing.gridResponsive} xl:grid-cols-11`}>
          <Stat label="Total" value={stats.total} />
          <Stat label="Active" value={stats.active} />
          <Stat label="Archived" value={stats.archived} />
          <Stat label="Eligible" value={stats.destroyEligible} />
          <Stat label="Birthdays" value={stats.birthdays} />
          <Stat label="Today" value={stats.todayBirthdays} />
          <Stat label="CPAP" value={stats.cpap} />
          <Stat label="Equip." value={stats.equipment} />
          <Stat label="Risk" value={stats.highRisk} />
          <Stat label="Tasks" value={stats.openTasks} />
          <Stat label="Data" value={stats.poorData} />
        </div>
      </div>
    </header>
  );
}
