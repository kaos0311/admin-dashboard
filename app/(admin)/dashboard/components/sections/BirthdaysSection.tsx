"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { CalendarDays, ExternalLink, X } from "lucide-react";

import { glass, tiles, typography } from "@/theme";

import type {
  BirthdayAnalytics,
  BirthdayItem,
} from "../../dashboard-types";
import { safeNumber } from "../../utils/normalize";
import { GlassPanel } from "../../shared/GlassPanel";

type BirthdaysSectionProps = {
  birthdays: BirthdayAnalytics;
};

type BirthdayBucketKey = "today" | "next7Days" | "thisMonth";

type BirthdayBucket = {
  key: BirthdayBucketKey;
  title: string;
  count: number;
  patients: BirthdayItem[];
};

function getPatientChartHref(patient: BirthdayItem): string {
  return `/reports/patients/${encodeURIComponent(
    patient.patientId || patient.id
  )}`;
}

function isPatientDeceased(patient: BirthdayItem): boolean {
  return Boolean(
    patient.dateOfDeath?.trim() ||
      patient.dod?.trim()
  );
}

function formatBirthday(patient: BirthdayItem): string {
  if (patient.birthMonth && patient.birthDay) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(
      new Date(2000, patient.birthMonth - 1, patient.birthDay)
    );
  }

  if (patient.dateOfBirth || patient.birthday) {
    const date = new Date(
      patient.dateOfBirth || patient.birthday || ""
    );

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
    }
  }

  return "Birthday on file";
}

function hasBirthdayPassedThisMonth(patient: BirthdayItem): boolean {
  if (!patient.birthMonth || !patient.birthDay) {
    return false;
  }

  const today = new Date();

  return (
    patient.birthMonth === today.getMonth() + 1 &&
    patient.birthDay < today.getDate()
  );
}

function formatAgePhrase(
  patient: BirthdayItem,
  bucketKey: BirthdayBucketKey
): string {
  const didTurn =
    bucketKey === "thisMonth" &&
    hasBirthdayPassedThisMonth(patient);
  const age = didTurn
    ? patient.age || patient.nextAge
    : patient.nextAge || patient.age;

  if (!age) {
    return "";
  }

  return `, ${didTurn ? "turned" : "turning"} ${age}`;
}

function BirthdayBucketButton({
  bucket,
  onOpen,
}: {
  bucket: BirthdayBucket;
  onOpen: (bucket: BirthdayBucket) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(bucket)}
      className={`${glass.listItem} text-left`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={typography.caption}>{bucket.title}</p>

          <p className="text-2xl font-bold">
            {safeNumber(bucket.count)}
          </p>
        </div>

        <span className={tiles.badge}>View</span>
      </div>
    </button>
  );
}

function BirthdayModal({
  bucket,
  onClose,
}: {
  bucket: BirthdayBucket | null;
  onClose: () => void;
}) {
  if (!bucket) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthday-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <section
        className={`${glass.cardPadded} max-h-[88vh] w-full max-w-2xl overflow-y-auto`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`${tiles.header} mb-5`}>
          <div>
            <h2
              id="birthday-modal-title"
              className={typography.sectionTitle}
            >
              {bucket.title} Birthdays
            </h2>

            <p className={typography.bodyMuted}>
              {bucket.count} patient
              {bucket.count === 1 ? "" : "s"} found
            </p>
          </div>

          <button
            type="button"
            aria-label="Close birthdays"
            onClick={onClose}
            className={glass.iconBoxSm}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          {bucket.patients.length > 0 ? (
            bucket.patients.map((patient) => (
              <Link
                key={`${bucket.key}-${patient.id}`}
                href={getPatientChartHref(patient)}
                className={`${glass.listItem} flex items-center justify-between gap-4`}
              >
                <div className="min-w-0">
                  <p className={typography.bodyStrong}>
                    {patient.fullName || "Unknown Patient"}
                  </p>

                  <p className={typography.small}>
                    {formatBirthday(patient)}
                    {formatAgePhrase(patient, bucket.key)}
                  </p>
                </div>

                <ExternalLink className="h-4 w-4 shrink-0 text-cyan-200" />
              </Link>
            ))
          ) : (
            <div className={glass.emptyState}>
              <p className={typography.bodyMuted}>
                No birthdays found for this range.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function BirthdaysSection({
  birthdays,
}: BirthdaysSectionProps) {
  const [activeBucket, setActiveBucket] =
    useState<BirthdayBucket | null>(null);

  const buckets = useMemo<BirthdayBucket[]>(
    () => {
      const todayPatients = (birthdays.today || []).filter(
        (patient) => !isPatientDeceased(patient)
      );
      const next7DaysPatients = (
        birthdays.next7Days || []
      ).filter((patient) => !isPatientDeceased(patient));
      const thisMonthPatients = (
        birthdays.thisMonth || []
      ).filter((patient) => !isPatientDeceased(patient));

      return [
        {
          key: "today",
          title: "Today",
          count: todayPatients.length,
          patients: todayPatients,
        },
        {
          key: "next7Days",
          title: "Next 7 Days",
          count: next7DaysPatients.length,
          patients: next7DaysPatients,
        },
        {
          key: "thisMonth",
          title: "This Month",
          count: thisMonthPatients.length,
          patients: thisMonthPatients,
        },
      ];
    },
    [birthdays]
  );

  return (
    <>
      <GlassPanel
        title="Birthdays"
        icon={<CalendarDays className="h-5 w-5" />}
      >
        <div className="grid gap-3">
          {buckets.map((bucket) => (
            <BirthdayBucketButton
              key={bucket.key}
              bucket={bucket}
              onOpen={setActiveBucket}
            />
          ))}
        </div>
      </GlassPanel>

      <BirthdayModal
        bucket={activeBucket}
        onClose={() => setActiveBucket(null)}
      />
    </>
  );
}




