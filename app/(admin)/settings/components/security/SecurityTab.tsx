"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ChevronRight, Lock, RefreshCcw } from "lucide-react";

import { secondaryButtonClass } from "../../settings-constants";
import type { AuditLogRow } from "../../settings-types";

type Props = {
  currentEmail: string;
  currentUid: string;
  adminCount: number | null;
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
  onRefreshActivity: () => void;
};

export function SecurityTab({
  currentEmail,
  currentUid,
  adminCount,
  recentActivity,
  activityLoading,
  onRefreshActivity,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Lock className="h-5 w-5 text-cyan-300" />}
          title="Security Overview"
          description="Quick production checks for the current admin session."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoCard label="Current admin email" value={currentEmail || "Unknown"} />
          <InfoCard label="Current user UID" value={currentUid || "Unknown"} />
          <InfoCard
            label="Admin accounts"
            value={adminCount === null ? "Unable to count" : adminCount.toString()}
          />
          <InfoCard label="Audit logging" value="Enabled on admin actions" />
          <InfoCard label="Self-disable protection" value="Enabled" />
          <InfoCard label="Last-admin protection" value="Enabled" />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Password resets, account deletion, role changes, maintenance changes,
          and database resets should always appear in the full Audit Logs page.
        </div>
      </section>

      <RecentActivityCard
        recentActivity={recentActivity}
        activityLoading={activityLoading}
        onRefresh={onRefreshActivity}
      />
    </div>
  );
}

function RecentActivityCard({
  recentActivity,
  activityLoading,
  onRefresh,
}: {
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <SectionHeader
          icon={<Activity className="h-5 w-5 text-cyan-300" />}
          title="Recent Admin Activity"
          description="Last few admin actions. Full investigation stays on the Audit Logs page."
        />

        <button
          type="button"
          title="Refresh activity"
          aria-label="Refresh activity"
          onClick={onRefresh}
          className={secondaryButtonClass}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {activityLoading ? (
        <div className="rounded-xl border border-white/10 bg-[#07090d] p-4 text-sm text-zinc-400">
          Loading activity...
        </div>
      ) : recentActivity.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#07090d] p-4 text-sm text-zinc-400">
          No recent activity found.
        </div>
      ) : (
        <div className="space-y-3">
          {recentActivity.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/10 bg-[#07090d] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-white">{row.action}</div>
                <div className="text-xs text-zinc-500">{row.createdAtText}</div>
              </div>

              <div className="mt-1 text-xs text-zinc-400">
                Actor: {row.actorEmail}
              </div>

              {row.targetEmail ? (
                <div className="mt-1 text-xs text-zinc-500">
                  Target: {row.targetEmail}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/audit-logs"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200"
      >
        View full audit log
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>

      <div>
        <h2 className="text-lg font-semibold">{title}</h2>

        {description ? (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07090d] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-white">{value}</p>
    </div>
  );
}