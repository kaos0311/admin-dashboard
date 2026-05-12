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
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-white bg-white text-black"
          : "border-white/10 bg-neutral-950 text-zinc-300 hover:bg-white/10"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>

      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          active ? "bg-black/10 text-black" : "bg-white/10 text-zinc-300"
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
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
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