"use client";

import { badges, glass, typography } from "@/theme";

import {
  CheckCircle2,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";

type BatchHealthPanelProps = {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
};

export function BatchHealthPanel({
  queued,
  processing,
  completed,
  failed,
}: BatchHealthPanelProps) {
  return (
    <section className={`${glass.panel} p-5`}>
      <div className="mb-5">
        <h2 className={typography.sectionTitle}>
          Upload Queue Health
        </h2>

        <p className={`mt-1 ${typography.bodyMuted}`}>
          Active upload state across the local queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PanelStat
          icon={<Clock3 className="h-5 w-5" />}
          label="Queued"
          value={queued}
          tone="neutral"
        />

        <PanelStat
          icon={<Loader2 className="h-5 w-5 animate-spin" />}
          label="Processing"
          value={processing}
          tone="blue"
        />

        <PanelStat
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed"
          value={completed}
          tone="emerald"
        />

        <PanelStat
          icon={<XCircle className="h-5 w-5" />}
          label="Failed"
          value={failed}
          tone="rose"
        />
      </div>
    </section>
  );
}

function PanelStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "blue" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? badges.info
      : tone === "emerald"
        ? badges.success
        : tone === "rose"
          ? badges.danger
          : badges.neutral;

  return (
    <div
      className={`rounded-2xl border p-4 ${toneClass}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="mt-2 text-2xl font-bold">
            {value}
          </p>
        </div>

        <div className={`${glass.inset} p-2`}>
          {icon}
        </div>
      </div>
    </div>
  );
}





