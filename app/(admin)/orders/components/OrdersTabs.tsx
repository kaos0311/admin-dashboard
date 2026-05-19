"use client";

import type { FilterTab } from "../lib/orderTypes";

export function OrdersTabs({
  tab,
  tabs,
  onTabChange,
}: {
  tab: FilterTab;
  tabs: Array<{
    key: FilterTab;
    label: string;
    count?: number;
  }>;
  onTabChange: (tab: FilterTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((item) => {
        const active = tab === item.key;

        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onTabChange(item.key)}
            className={`rounded-2xl border px-4 py-2 text-sm font-semibold shadow-inner shadow-black/20 backdrop-blur-xl transition ${
              active
                ? "border-cyan-400/35 bg-cyan-400/15 text-cyan-100"
                : "border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09]"
            }`}
          >
            {item.label} ({item.count ?? 0})
          </button>
        );
      })}
    </div>
  );
}