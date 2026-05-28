import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, SecuritySettings } from "../../settings-types";
import { glassPanel } from "../../styles/glass";
import { Field } from "../shared/Field";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { ToggleRow } from "../shared/ToggleRow";

type SecurityTabProps = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

export function SecurityTab({ settings, setSettings }: SecurityTabProps) {
  function updateSecurity<Key extends keyof SecuritySettings>(
    key: Key,
    value: SecuritySettings[Key]
  ) {
    setSettings((current) => ({
      ...current,
      security: {
        ...current.security,
        [key]: value,
      },
    }));
  }

  return (
    <section className={`${glassPanel} p-5`}>
      <SectionHeader
        eyebrow="Security"
        title="Security Controls"
        description="Manage access guardrails, maintenance behavior, export permissions, and audit expectations."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoCard title="Access Controls">
          <div className="grid gap-3">
            <ToggleRow
              title="Require Admin For Report Reset"
              description="Only admins should be able to reset imported report data."
              checked={settings.security.requireAdminForReportsReset}
              onChange={(checked) =>
                updateSecurity("requireAdminForReportsReset", checked)
              }
            />

            <ToggleRow
              title="Require Admin For User Management"
              description="Only admins should create or modify app users."
              checked={settings.security.requireAdminForUserManagement}
              onChange={(checked) =>
                updateSecurity("requireAdminForUserManagement", checked)
              }
            />

            <ToggleRow
              title="Allow Staff Exports"
              description="Allow staff users to export internal records. Disable if PHI exposure risk is high."
              checked={settings.security.allowStaffExports}
              onChange={(checked) =>
                updateSecurity("allowStaffExports", checked)
              }
            />
          </div>
        </InfoCard>

        <InfoCard title="System Controls">
          <div className="grid gap-3">
            <ToggleRow
              title="Maintenance Mode"
              description="Restrict normal access during maintenance windows."
              checked={settings.security.maintenanceMode}
              onChange={(checked) =>
                updateSecurity("maintenanceMode", checked)
              }
            />

            <ToggleRow
              title="Audit Settings Changes"
              description="Record settings changes to audit logs once server-side logging is wired."
              checked={settings.security.auditSettingsChanges}
              onChange={(checked) =>
                updateSecurity("auditSettingsChanges", checked)
              }
            />

            <Field
              id="session-timeout-minutes"
              label="Session Timeout Minutes"
              type="number"
              value={settings.security.sessionTimeoutMinutes}
              onChange={(value) =>
                updateSecurity("sessionTimeoutMinutes", Number(value))
              }
              placeholder="60"
            />
          </div>
        </InfoCard>

        <div className="lg:col-span-2">
          <InfoCard
            title="HIPAA Position"
            description="This page should store security preferences and operational flags only. Do not store PHI here. Patient-specific records belong behind authenticated report, patient, order, rental, or audit collections with proper Firestore rules."
          />
        </div>
      </div>
    </section>
  );
}
