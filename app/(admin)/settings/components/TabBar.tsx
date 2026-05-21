import type { ReactNode } from "react";
import type { SettingsTabKey } from "../settings-types";
import { glassPanel } from "../styles/glass";

type TabItem = {
  key: SettingsTabKey;
  label: string;
  icon?: ReactNode;
};

type TabBarProps = {
  tabs: TabItem[];
  activeTab: SettingsTabKey;
  onChange: (tab: SettingsTabKey) => void;
};

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <nav className={`${glassPanel} p-2`} aria-label="Settings sections">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={[
                "inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition",
                active
                  ? "border border-cyan-300/50 bg-cyan-300/15 text-cyan-100 shadow-lg shadow-cyan-950/25"
                  : "border border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}