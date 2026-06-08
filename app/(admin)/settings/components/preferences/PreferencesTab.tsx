import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, PreferenceSettings } from "../../settings-types";
import { glassPanel } from "../../styles/glass";
import { Field } from "../shared/Field";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { ToggleRow } from "../shared/ToggleRow";

type PreferencesTabProps = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

export function PreferencesTab({
  settings,
  setSettings,
}: PreferencesTabProps) {
  function updatePreferences<Key extends keyof PreferenceSettings>(
    key: Key,
    value: PreferenceSettings[Key]
  ) {
    setSettings((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }

  return (
    <section className={`${glassPanel} p-5`}>
      <SectionHeader
        eyebrow="Preferences"
        title="Application Preferences"
        description="Control default behavior, refresh timing, visual behavior, and common guardrails for internal users."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoCard title="Navigation Defaults">
          <div className="grid gap-4">
            <Field
              id="default-dashboard-route"
              label="Default Dashboard Route"
              value={settings.preferences.defaultDashboardRoute}
              onChange={(value) =>
                updatePreferences("defaultDashboardRoute", value)
              }
              placeholder="/dashboard"
            />

            <Field
              id="auto-refresh-minutes"
              label="Auto Refresh Minutes"
              type="number"
              value={settings.preferences.autoRefreshMinutes}
              onChange={(value) =>
                updatePreferences("autoRefreshMinutes", Number(value))
              }
              placeholder="5"
            />
          </div>
        </InfoCard>

        <InfoCard
          title="Operational Guardrails"
          description="These settings reduce dumb mistakes. Not all dumb mistakes, obviously. That would require divine intervention."
        >
          <div className="grid gap-3">
            <ToggleRow
              title="Show PHI Warnings"
              description="Display reminders around protected patient data workflows."
              checked={settings.preferences.showPhiWarnings}
              onChange={(checked) =>
                updatePreferences("showPhiWarnings", checked)
              }
            />

            <ToggleRow
              title="Require Delete Confirmations"
              description="Require confirmation before destructive record actions."
              checked={settings.preferences.requireDeleteConfirmations}
              onChange={(checked) =>
                updatePreferences("requireDeleteConfirmations", checked)
              }
            />
          </div>
        </InfoCard>

        <InfoCard title="Interface Behavior">
          <div className="grid gap-3">
            <ToggleRow
              title="Compact Tables"
              description="Reduce spacing in large data tables."
              checked={settings.preferences.compactTables}
              onChange={(checked) =>
                updatePreferences("compactTables", checked)
              }
            />

            <ToggleRow
              title="Enable Animations"
              description="Allow motion effects and page transitions."
              checked={settings.preferences.enableAnimations}
              onChange={(checked) =>
                updatePreferences("enableAnimations", checked)
              }
            />
          </div>
        </InfoCard>
      </div>
    </section>
  );
}



