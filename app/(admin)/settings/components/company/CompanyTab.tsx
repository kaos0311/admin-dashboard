"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, Building2, ChevronRight } from "lucide-react";

import { inputClass } from "../../settings-constants";
import type { AppSettings, AuditLogRow } from "../../settings-types";

type Props = {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
};

export function CompanyTab({
  settings,
  onChange,
  recentActivity,
  activityLoading,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Building2 className="h-5 w-5 text-cyan-300" />}
          title="Company Information"
          description="These values can be reused across invoices, reports, headers, and admin views."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company Name" id="company-name">
            <input
              id="company-name"
              title="Company Name"
              aria-label="Company Name"
              placeholder="Company Name"
              value={settings.companyName}
              onChange={(event) => onChange("companyName", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Company Phone" id="company-phone">
            <input
              id="company-phone"
              title="Company Phone"
              aria-label="Company Phone"
              placeholder="Company Phone"
              value={settings.companyPhone}
              onChange={(event) => onChange("companyPhone", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Company Email" id="company-email">
            <input
              id="company-email"
              title="Company Email"
              aria-label="Company Email"
              placeholder="Company Email"
              value={settings.companyEmail}
              onChange={(event) => onChange("companyEmail", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Company Address" id="company-address" wide>
            <textarea
              id="company-address"
              title="Company Address"
              aria-label="Company Address"
              placeholder="Company Address"
              rows={4}
              value={settings.companyAddress}
              onChange={(event) =>
                onChange("companyAddress", event.target.value)
              }
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>
      </section>

      <RecentActivityCard
        recentActivity={recentActivity}
        activityLoading={activityLoading}
      />
    </div>
  );
}

function RecentActivityCard({
  recentActivity,
  activityLoading,
}: {
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <SectionHeader
        icon={<Activity className="h-5 w-5 text-cyan-300" />}
        title="Recent Admin Activity"
        description="Last few admin actions. Full investigation stays on the Audit Logs page."
      />

      <div className="mt-5">
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
                  <div className="text-xs text-zinc-500">
                    {row.createdAtText}
                  </div>
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
      </div>

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

function Field({
  label,
  id,
  children,
  wide = false,
}: {
  label: string;
  id: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-sm text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}