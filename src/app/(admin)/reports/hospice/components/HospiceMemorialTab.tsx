import { Heart } from "lucide-react";

import { glass, tiles, typography } from "@/theme";

import type { MemorialPatient } from "../hospice-types";

type HospiceMemorialTabProps = {
  patients: readonly MemorialPatient[];
};

export function HospiceMemorialTab({
  patients,
}: HospiceMemorialTabProps) {
  return (
    <section
      aria-labelledby="hospice-memorial-heading"
      className={`${glass.panel} relative min-w-0 overflow-visible`}
    >
      <div className="relative z-10 min-w-0 p-4 sm:p-6">
        <div className="mb-5 flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className={tiles.icon}>
              <Heart className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h2
                id="hospice-memorial-heading"
                className={`${typography.sectionTitle} min-w-0 break-words`}
              >
                Memorial
              </h2>

              <p className={`${typography.bodyMuted} mt-1`}>
                Recent hospice passings from the last five years, listed by date
                of death.
              </p>
            </div>
          </div>
        </div>

        {patients.length ? (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {patients.map((patient) => (
              <article
                key={`${patient.id}-${patient.dateOfDeath}`}
                className={`${glass.card} relative min-w-0 overflow-hidden p-5 pt-14`}
              >
                <FloralLines />

                <div className="relative z-10 min-w-0">
                  <p className={`${typography.cardTitle} break-words`}>
                    {patient.patientName}
                  </p>

                  <dl className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                    <div className={tiles.compact}>
                      <dt className={typography.label}>DOB</dt>
                      <dd className={`${typography.bodyMuted} mt-1 break-words`}>
                        {patient.dateOfBirth}
                      </dd>
                    </div>

                    <div className={tiles.compact}>
                      <dt className={typography.label}>DOD</dt>
                      <dd className={`${typography.bodyMuted} mt-1 break-words`}>
                        {patient.dateOfDeath}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            className={`${typography.bodyMuted} rounded-2xl border border-white/10 bg-white/[0.04] p-5`}
          >
            No memorial records from the last five years.
          </div>
        )}
      </div>
    </section>
  );
}

function FloralLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-4 top-3 h-10 text-cyan-200/20"
      viewBox="0 0 320 42"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M4 30 C48 5 88 5 126 25 C148 36 171 36 194 25 C232 5 272 5 316 30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M72 18 C64 8 54 8 48 18 C57 19 64 21 72 18Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M248 18 C256 8 266 8 272 18 C263 19 256 21 248 18Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M154 24 C158 13 166 13 170 24 C165 22 159 22 154 24Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
