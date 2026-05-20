"use client";

import type { ReactNode } from "react";
import {
  Building2,
  Lock,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import type { TabKey } from "../settings-types";

export function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
    {
      key: "company",
      label: "Company",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      key: "preferences",
      label: "Preferences",
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
    {
      key: "users",
      label: "Users",
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: "security",
      label: "Security",
      icon: <Lock className="h-4 w-4" />,
    },
    {
      key: "danger",
      label: "Danger Zone",
      icon: <ShieldAlert className="h-4 w-4" />,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b1220] p-2">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              title={tab.label}
              aria-label={tab.label}
              onClick={() => onChange(tab.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}