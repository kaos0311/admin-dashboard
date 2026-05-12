"use client";

import type { ReactNode } from "react";

import type { PatientStatus, PatientTaskPriority } from "../lib/patientTypes";

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
    <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

export function NoteBox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>
      <textarea
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        className="w-full resize-y rounded-2xl border border-white/10 bg-black p-3 text-sm text-white outline-none focus:border-white/30"
      />
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "date";
}) {
  const id = `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label htmlFor={id}>
      <span className="mb-2 block text-xs text-zinc-400">{label}</span>
      <input
        id={id}
        title={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
      />
    </label>
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

export function DataQualityPill({ score }: { score: number }) {
  const styles =
    score < 70
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : score < 90
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${styles}`}>
      Data {score}%
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

export function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
      {label}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-right">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

export function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-white">{value || "—"}</p>
    </div>
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
        : "border-white/10 bg-black/30 text-zinc-300";

  return (
    <section className={`rounded-2xl border p-4 ${styles}`}>
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
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center gap-2 text-zinc-200">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  );
}

export function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
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
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}