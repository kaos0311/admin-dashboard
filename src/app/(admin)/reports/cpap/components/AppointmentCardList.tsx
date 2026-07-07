"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { formatDate } from "../../patients/lib/patientUtils";
import type { ManualSetupAppointment, SetupRow } from "../types";
import type { PatientWithDerived } from "../../patients/lib/patientTypes";
import { glass, typography } from "@/theme";
import { cx } from "../lib/cpapUtils";

type Props = {
  loading: boolean;
  appointmentsLoading: boolean;
  supplyPullsLoading: boolean;
  callNotesLoading: boolean;
  appointmentsWithPatient: Array<{
    appointment: ManualSetupAppointment;
    patient: PatientWithDerived | null;
  }>;
  setupRows: SetupRow[];
};

export function AppointmentCardList({
  loading,
  appointmentsLoading,
  supplyPullsLoading,
  callNotesLoading,
  appointmentsWithPatient,
  setupRows,
}: Props) {
  const isLoading = loading || appointmentsLoading || supplyPullsLoading || callNotesLoading;

  return (
    <section className={glass.panelPadded}>
      {isLoading ? (
        <p className={typography.bodyMuted}>Loading CPAP calendar...</p>
      ) : setupRows.length === 0 && appointmentsWithPatient.length === 0 ? (
        <p className={typography.bodyMuted}>
          No CPAP setup appointments or scheduled pickups are currently on file.
        </p>
      ) : (
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {appointmentsWithPatient.map(({ appointment, patient }) => {
            const content = (
              <>
                <p className={typography.caption}>
                  {formatDate(appointment.appointmentDate)}
                  {appointment.appointmentTime ? ` at ${appointment.appointmentTime}` : ""}
                </p>
                <p className={cx(typography.bodyStrong, "mt-1 break-words")}>
                  {appointment.patientName}
                </p>
                <p className={cx(typography.smallMuted, "mt-1 flex items-center gap-2 break-words")}>
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {appointment.phone}
                </p>
                {appointment.notes ? (
                  <p className={cx(typography.smallMuted, "mt-2 break-words")}>{appointment.notes}</p>
                ) : null}
              </>
            );

            return patient ? (
              <Link
                key={appointment.id}
                href={`/reports/patients/${patient.id}`}
                className={cx(glass.insetPadded, glass.cardHover, "block")}
              >
                {content}
              </Link>
            ) : (
              <article key={appointment.id} className={glass.insetPadded}>
                {content}
              </article>
            );
          })}

          {setupRows.map((row) => (
            <Link
              key={`${row.patient.id}-${row.label}-${row.date}`}
              href={`/reports/patients/${row.patient.id}`}
              className={cx(glass.insetPadded, glass.cardHover, "block")}
            >
              <p className={typography.caption}>{formatDate(row.date)}</p>
              <p className={cx(typography.bodyStrong, "mt-1 break-words")}>
                {row.patient.fullName || "Unnamed Patient"}
              </p>
              <p className={cx(typography.smallMuted, "mt-1 break-words")}>{row.label}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
