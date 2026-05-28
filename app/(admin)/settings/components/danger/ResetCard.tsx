"use client";

import { useState } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

import { dangerButton } from "../../styles/glass";
import { InfoCard } from "../shared/InfoCard";

const CONFIRM_TEXT = "RESET REPORTS";

type SoftResetReportsResult = {
  ok?: boolean;
  deletedCounts?: Record<string, number>;
  message?: string;
};

export function ResetCard() {
  const [confirmation, setConfirmation] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReset = confirmation.trim() === CONFIRM_TEXT && !running;

  async function handleResetReports() {
    if (!canReset) return;

    const finalConfirm = window.confirm(
      "This will reset imported reports and report-derived collections. This is destructive. Continue?"
    );

    if (!finalConfirm) return;

    setRunning(true);
    setStatus(null);
    setError(null);

    try {
      const functions = getFunctions(getApp(), "us-central1");

      const softResetReports = httpsCallable<
        { confirmationText: string },
        SoftResetReportsResult
      >(functions, "softResetReports");

      const result = await softResetReports({
        confirmationText: CONFIRM_TEXT,
      });

      setStatus(
        result.data.message ||
          "Imported reports reset completed. Re-upload reports to rebuild data."
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

  return (
    <InfoCard
      title="Reset Imported Reports"
      description="Runs the admin-only Cloud Function reset with confirmation text, role checks, and audit logging. Finally, civilization."
    >
      <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />

          <div>
            <p className="text-sm font-semibold text-red-50">
              Destructive operation
            </p>
            <p className="mt-1 text-sm leading-6 text-red-100/80">
              Type <span className="font-bold text-red-50">{CONFIRM_TEXT}</span>{" "}
              to reset imported reports, rows, indexes, analytics, and derived
              report data.
            </p>
          </div>
        </div>

        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={running}
          placeholder={CONFIRM_TEXT}
          className="mt-4 w-full rounded-2xl border border-red-300/20 bg-black/30 px-4 py-3 text-sm text-red-50 outline-none placeholder:text-red-200/30 focus:border-red-200/50"
        />

        {status ? (
          <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {status}
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-300/20 bg-red-950/40 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleResetReports}
          disabled={!canReset}
          className={`${dangerButton} mt-4 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {running ? "Resetting..." : "Reset Reports"}
        </button>
      </div>
    </InfoCard>
  );
}
