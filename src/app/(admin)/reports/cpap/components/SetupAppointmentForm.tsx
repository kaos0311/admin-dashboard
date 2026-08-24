"use client";

import { Plus } from "lucide-react";
import { buttons, forms, glass, typography } from "@/theme";
import { cx } from "../lib/cpapUtils";

type Props = {
  appointmentName: string;
  appointmentPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentNotes: string;
  savingAppointment: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function SetupAppointmentForm({
  appointmentName,
  appointmentPhone,
  appointmentDate,
  appointmentTime,
  appointmentNotes,
  savingAppointment,
  onNameChange,
  onPhoneChange,
  onDateChange,
  onTimeChange,
  onNotesChange,
  onSubmit,
}: Props) {
  return (
    <section className={glass.panelPadded}>
      <div className="mb-4 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Plus className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>Add Setup Appointment</h2>
          </div>
          <p className={typography.smallMuted}>
            Add a CPAP setup appointment date that will appear on the live calendar.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid min-w-0 gap-3 lg:grid-cols-[1fr_180px_150px_150px_auto]"
      >
        <label className={forms.field}>
          <span className={forms.label}>Patient Name</span>
          <input
            value={appointmentName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Name"
            className={forms.input}
          />
        </label>

        <label className={forms.field}>
          <span className={forms.label}>Phone</span>
          <input
            value={appointmentPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="Phone number"
            className={forms.input}
          />
        </label>

        <label className={forms.field}>
          <span className={forms.label}>Date</span>
          <input
            type="date"
            value={appointmentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={forms.input}
          />
        </label>

        <label className={forms.field}>
          <span className={forms.label}>Time</span>
          <input
            type="time"
            value={appointmentTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className={forms.input}
          />
        </label>

        <button type="submit" disabled={savingAppointment} className={`${buttons.primary} self-end`}>
          <Plus className="h-4 w-4" />
          Add
        </button>

        <label className={`${forms.field} lg:col-span-5`}>
          <span className={forms.label}>Notes</span>
          <input
            value={appointmentNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Setup details, equipment notes, or pickup instructions"
            className={forms.input}
          />
        </label>
      </form>
    </section>
  );
}
