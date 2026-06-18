"use client";

import type { FilterTab } from "../lib/orderTypes";
import { badges } from "@/theme";

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
            className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-inner shadow-black/20 backdrop-blur-xl transition ${active ? badges.active : badges.neutral}`}
          >
            {item.label} ({item.count ?? 0})
          </button>
        );
      })}
    </div>
  );
}



