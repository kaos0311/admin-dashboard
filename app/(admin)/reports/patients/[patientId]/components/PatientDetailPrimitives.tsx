import type { ReactNode } from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import type {
  PatientStatus,
  PatientTaskPriority,
} from "../patient-detail-types";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_32%),linear-gradient(135deg,_#020617,_#020617_45%,_#020617)] px-4 py-6 text-white md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">{children}</div>
    </main>
  );
}

export function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      {children}
    </section>
  );
}

export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-2 text-cyan-100">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

export function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-white">
        {value || "—"}
      </p>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function StatusPill({ status }: { status: PatientStatus }) {
  const styles =
    status === "active"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : status === "archived"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-red-500/20 bg-red-500/10 text-red-200";

  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs capitalize ${styles}`}>
      {status}
    </span>
  );
}

export function RiskPill({ score }: { score: number }) {
  const styles =
    score >= 8
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : score >= 5
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${styles}`}>
      Risk {score}
    </span>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
      {label}
    </span>
  );
}

export function TaskPriorityPill({
  priority,
}: {
  priority: PatientTaskPriority;
}) {
  const styles =
    priority === "urgent"
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : priority === "watch"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-white/10 text-zinc-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${styles}`}>
      {priority}
    </span>
  );
}

export function StatusSmall({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs capitalize text-zinc-300">
      {label}
    </span>
  );
}

export function Panel({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: "amber" | "red" | "neutral";
  children: ReactNode;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
      : tone === "red"
        ? "border-red-500/20 bg-red-500/10 text-red-100"
        : "border-white/10 bg-black/25 text-zinc-300";

  return (
    <section className={`rounded-2xl border p-4 backdrop-blur-xl ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <div className="mt-1 text-sm opacity-90">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-zinc-200">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <PageShell>
      <GlassPanel>
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <ClipboardCheck className="h-5 w-5 animate-pulse text-cyan-200" />
          Loading patient record...
        </div>
      </GlassPanel>
    </PageShell>
  );
}

export function RecordCompletePanel() {
  return (
    <Panel
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Record Completeness"
      tone="neutral"
    >
      No major risk flags detected from indexed fields.
    </Panel>
  );
}

export function RiskFlagPanel({ flags }: { flags: string[] }) {
  return (
    <Panel
      icon={<ShieldAlert className="h-5 w-5" />}
      title="Risk / Completeness Flags"
      tone="red"
    >
      <div className="flex flex-wrap gap-2">
        {flags.map((flag) => (
          <span
            key={flag}
            className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-100"
          >
            {flag}
          </span>
        ))}
      </div>
    </Panel>
  );
}

export function ActionButton({
  tone,
  disabled,
  onClick,
  icon,
  label,
}: {
  tone: "amber" | "green" | "red";
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
      : tone === "green"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
        : "border-red-500/30 bg-red-600/10 text-red-100 hover:bg-red-600/20";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold backdrop-blur-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function SuccessIcon() {
  return <CheckCircle2 className="h-4 w-4" />;
}