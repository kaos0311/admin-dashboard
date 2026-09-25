"use client";

import { CalendarDays } from "lucide-react";
import type { CalendarEvent } from "../types";
import { buttons, glass, typography } from "@/theme";
import { cx, toIsoDate } from "../lib/cpapUtils";

type Props = {
  monthLabel: string;
  visibleCalendarDays: Date[];
  selectedCalendarDate: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  selectedDayEvents: CalendarEvent[];
  selectedCalendarMonthDate: Date;
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export function CalendarView({
  monthLabel: label,
  visibleCalendarDays,
  selectedCalendarDate,
  eventsByDate,
  selectedDayEvents,
  selectedCalendarMonthDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: Props) {
  return (
    <section className={glass.panelPadded}>
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>CPAP Calendar</h2>
          </div>
          <p className={typography.smallMuted}>
            Appointments, setup dates, supply eligibility, and 48-hour pickup grace items.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onPreviousMonth} className={buttons.secondary}>
            Previous
          </button>
          <span className={cx(typography.bodyStrong, "min-w-32 text-center")}>{label}</span>
          <button type="button" onClick={onNextMonth} className={buttons.secondary}>
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold uppercase tracking-wide text-cyan-100/70"
          >
            {day}
          </div>
        ))}
        {visibleCalendarDays.map((day) => {
          const dateKey = toIsoDate(day);
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const isCurrentMonth = day.getMonth() === selectedCalendarMonthDate.getMonth();
          const isSelected = selectedCalendarDate === dateKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={cx(
                glass.insetPadded,
                "min-h-24 text-left",
                !isCurrentMonth && "opacity-40",
                isSelected && "ring-1 ring-cyan-300/60",
              )}
            >
              <span className={typography.caption}>{day.getDate()}</span>
              <div className="mt-2 space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <p key={event.id} className={cx(typography.smallMuted, "truncate")}>
                    {event.title || event.detail}
                  </p>
                ))}
                {dayEvents.length > 3 ? (
                  <p className={typography.smallMuted}>+{dayEvents.length - 3} more</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {selectedDayEvents.length === 0 && (
          <p className={typography.bodyMuted}>
            No CPAP events for {formatDate(selectedCalendarDate)}.
          </p>
        )}
      </div>
    </section>
  );
}
