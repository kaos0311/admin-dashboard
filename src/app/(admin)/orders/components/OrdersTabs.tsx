"use client";

import type { FilterTab } from "../lib/orderTypes";
import { colors, tiles } from "@/theme";

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
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition border ${active ? "border-[#7a9a5e]/40 bg-[#7a9a5e]/10 text-[#9aba7e]" : colors.neutral}`}
          >
            {item.label} ({item.count ?? 0})
          </button>
        );
      })}
    </div>
  );
}
