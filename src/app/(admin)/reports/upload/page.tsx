"use client";

import { useState } from "react";

import { colors, uploadUi } from "@/theme";

import type { ImportMode, ReportType } from "./upload-types";

import { useImportJobs } from "./hooks/useImportJobs";
import { usePatientIndexAnalytics } from "./hooks/usePatientIndexAnalytics";
import { useUploadQueue } from "./hooks/useUploadQueue";

import { UploadAccessGate } from "./components/UploadAccessGate";
import { UploadHero } from "./components/UploadHero";
import { PageErrorBanner } from "./components/PageErrorBanner";
import { UploadDropzone } from "./components/UploadDropzone";
import { UploadSettingsCards } from "./components/UploadSettingsCards";
import { UploadQueueList } from "./components/UploadQueueList";
import { PatientIndexPanel } from "./components/PatientIndexPanel";
import { ResetReportsPanel } from "./components/ResetReportsPanel";
import { UploadRulesPanel } from "./components/UploadRulesPanel";
import { ImportJobsTable } from "./components/ImportJobsTable";
export default function UploadReportsPage() {
  return (
    <UploadAccessGate>
      {({ authRole, user, role, canManageUploads }) => (
        <UploadReportsContent
          user={user ?? null}
          role={role}
          canManageUploads={canManageUploads}
          canResetReports={Boolean(authRole.canDeleteImports)}
        />
      )}
    </UploadAccessGate>
  );
}

type UploadReportsContentProps = {
  user: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  role: string | null;
  canManageUploads: boolean;
  canResetReports: boolean;
};

function UploadReportsContent({
  user,
  role,
  canManageUploads,
  canResetReports,
}: UploadReportsContentProps) {
  const [reportType, setReportType] = useState<ReportType>("auto");
  const [importMode, setImportMode] = useState<ImportMode>("append");

  const importJobs = useImportJobs({
    canManageUploads,
    user,
    role,
  });

  const uploads = useUploadQueue({
    canManageUploads,
    user,
    reportType,
    importMode,
    writeAuditLog: importJobs.writeAuditLog,
  });

  const patientAnalytics =
    usePatientIndexAnalytics(canManageUploads);

  return (
    <main className={`${uploadUi.page} ${colors.app}`}>
      <div className={colors.grid} aria-hidden="true" />

      <section className={uploadUi.shell}>
        <UploadHero
          recentJobsCount={importJobs.recentJobs.length}
          queueCounts={importJobs.queueCounts}
        />

        <PageErrorBanner
          message={importJobs.pageError}
          onDismiss={() => importJobs.setPageError(null)}
        />

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="min-w-0 space-y-6">
            <UploadDropzone
              fileInputRef={uploads.fileInputRef}
              hasActiveUploads={uploads.hasActiveUploads}
              onFilesSelected={uploads.handleFilesSelected}
            />

            <UploadSettingsCards
              reportType={reportType}
              setReportType={setReportType}
              importMode={importMode}
              setImportMode={setImportMode}
              hasActiveUploads={uploads.hasActiveUploads}
            />

            <UploadQueueList
              uploadQueue={uploads.uploadQueue}
              uploadSummary={uploads.uploadSummary}
              hasActiveUploads={uploads.hasActiveUploads}
              onClearCompletedUploads={
                uploads.handleClearCompletedUploads
              }
              onStartUploads={uploads.handleStartUploads}
              onRemoveQueuedUpload={
                uploads.handleRemoveQueuedUpload
              }
            />

            <ImportJobsTable
              filteredJobs={importJobs.filteredJobs}
              selectedJobIds={importJobs.selectedJobIds}
              selectedJobsCount={importJobs.selectedJobs.length}
              jobsLoading={importJobs.jobsLoading}
              busyJobIds={importJobs.busyJobIds}
              bulkBusy={importJobs.bulkBusy}
              queueFilter={importJobs.queueFilter}
              setQueueFilter={importJobs.setQueueFilter}
              queueSearch={importJobs.queueSearch}
              setQueueSearch={importJobs.setQueueSearch}
              queueCounts={importJobs.queueCounts}
              refreshJob={importJobs.refreshJob}
              deleteJob={importJobs.deleteJob}
              handleRefreshSelected={
                importJobs.handleRefreshSelected
              }
              handleDeleteSelected={
                importJobs.handleDeleteSelected
              }
              toggleSelectedJob={
                importJobs.toggleSelectedJob
              }
              toggleAllVisibleJobs={
                importJobs.toggleAllVisibleJobs
              }
            />
          </div>

          <aside className="min-w-0 space-y-6">
            <PatientIndexPanel
              patientIndex={patientAnalytics.patientIndex}
              analyticsLoading={
                patientAnalytics.analyticsLoading
              }
            />

            <ResetReportsPanel
              canResetReports={canResetReports}
            />

            <UploadRulesPanel />
          </aside>
        </section>
      </section>
    </main>
  );
}




