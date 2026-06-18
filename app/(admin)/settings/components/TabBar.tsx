import type { ReactNode } from "react";
import { badges, colors, glass, typography } from "@/theme";
import type { SettingsTabKey } from "../settings-types";

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
    <nav className={`${glass.card} p-2`} aria-label="Settings sections">
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
                  ? badges.active
                  : `border border-transparent ${typography.bodyMuted} ${colors.surfaceHover} hover:text-slate-100`,
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
