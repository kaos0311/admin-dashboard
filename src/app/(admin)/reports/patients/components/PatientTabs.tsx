"use client";

import type { ReactNode } from "react";

import {
  Archive,
  Cake,
  ClipboardCheck,
  Flag,
  HeartPulse,
  Trash2,
  UserRound,
} from "lucide-react";

import { glass, spacing } from "@/theme";

import type { PatientStats, PatientTab } from "../lib/patientTypes";
import { getCurrentMonthName } from "../lib/patientUtils";

function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${glass.listItem} ${
        active ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-50" : ""
      }`}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>

      <span
        className={`${glass.chip} shrink-0 ${
          active ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : ""
        }`}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}

export function PatientTabs({
  tab,
  stats,
  setTab,
}: {
  tab: PatientTab;
  stats: PatientStats;
  setTab: (tab: PatientTab) => void;
}) {
  return (
    <section
      aria-label="Patient index filters"
      className={`${spacing.gridResponsive} xl:grid-cols-7`}
    >
      <TabButton
        active={tab === "active"}
        icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
        label="Active"
        count={stats.active}
        onClick={() => setTab("active")}
      />

      <TabButton
        active={tab === "archived"}
        icon={<Archive className="h-4 w-4" aria-hidden="true" />}
        label="Archived"
        count={stats.archived}
        onClick={() => setTab("archived")}
      />

      <TabButton
        active={tab === "destroyEligible"}
        icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        label="Destroy"
        count={stats.destroyEligible}
        onClick={() => setTab("destroyEligible")}
      />

      <TabButton
        active={tab === "birthdays"}
        icon={<Cake className="h-4 w-4" aria-hidden="true" />}
        label={getCurrentMonthName()}
        count={stats.birthdays}
        onClick={() => setTab("birthdays")}
      />

      <TabButton
        active={tab === "cpap"}
        icon={<HeartPulse className="h-4 w-4" aria-hidden="true" />}
        label="CPAP"
        count={stats.cpap}
        onClick={() => setTab("cpap")}
      />

      <TabButton
        active={tab === "highRisk"}
        icon={<Flag className="h-4 w-4" aria-hidden="true" />}
        label="Risk"
        count={stats.highRisk}
        onClick={() => setTab("highRisk")}
      />

      <TabButton
        active={tab === "tasks"}
        icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
        label="Tasks"
        count={stats.openTasks}
        onClick={() => setTab("tasks")}
      />
    </section>
  );
}

