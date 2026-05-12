"use client";

import { UserRound } from "lucide-react";

import type { PatientStats as PatientStatsType } from "../lib/patientTypes";
import { PATIENT_LIMIT } from "../lib/patientUtils";
import { Stat } from "./PatientUI";

export function PatientStats({ stats }: { stats: PatientStatsType }) {
  return (
    <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] via-black to-black p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            Owner-ready patient command panel
          </div>

          <h1 className="text-3xl font-bold tracking-tight">Patient Index</h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Review patient identity, birthdays, insurance, CPAP, equipment,
            delivery, billing, PAR/CMN, WIP, risk flags, care tasks, retention
            status, and internal notes from one place.
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            Live Firestore view. Showing up to {PATIENT_LIMIT.toLocaleString()} indexed records.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-6 xl:grid-cols-11">
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