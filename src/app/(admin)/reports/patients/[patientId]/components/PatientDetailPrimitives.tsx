import type { ReactNode } from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import {
  alerts,
  badges,
  buttons,
  colors,
  glass,
  spacing,
  typography,
} from "@/theme";

import type {
  PatientStatus,
  PatientTaskPriority,
} from "../patient-detail-types";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={[colors.app, colors.textPrimary, spacing.page].join(" ")}>
      <div className={[spacing.content, spacing.stack].join(" ")}>
        {children}
      </div>
    </main>
  );
}

export function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <section className={[glass.cardPadded, spacing.cardLg].join(" ")}>
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
    <section className={[glass.cardPadded, spacing.cardLg].join(" ")}>
      <div className={["mb-4", spacing.inline, typography.bodyStrong].join(" ")}>
        <div className={glass.iconBoxSm}>
          {icon}
        </div>

        <h3 className={typography.cardTitle}>
          {title}
        </h3>
      </div>

      <div className={spacing.gridThree}>
        {children}
      </div>
    </section>
  );
}

export function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className={[glass.insetPadded, "p-3"].join(" ")}>
      <p className={typography.smallMuted}>
        {label}
      </p>

      <p className={["mt-1 break-words", typography.bodyStrong].join(" ")}>
        {value || "—"}
      </p>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={[glass.cardPadded, "p-4"].join(" ")}>
      <p className={typography.smallMuted}>
        {label}
      </p>

      <p className={["mt-1", typography.metricCompact].join(" ")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function StatusPill({ status }: { status: PatientStatus }) {
  const styles =
    status === "active"
      ? badges.success
      : status === "archived"
        ? badges.warning
        : badges.danger;

  return (
    <span className={["shrink-0 rounded-full px-3 py-1 text-xs capitalize", styles].join(" ")}>
      {status}
    </span>
  );
}

export function RiskPill({ score }: { score: number }) {
  const styles =
    score >= 8
      ? badges.danger
      : score >= 5
        ? badges.warning
        : badges.success;

  return (
    <span className={["rounded-full px-3 py-1 text-xs", styles].join(" ")}>
      Risk {score}
    </span>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <span className={["rounded-full px-3 py-1 text-xs", badges.info].join(" ")}>
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
      ? badges.danger
      : priority === "watch"
        ? badges.warning
        : badges.neutral;

  return (
    <span className={["rounded-full px-3 py-1 text-xs capitalize", styles].join(" ")}>
      {priority}
    </span>
  );
}

export function StatusSmall({ label }: { label: string }) {
  return (
    <span className={["rounded-full px-3 py-1 text-xs capitalize", badges.neutral].join(" ")}>
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
      ? alerts.warning
      : tone === "red"
        ? alerts.danger
        : glass.insetPadded;

  return (
    <section className={styles}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {icon}
        </div>

        <div>
          <h3 className={typography.bodyStrong}>
            {title}
          </h3>

          <div className={["mt-1", typography.bodyMuted].join(" ")}>
            {children}
          </div>
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
      <div className={[spacing.inline, typography.bodyStrong].join(" ")}>
        {icon}
        <p>{title}</p>
      </div>

      <p className={["mt-2", typography.bodyMuted].join(" ")}>
        {message}
      </p>
    </div>
  );
}

export function LoadingState() {
  return (
    <PageShell>
      <GlassPanel>
        <div className={[spacing.inlineMd, typography.bodyMuted].join(" ")}>
          <ClipboardCheck className="h-5 w-5 animate-pulse" />
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
            className={["rounded-full px-3 py-1 text-xs", badges.danger].join(" ")}
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
      ? buttons.warning
      : tone === "green"
        ? buttons.success
        : buttons.danger;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={styles}
    >
      {icon}
      {label}
    </button>
  );
}

export function SuccessIcon() {
  return <CheckCircle2 className="h-4 w-4" />;
}
