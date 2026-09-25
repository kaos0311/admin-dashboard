"use client";

import { useEffect, useState } from "react";
import { getApp } from "firebase/app";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { alerts, badges, buttons, forms, glass, typography } from "@/theme";
import { ProgressStyles } from "./ProgressStyles";

const CONFIRM_TEXT = "RESET REPORTS";
const RESET_DB_CONFIRM = "RESET DATABASE";

type SoftResetReportsResult = {
  ok?: boolean;
  deletedCounts?: Record<string, number>;
  message?: string;
};

type ResetOperationalDatabaseResult = {
  ok?: boolean;
  clearedCollections?: string[];
  deletedCounts?: Record<string, number>;
};

type ResetProgress = {
  status: string;
  stage: string;
  currentCollection: string;
  currentFileName: string;
  deletedDocuments: number;
  totalDocuments: number;
  completedCollections: number;
  totalCollections: number;
  processedFiles: number;
  totalFiles: number;
  progressPercent: number;
};

type RebuildEverythingResult = {
  ok?: boolean;
  totalFiles?: number;
  successfulFiles?: number;
  failedFiles?: number;
  totalRowsProcessed?: number;
  message?: string;
};

type ResetReportsPanelProps = {
  canResetReports: boolean;
};

export function ResetReportsPanel({
  canResetReports,
}: ResetReportsPanelProps) {
  const [confirmation, setConfirmation] = useState("");
  const [resetDbConfirmation, setResetDbConfirmation] = useState("");
  const [runningOperation, setRunningOperation] = useState<
    "reports-reset" | "db-reset" | "rebuild" | null
  >(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resetDbStatus, setResetDbStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetDbError, setResetDbError] = useState<string | null>(null);
  const [resetDbResult, setResetDbResult] =
    useState<ResetOperationalDatabaseResult | null>(null);
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState<ResetProgress | null>(null);

  const canRunReportsReset =
    canResetReports &&
    confirmation.trim() === CONFIRM_TEXT &&
    runningOperation === null;
  const canRunDbReset =
    canResetReports &&
    resetDbConfirmation.trim() === RESET_DB_CONFIRM &&
    runningOperation === null;
  const canRunRebuild =
    canResetReports && runningOperation === null;

  useEffect(() => {
    if (!jobId) return undefined;

    return onSnapshot(doc(db, "systemJobs", jobId), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();

      setProgress({
        status: String(data.status ?? ""),
        stage: String(data.stage ?? ""),
        currentCollection: String(data.currentCollection ?? ""),
        currentFileName: String(data.currentFileName ?? ""),
        deletedDocuments: Number(data.deletedDocuments ?? 0),
        totalDocuments: Number(data.totalDocuments ?? 0),
        completedCollections: Number(data.completedCollections ?? 0),
        totalCollections: Number(data.totalCollections ?? 0),
        processedFiles: Number(data.processedFiles ?? 0),
        totalFiles: Number(data.totalFiles ?? 0),
        progressPercent: Math.max(
          0,
          Math.min(100, Number(data.progressPercent ?? 0))
        ),
      });
    });
  }, [jobId]);

  function buildJobId(prefix: "reports-reset" | "reports-rebuild") {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function startProgress(operation: "reports-reset" | "rebuild", nextJobId: string) {
    setRunningOperation(operation);
    setStatus(null);
    setError(null);
    setJobId(nextJobId);
    setProgress({
      status: "processing",
      stage: "starting",
      currentCollection: "",
      currentFileName: "",
      deletedDocuments: 0,
      totalDocuments: 0,
      completedCollections: 0,
      totalCollections: 0,
      processedFiles: 0,
      totalFiles: 0,
      progressPercent: 0,
    });
  }

  async function handleResetReports() {
    if (!canRunReportsReset) return;

    const finalConfirm = window.confirm(
      "This will zero out imported reports and report-derived data so fresh uploads can rebuild them. Continue?"
    );

    if (!finalConfirm) return;

    const nextResetJobId = buildJobId("reports-reset");
    startProgress("reports-reset", nextResetJobId);

    try {
      const functions = getFunctions(getApp(), "us-central1");
      const softResetReports = httpsCallable<
        { confirmationText: string; resetJobId: string },
        SoftResetReportsResult
      >(functions, "softResetReports");

      const result = await softResetReports({
        confirmationText: CONFIRM_TEXT,
        resetJobId: nextResetJobId,
      });

      setStatus(
        result.data.message ||
          "Operational report data reset completed."
      );
      setConfirmation("");
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Reset failed. Check Cloud Function logs.";

      setError(message);
    } finally {
      setRunningOperation(null);
    }
  }

  async function handleResetTestData() {
    if (!canRunDbReset) return;

    const finalConfirm = window.confirm(
      "This will permanently remove ALL test and operational data created during report-import testing, including orders, inventory, patients, rentals, and analytics. This action cannot be undone. Continue?"
    );

    if (!finalConfirm) return;

    setRunningOperation("db-reset");
    setResetDbStatus(null);
    setResetDbError(null);
    setResetDbResult(null);

    try {
      const functions = getFunctions(getApp(), "us-central1");
      const resetOperationalDatabase = httpsCallable<
        { confirmText: string },
        ResetOperationalDatabaseResult
      >(functions, "resetOperationalDatabase");

      const result = await resetOperationalDatabase({
        confirmText: RESET_DB_CONFIRM,
      });

      setResetDbResult(result.data);
      setResetDbStatus("Reset completed.");
      setResetDbConfirmation("");

      const totalDeleted = Object.values(result.data.deletedCounts ?? {}).reduce(
        (sum, count) => sum + count,
        0
      );

      toast.success(
        `Test data reset complete. ${totalDeleted.toLocaleString()} total records removed.`
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Reset failed. Check Cloud Function logs.";

      setResetDbError(message);
      toast.error(message);
    } finally {
      setRunningOperation(null);
    }
  }

  async function handleRebuildEverything() {
    if (!canRunRebuild) return;

    const finalConfirm = window.confirm(
      "This will rebuild operational report data from the latest uploaded files. Continue?"
    );

    if (!finalConfirm) return;

    const nextRebuildJobId = buildJobId("reports-rebuild");
    startProgress("rebuild", nextRebuildJobId);

    try {
      const functions = getFunctions(getApp(), "us-central1");
      const rebuildEverything = httpsCallable<
        { rebuildJobId: string; clearDerivedData: boolean },
        RebuildEverythingResult
      >(functions, "rebuildEverything");

      const result = await rebuildEverything({
        rebuildJobId: nextRebuildJobId,
        clearDerivedData: true,
      });

      setStatus(
        result.data.message ||
          `Rebuild completed for ${Number(
            result.data.successfulFiles ?? 0
          ).toLocaleString()} files.`
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Rebuild failed. Check Cloud Function logs.";

      setError(message);
    } finally {
      setRunningOperation(null);
    }
  }

  const visibleProgress =
    progress &&
    (runningOperation !== null || progress.progressPercent > 0);
  const progressLabel = progress
    ? runningOperation === "rebuild" || progress.totalFiles > 0
      ? `${progress.processedFiles.toLocaleString()} of ${progress.totalFiles.toLocaleString()} files rebuilt`
      : progress.totalDocuments > 0
      ? `${progress.deletedDocuments.toLocaleString()} of ${progress.totalDocuments.toLocaleString()} report records deleted`
      : `${progress.completedCollections.toLocaleString()} of ${progress.totalCollections.toLocaleString()} report areas cleared`
    : "";

  const dbTotalDeleted = resetDbResult
    ? Object.values(resetDbResult.deletedCounts ?? {}).reduce(
        (sum, count) => sum + count,
        0
      )
    : 0;

  return (
    <section
      className={[glass.card, "min-w-0 overflow-hidden p-5"].join(" ")}
      aria-labelledby="reset-reports-title"
    >
      <ProgressStyles />

      <div className="flex min-w-0 items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${badges.danger}`}
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className={`break-words text-xs font-semibold uppercase tracking-[0.18em] ${typography.caption}`}>
            Fresh Upload Prep
          </p>

          <h2 id="reset-reports-title" className={`${typography.metricCompact} break-words`}>
            Reset And Rebuild
          </h2>

          <p className={`mt-2 break-words text-sm leading-6 ${typography.bodyMuted}`}>
            Reset clears operational report-built collections. Rebuild reprocesses
            the latest uploaded source files into fresh patient, order, rental,
            inventory, and analytics views.
          </p>
        </div>
      </div>

      <div className={`mt-5 min-w-0 ${alerts.danger}`}>
        <p className="break-words text-sm leading-6">
          Type <span className="font-bold">{CONFIRM_TEXT}</span> to
          unlock the reset button. Rebuild can run without the typed confirmation.
          Admin access is required.
        </p>

        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={runningOperation !== null || !canResetReports}
          placeholder={CONFIRM_TEXT}
          className={`${forms.input} mt-4 w-full min-w-0`}
        />

        {!canResetReports ? (
          <p className={`mt-3 break-words px-3 py-2 text-sm ${alerts.warning}`}>
            Only admins can zero out imported report data.
          </p>
        ) : null}

        {status ? (
          <p className={`mt-3 break-words px-3 py-2 text-sm ${alerts.success}`}>
            {status}
          </p>
        ) : null}

        {error ? (
          <p className={`mt-3 break-words px-3 py-2 text-sm ${alerts.danger}`}>
            {error}
          </p>
        ) : null}

        {visibleProgress ? (
          <div className={`mt-4 min-w-0 p-3 ${glass.inset}`}>
            <div className={`flex min-w-0 flex-wrap items-center justify-between gap-3 ${typography.caption}`}>
              <span>Deletion Progress</span>
              <span>{progress.progressPercent}%</span>
            </div>

            <progress
              className={[
                "progressTrack mt-3",
                progress.progressPercent >= 100
                  ? "progressCompleted"
                  : "progressProcessing",
              ].join(" ")}
              value={progress.progressPercent}
              max={100}
              aria-label="Report reset deletion progress"
            />

            <p className={`mt-3 break-words text-sm ${typography.bodyMuted}`}>
              {progressLabel}
              {progress.currentCollection
                ? ` · Current: ${progress.currentCollection}`
                : progress.currentFileName
                  ? ` · Current: ${progress.currentFileName}`
                  : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleResetReports}
            disabled={!canRunReportsReset}
            className={`${buttons.danger} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {runningOperation === "reports-reset" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {runningOperation === "reports-reset"
              ? "Resetting..."
              : "Operational Reset"}
          </button>

          <button
            type="button"
            onClick={handleRebuildEverything}
            disabled={!canRunRebuild}
            className={`${buttons.secondary} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {runningOperation === "rebuild" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {runningOperation === "rebuild"
              ? "Rebuilding..."
              : "Full Rebuild"}
          </button>
        </div>
      </div>

      <div className={`mt-6 min-w-0 ${alerts.danger}`}>
        <div className="flex min-w-0 items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-6">
              Reset Test Data
            </p>
            <p className="mt-1 break-words text-sm leading-6">
              Permanently removes all test and operational data created during
              report-import testing, including orders, inventory, patients,
              rentals, analytics, and report-derived collections. System and
              reference data are preserved.
            </p>
          </div>
        </div>

        <input
          value={resetDbConfirmation}
          onChange={(event) => setResetDbConfirmation(event.target.value)}
          disabled={runningOperation !== null || !canResetReports}
          placeholder={RESET_DB_CONFIRM}
          className={`${forms.input} mt-4 w-full min-w-0`}
        />

        {!canResetReports ? (
          <p className={`mt-3 break-words px-3 py-2 text-sm ${alerts.warning}`}>
            Only admins can reset test data.
          </p>
        ) : null}

        {resetDbStatus ? (
          <p className={`mt-3 break-words px-3 py-2 text-sm ${alerts.success}`}>
            {resetDbStatus}{" "}
            {dbTotalDeleted > 0
              ? `Total records removed: ${dbTotalDeleted.toLocaleString()}.`
              : null}
            {resetDbResult?.clearedCollections?.length ? (
              <span className="mt-1 block text-xs opacity-80">
                Cleared: {resetDbResult.clearedCollections.join(", ")}
              </span>
            ) : null}
          </p>
        ) : null}

        {resetDbError ? (
          <p className={`mt-3 break-words px-3 py-2 text-sm ${alerts.danger}`}>
            {resetDbError}
          </p>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleResetTestData}
            disabled={!canRunDbReset}
            className={`${buttons.danger} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {runningOperation === "db-reset" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {runningOperation === "db-reset"
              ? "Resetting..."
              : "Reset Test Data"}
          </button>
        </div>
      </div>
    </section>
  );
}
