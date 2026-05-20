"use client";

import type { ReactNode } from "react";
import {
  Filter,
  House,
  LayoutDashboard,
  Settings2,
  Wrench,
} from "lucide-react";

import { inputClass } from "../../settings-constants";
import type { AppSettings, HomeScreen, ThemeMode } from "../../settings-types";

type Props = {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
};

export function PreferencesTab({ settings, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-cyan-300" />}
          title="Layout Defaults"
          description="Control the dashboard’s default view and interface behavior."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Default Theme" id="default-theme">
            <select
              id="default-theme"
              title="Default Theme"
              aria-label="Default Theme"
              value={settings.defaultTheme}
              onChange={(event) =>
                onChange("defaultTheme", event.target.value as ThemeMode)
              }
              className={inputClass}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </Field>

          <Field label="Default Home Screen" id="default-home-screen">
            <select
              id="default-home-screen"
              title="Default Home Screen"
              aria-label="Default Home Screen"
              value={settings.defaultHomeScreen}
              onChange={(event) =>
                onChange("defaultHomeScreen", event.target.value as HomeScreen)
              }
              className={inputClass}
            >
              <option value="/dashboard">Dashboard</option>
              <option value="/dashboard/products">Products</option>
              <option value="/dashboard/orders">Orders</option>
              <option value="/dashboard/rentals">Rentals</option>
              <option value="/dashboard/users">Users</option>
              <option value="/dashboard/settings">Settings</option>
              <option value="/dashboard/reports">Reports</option>
            </select>
          </Field>
        </div>

        <div className="mt-6 space-y-4">
          <ToggleRow
            label="Compact tables"
            icon={<LayoutDashboard className="h-4 w-4 text-zinc-400" />}
            checked={settings.compactTables}
            onChange={(checked) => onChange("compactTables", checked)}
          />

          <ToggleRow
            label="Show dashboard counters"
            icon={<House className="h-4 w-4 text-zinc-400" />}
            checked={settings.showDashboardCounters}
            onChange={(checked) => onChange("showDashboardCounters", checked)}
          />

          <ToggleRow
            label="Enable order filters"
            icon={<Filter className="h-4 w-4 text-zinc-400" />}
            checked={settings.enableOrderFilters}
            onChange={(checked) => onChange("enableOrderFilters", checked)}
          />

          <ToggleRow
            label="Enable product filters"
            icon={<Filter className="h-4 w-4 text-zinc-400" />}
            checked={settings.enableProductFilters}
            onChange={(checked) => onChange("enableProductFilters", checked)}
          />

          <ToggleRow
            label="Enable rental filters"
            icon={<Filter className="h-4 w-4 text-zinc-400" />}
            checked={settings.enableRentalFilters}
            onChange={(checked) => onChange("enableRentalFilters", checked)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Wrench className="h-5 w-5 text-cyan-300" />}
          title="Maintenance & Imports"
          description="Production controls for uploads, parsing, indexing, and maintenance mode."
        />

        <div className="mt-6 space-y-4">
          <ToggleRow
            label="Maintenance mode"
            checked={settings.maintenanceMode}
            onChange={(checked) => onChange("maintenanceMode", checked)}
          />

          <ToggleRow
            label="Allow admins during maintenance"
            checked={settings.allowAdminsDuringMaintenance}
            onChange={(checked) =>
              onChange("allowAdminsDuringMaintenance", checked)
            }
          />

          <Field label="Maintenance Message" id="maintenance-message">
            <textarea
              id="maintenance-message"
              title="Maintenance Message"
              aria-label="Maintenance Message"
              placeholder="Maintenance Message"
              rows={3}
              value={settings.maintenanceMessage}
              onChange={(event) =>
                onChange("maintenanceMessage", event.target.value)
              }
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Allowed upload types" id="allowed-upload-types">
            <input
              id="allowed-upload-types"
              title="Allowed upload types"
              aria-label="Allowed upload types"
              placeholder=".csv,.pdf,.xlsx"
              value={settings.allowedUploadTypes}
              onChange={(event) =>
                onChange("allowedUploadTypes", event.target.value)
              }
              className={inputClass}
            />
          </Field>

          <Field label="Max upload size, MB" id="max-upload-size">
            <input
              id="max-upload-size"
              title="Max upload size, MB"
              aria-label="Max upload size, MB"
              placeholder="25"
              type="number"
              min={1}
              max={100}
              value={settings.maxUploadSizeMb}
              onChange={(event) =>
                onChange("maxUploadSizeMb", Number(event.target.value))
              }
              className={inputClass}
            />
          </Field>

          <ToggleRow
            label="PDF parsing enabled"
            checked={settings.pdfParsingEnabled}
            onChange={(checked) => onChange("pdfParsingEnabled", checked)}
          />

          <ToggleRow
            label="CSV parsing enabled"
            checked={settings.csvParsingEnabled}
            onChange={(checked) => onChange("csvParsingEnabled", checked)}
          />

          <ToggleRow
            label="Auto-index after upload"
            checked={settings.autoIndexAfterUpload}
            onChange={(checked) => onChange("autoIndexAfterUpload", checked)}
          />

          <ToggleRow
            label="Keep raw uploads in Storage"
            checked={settings.keepRawUploadsInStorage}
            onChange={(checked) => onChange("keepRawUploadsInStorage", checked)}
          />
        </div>
      </section>
    </div>
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
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#07090d] px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-zinc-200">
        {icon}
        {label}
      </span>

      <input
        title={label}
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}