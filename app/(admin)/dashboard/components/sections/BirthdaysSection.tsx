"use client";

import { CalendarDays } from "lucide-react";

import type { BirthdayAnalytics } from "../../dashboard-types";
import { safeNumber } from "../../utils/normalize";
import { GlassPanel } from "../../shared/GlassPanel";

type BirthdaysSectionProps = {
  birthdays: BirthdayAnalytics;
};

export function BirthdaysSection({
  birthdays,
}: BirthdaysSectionProps) {
  return (
    <GlassPanel
      title="Birthdays"
      icon={<CalendarDays className="h-5 w-5" />}
    >
      <div className="grid gap-3">
        <div className="rounded-2xl bg-black/20 p-4">
          <p className="text-xs text-white/50">Today</p>

          <p className="text-2xl font-bold">
            {safeNumber(birthdays.todayCount) ||
              birthdays.today?.length ||
              0}
          </p>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <p className="text-xs text-white/50">
            Next 7 Days
          </p>

          <p className="text-2xl font-bold">
            {safeNumber(birthdays.next7DaysCount) ||
              birthdays.next7Days?.length ||
              0}
          </p>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <p className="text-xs text-white/50">
            This Month
          </p>

          <p className="text-2xl font-bold">
            {safeNumber(birthdays.thisMonthCount) ||
              birthdays.thisMonth?.length ||
              0}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}