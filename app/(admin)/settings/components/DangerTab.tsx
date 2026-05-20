"use client";

import type { ReactNode } from "react";
import { Loader2, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";

type Props = {
  softResetConfirm: string;
  setSoftResetConfirm: (value: string) => void;
  softResetting: boolean;
  softResetMessage: string;
  onRunReportsSoftReset: () => void;

  databaseResetConfirm: string;
  setDatabaseResetConfirm: (value: string) => void;
  databaseResetting: boolean;
  databaseResetMessage: string;
  onRunDatabaseReset: () => void;
};

export function DangerTab({
  softResetConfirm,
  setSoftResetConfirm,
  softResetting,
  softResetMessage,
  onRunReportsSoftReset,
  databaseResetConfirm,
  setDatabaseResetConfirm,
  databaseResetting,
  databaseResetMessage,
  onRunDatabaseReset,
}: Props) {
  return (
    <section className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-black/30 p-3 text-red-300">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold text-red-100">Danger Zone</h2>

          <p className="mt-2 text-sm text-red-100/80">
            Destructive controls live here. This section is intentionally
            separated so nobody nukes production while looking for a theme
            toggle.
          </p>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <ResetCard
              title="Reports Soft Reset"
              description="Clears imported reports, report rows, patient indexes, hospice indexes, insurance indexes, analytics, and import jobs. It does not delete users, settings, products, orders, rentals, or uploaded Storage files."
              warning="Use this when report imports need to be rebuilt from scratch."
              confirmLabel="Type RESET REPORTS to confirm"
              confirmPlaceholder="RESET REPORTS"
              confirmValue={softResetConfirm}
              setConfirmValue={setSoftResetConfirm}
              expectedValue="RESET REPORTS"
              loading={softResetting}
              message={softResetMessage}
              buttonLabel="Soft Reset Reports"
              loadingLabel="Resetting Reports..."
              icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
              onRun={onRunReportsSoftReset}
            />

            <ResetCard
              title="Reset Operational Database"
              description="Clears operational collections so the system can start fresh with clean numbers, clean forms, clean dashboards, and empty report indexes. This preserves users, settings, and audit logs."
              warning="This is stronger than the reports reset. Do not run it unless you are intentionally wiping operational data."
              confirmLabel="Type RESET DATABASE to confirm"
              confirmPlaceholder="RESET DATABASE"
              confirmValue={databaseResetConfirm}
              setConfirmValue={setDatabaseResetConfirm}
              expectedValue="RESET DATABASE"
              loading={databaseResetting}
              message={databaseResetMessage}
              buttonLabel="Reset Operational Database"
              loadingLabel="Resetting Database..."
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              onRun={onRunDatabaseReset}
              stronger
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ResetCard({
  title,
  description,
  warning,
  confirmLabel,
  confirmPlaceholder,
  confirmValue,
  setConfirmValue,
  expectedValue,
  loading,
  message,
  buttonLabel,
  loadingLabel,
  icon,
  onRun,
  stronger = false,
}: {
  title: string;
  description: string;
  warning: string;
  confirmLabel: string;
  confirmPlaceholder: string;
  confirmValue: string;
  setConfirmValue: (value: string) => void;
  expectedValue: string;
  loading: boolean;
  message: string;
  buttonLabel: string;
  loadingLabel: string;
  icon: ReactNode;
  onRun: () => void;
  stronger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-black/30 p-5 ${
        stronger ? "border-red-500/30" : "border-red-500/20"
      }`}
    >
      <h3 className="font-semibold text-red-100">{title}</h3>

      <p className="mt-2 text-sm text-red-100/75">{description}</p>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
        {warning}
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-red-100">
          {confirmLabel}
        </span>

        <input
          title={confirmLabel}
          aria-label={confirmLabel}
          placeholder={confirmPlaceholder}
          value={confirmValue}
          onChange={(event) => setConfirmValue(event.target.value)}
          disabled={loading}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-400/50"
        />
      </label>

      {message ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-red-100">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        title={buttonLabel}
        aria-label={buttonLabel}
        onClick={onRun}
        disabled={loading || confirmValue !== expectedValue}
        className={`mt-5 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-red-100 transition disabled:cursor-not-allowed disabled:opacity-50 ${
          stronger
            ? "border-red-500/40 bg-red-600/25 hover:bg-red-600/35"
            : "border-red-500/30 bg-red-500/20 hover:bg-red-500/30"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingLabel}
          </>
        ) : (
          <>
            {icon}
            {buttonLabel}
          </>
        )}
      </button>
    </div>
  );
}