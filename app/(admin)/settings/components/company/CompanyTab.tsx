import type { Dispatch, SetStateAction } from "react";
import { glass } from "@/theme";
import type { AppSettings, CompanySettings } from "../../settings-types";
import { Field } from "../shared/Field";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { RecentActivityCard } from "./RecentActivityCard";

type CompanyTabProps = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

export function CompanyTab({ settings, setSettings }: CompanyTabProps) {
  function updateCompany<Key extends keyof CompanySettings>(
    key: Key,
    value: CompanySettings[Key]
  ) {
    setSettings((current) => ({
      ...current,
      company: {
        ...current.company,
        [key]: value,
      },
    }));
  }

  return (
    <section className={`${glass.card} p-5`}>
      <SectionHeader
        eyebrow="Company"
        title="Company Defaults"
        description="Set business identity, contact information, and location defaults used across operational pages. Boring stuff, until itâ€™s wrong on paperwork and everyone starts acting surprised."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="grid gap-5 lg:col-span-2">
          <InfoCard
            title="Business Identity"
            description="These values should match how the company should appear internally and on generated operational summaries."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                id="company-name"
                label="Company Name"
                value={settings.company.companyName}
                onChange={(value) => updateCompany("companyName", value)}
                placeholder="Advanced Home Medical"
              />

              <Field
                id="legal-name"
                label="Legal Name"
                value={settings.company.legalName}
                onChange={(value) => updateCompany("legalName", value)}
                placeholder="Legal business name"
              />

              <Field
                id="company-website"
                label="Website"
                type="url"
                value={settings.company.website}
                onChange={(value) => updateCompany("website", value)}
                placeholder="https://advhomemed.com"
              />

              <Field
                id="company-timezone"
                label="Timezone"
                value={settings.company.timezone}
                onChange={(value) => updateCompany("timezone", value)}
                placeholder="America/Chicago"
              />
            </div>
          </InfoCard>

          <InfoCard title="Contact Information">
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                id="company-phone"
                label="Phone"
                type="tel"
                value={settings.company.phone}
                onChange={(value) => updateCompany("phone", value)}
                placeholder="Main phone"
              />

              <Field
                id="company-fax"
                label="Fax"
                type="tel"
                value={settings.company.fax}
                onChange={(value) => updateCompany("fax", value)}
                placeholder="Fax"
              />

              <Field
                id="company-email"
                label="Email"
                type="email"
                value={settings.company.email}
                onChange={(value) => updateCompany("email", value)}
                placeholder="office@example.com"
              />
            </div>
          </InfoCard>

          <InfoCard title="Primary Address">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  id="address-line-1"
                  label="Address Line 1"
                  value={settings.company.addressLine1}
                  onChange={(value) => updateCompany("addressLine1", value)}
                  placeholder="Street address"
                />
              </div>

              <div className="md:col-span-2">
                <Field
                  id="address-line-2"
                  label="Address Line 2"
                  value={settings.company.addressLine2}
                  onChange={(value) => updateCompany("addressLine2", value)}
                  placeholder="Suite, unit, building"
                />
              </div>

              <Field
                id="company-city"
                label="City"
                value={settings.company.city}
                onChange={(value) => updateCompany("city", value)}
                placeholder="City"
              />

              <Field
                id="company-state"
                label="State"
                value={settings.company.state}
                onChange={(value) => updateCompany("state", value)}
                placeholder="KY"
              />

              <Field
                id="company-zip"
                label="ZIP"
                value={settings.company.zip}
                onChange={(value) => updateCompany("zip", value)}
                placeholder="ZIP code"
              />
            </div>
          </InfoCard>
        </div>

        <div className="grid content-start gap-5">
          <RecentActivityCard />

          <InfoCard
            title="PHI Reminder"
            description="Do not store patient identifiers in company settings. Keep this section business-only, because compliance mistakes age like milk in a hot truck."
          />
        </div>
      </div>
    </section>
  );
}



