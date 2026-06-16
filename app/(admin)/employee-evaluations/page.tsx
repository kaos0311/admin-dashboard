"use client";

import AuthGuard from "@/app/components/auth/AuthGuard";
import { colors, glass, spacing, typography } from "@/theme";

import { EmployeeEvaluationSection } from "../dashboard/components/sections/EmployeeEvaluationSection";

export default function EmployeeEvaluationsPage() {
  return (
    <AuthGuard
      allow={["tank"]}
      loadingMessage="Verifying Tank access..."
    >
      <main className={`${glass.page} ${colors.app}`}>
        <div aria-hidden="true" className={colors.grid} />
        <div aria-hidden="true" className={colors.vignette} />

        <div className={`${glass.shell} ${spacing.page} ${spacing.stack}`}>
          <section className={`${glass.cardPadded}`}>
            <p className={typography.eyebrow}>Tank Level</p>
            <h1 className={`${typography.pageTitle} mt-2`}>
              Employee Evaluations
            </h1>
            <p className={`${typography.bodyMuted} mt-3 max-w-3xl`}>
              Boss-only yearly evaluation records, running comments, and
              snapshots.
            </p>
          </section>

          <EmployeeEvaluationSection isAdmin={true} />
        </div>
      </main>
    </AuthGuard>
  );
}
