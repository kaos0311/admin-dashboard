"use client";

import type { ReactNode } from "react";

import {
  alerts,
  badges,
  buttons,
  forms,
  glass,
  spacing,
  typography,
} from "@/theme";

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
    <section className={glass.cardPadded}>
      <div className={`${spacing.inlineMd} mb-4 ${typography.bodyStrong}`}>
        {icon}
        <h3 className={typography.cardTitle}>{title}</h3>
      </div>

      <div className={spacing.gridThree}>{children}</div>
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
    <div className={forms.field}>
      <label htmlFor={id} className={forms.label}>
        {label}
      </label>

      <textarea
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        className={forms.textarea}
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
    <label htmlFor={id} className={forms.field}>
      <span className={forms.label}>{label}</span>

      <input
        id={id}
        title={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={forms.input}
      />
    </label>
  );
}

function pillClass(tone: "success" | "warning" | "danger" | "neutral" | "info") {
  const toneClass = {
    success: badges.success,
    warning: badges.warning,
    danger: badges.danger,
    neutral: badges.neutral,
    info: badges.info,
  }[tone];

  return `${glass.chip} ${toneClass}`;
}

export function StatusPill({ status }: { status: PatientStatus }) {
  const tone =
    status === "active"
      ? "success"
      : status === "archived"
        ? "warning"
        : "danger";

  return <span className={pillClass(tone)}>{status}</span>;
}

export function RiskPill({ score }: { score: number }) {
  const tone = score >= 8 ? "danger" : score >= 5 ? "warning" : "success";

  return <span className={pillClass(tone)}>Risk {score}</span>;
}

export function DataQualityPill({ score }: { score: number }) {
  const tone = score < 70 ? "danger" : score < 90 ? "warning" : "success";

  return <span className={pillClass(tone)}>Data {score}%</span>;
}

export function TaskPriorityPill({
  priority,
}: {
  priority: PatientTaskPriority;
}) {
  const tone =
    priority === "urgent"
      ? "danger"
      : priority === "watch"
        ? "warning"
        : "neutral";

  return <span className={pillClass(tone)}>{priority}</span>;
}

export function Badge({ label }: { label: string }) {
  return <span className={pillClass("info")}>{label}</span>;
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${glass.insetPadded} text-right`}>
      <p className={typography.caption}>{label}</p>
      <p className={`mt-1 ${typography.metricSmall}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className={glass.insetPadded}>
      <p className={typography.caption}>{label}</p>
      <p className={`mt-1 break-words ${typography.bodyStrong}`}>
        {value || "—"}
      </p>
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
  const panelClass =
    tone === "amber"
      ? alerts.warning
      : tone === "red"
        ? alerts.danger
        : glass.cardPadded;

  return (
    <section className={panelClass}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>

        <div className="min-w-0">
          <h3 className={typography.bodyStrong}>{title}</h3>
          <div className={`mt-1 ${typography.body}`}>{children}</div>
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
    <div className={glass.emptyState}>
      <div className={`${spacing.inline} justify-center ${typography.bodyStrong}`}>
        {icon}
        <p>{title}</p>
      </div>

      <p className={`mt-2 ${typography.bodyFaint}`}>{message}</p>
    </div>
  );
}

export function LoadingList() {
  return (
    <div className={spacing.stackTight}>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className={`${glass.card} h-20 animate-pulse`}
          aria-hidden="true"
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
  const buttonClass =
    tone === "amber"
      ? buttons.warning
      : tone === "green"
        ? buttons.success
        : buttons.danger;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass}
    >
      {icon}
      {label}
    </button>
  );
}
