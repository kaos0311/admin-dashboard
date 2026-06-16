"use client";

import { useEffect, useState } from "react";
import { getApp } from "firebase/app";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

import { db } from "@/lib/firebase";
import { alerts, badges, buttons, forms, glass, typography } from "@/theme";
import { ProgressStyles } from "./ProgressStyles";

const CONFIRM_TEXT = "RESET REPORTS";

type SoftResetReportsResult = {
  ok?: boolean;
  deletedCounts?: Record<string, number>;
  message?: string;
};

type ResetProgress = {
  status: string;
  stage: string;
  currentCollection: string;
  deletedDocuments: number;
  totalDocuments: number;
  completedCollections: number;
  totalCollections: number;
  progressPercent: number;
};

type ResetReportsPanelProps = {
  canResetReports: boolean;
};

export function ResetReportsPanel({
  canResetReports,
}: ResetReportsPanelProps) {
  const [confirmation, setConfirmation] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetJobId, setResetJobId] = useState("");
  const [progress, setProgress] = useState<ResetProgress | null>(null);

  const canRunReset =
    canResetReports && confirmation.trim() === CONFIRM_TEXT && !running;

  useEffect(() => {
    if (!resetJobId) return undefined;

    return onSnapshot(doc(db, "systemJobs", resetJobId), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();

      setProgress({
        status: String(data.status ?? ""),
        stage: String(data.stage ?? ""),
        currentCollection: String(data.currentCollection ?? ""),
        deletedDocuments: Number(data.deletedDocuments ?? 0),
        totalDocuments: Number(data.totalDocuments ?? 0),
        completedCollections: Number(data.completedCollections ?? 0),
        totalCollections: Number(data.totalCollections ?? 0),
        progressPercent: Math.max(
          0,
          Math.min(100, Number(data.progressPercent ?? 0))
        ),
      });
    });
  }, [resetJobId]);

  async function handleResetReports() {
    if (!canRunReset) return;

    const finalConfirm = window.confirm(
      "This will zero out imported reports and report-derived data so fresh uploads can rebuild them. Continue?"
    );

    if (!finalConfirm) return;

    setRunning(true);
    setStatus(null);
    setError(null);
    setProgress({
      status: "processing",
      stage: "starting",
      currentCollection: "",
      deletedDocuments: 0,
      totalDocuments: 0,
      completedCollections: 0,
      totalCollections: 0,
      progressPercent: 0,
    });

    const nextResetJobId = `reports-reset-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    setResetJobId(nextResetJobId);

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
          "Report data reset completed. Upload fresh reports to rebuild the database views."
      );
      setConfirmation("");
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Reset failed. Check Cloud Function logs.";

      setError(message);
    } finally {
      setRunning(false);
    }
  }

  const visibleProgress = progress && (running || progress.progressPercent > 0);
  const progressLabel = progress
    ? progress.totalDocuments > 0
      ? `${progress.deletedDocuments.toLocaleString()} of ${progress.totalDocuments.toLocaleString()} report records deleted`
      : `${progress.completedCollections.toLocaleString()} of ${progress.totalCollections.toLocaleString()} report areas cleared`
    : "";

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
            Zero Out Report Data
          </h2>

          <p className={`mt-2 break-words text-sm leading-6 ${typography.bodyMuted}`}>
            Clears imported reports, rows, indexes, analytics, and report-built
            views so new uploads can rebuild cleanly.
          </p>
        </div>
      </div>

      <div className={`mt-5 min-w-0 ${alerts.danger}`}>
        <p className="break-words text-sm leading-6">
          Type <span className="font-bold">{CONFIRM_TEXT}</span> to
          unlock the reset button. Admin access is required.
        </p>

        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={running || !canResetReports}
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
                : ""}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleResetReports}
          disabled={!canRunReset}
          className={`${buttons.danger} mt-4 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {running ? "Rebooting..." : "System Reboot"}
        </button>
      </div>
    </section>
  );
}
