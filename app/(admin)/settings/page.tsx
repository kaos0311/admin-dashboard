"use client";

import { useMemo, useState } from "react";

import {
  Bot,
  Building2,
  ClipboardList,
  Code2,
  Globe2,
  Loader2,
  LockKeyhole,
  PackageCheck,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Undo2,
  Users,
} from "lucide-react";

import { buttons, colors, glass, typography } from "@/theme";
import AdminOnly from "@/app/components/auth/AdminOnly";

import { SETTINGS_TABS } from "./settings-constants";
import type { SettingsTabKey } from "./settings-types";
import { hasSettingsChanged } from "./settings-utils";

import { useSettingsPage } from "./hooks/use-settings-page";

import { ApiRegistryTab } from "./components/apis/ApiRegistryTab";
import { BrightreeReferencesTab } from "./components/brightree/BrightreeReferencesTab";
import { ImprovementsTab } from "./components/improvements/ImprovementsTab";
import { CompanyTab } from "./components/company/CompanyTab";
import { DangerTab } from "./components/danger/DangerTab";
import { InventoryTab } from "./components/inventory/InventoryTab";
import { MessageCard } from "./components/MessageCard";
import { PageHeader } from "./components/PageHeader";
import { PreferencesTab } from "./components/preferences/PreferencesTab";
import { SecurityTab } from "./components/security/SecurityTab";
import { TabBar } from "./components/TabBar";
import { UsersTab } from "./components/users/UsersTab";
import { VendorResearchTab } from "./components/vendor-research/VendorResearchTab";

const tabIcons: Record<SettingsTabKey, React.ReactNode> = {
  company: <Building2 className="h-4 w-4" />,
  preferences: <SlidersHorizontal className="h-4 w-4" />,
  inventory: <PackageCheck className="h-4 w-4" />,
  brightree: <ClipboardList className="h-4 w-4" />,
  apis: <Code2 className="h-4 w-4" />,
  "vendor-research": <Globe2 className="h-4 w-4" />,
  improvements: <Bot className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  security: <LockKeyhole className="h-4 w-4" />,
  danger: <ShieldAlert className="h-4 w-4" />,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("company");

  const {
    settings,
    savedSettings,
    setSettings,
    users,
    userDraft,
    setUserDraft,
    passwordResetForm,
    setPasswordResetForm,
    loading,
    saving,
    message,
    saveSettings,
    resetSettings,
    createUserDraft,
    resetEmployeePassword,
    updateUserRole,
    updateUserStatus,
  } = useSettingsPage();

  const changed = useMemo(() => {
    return hasSettingsChanged(settings, savedSettings);
  }, [settings, savedSettings]);

  const tabs = useMemo(() => {
    return SETTINGS_TABS.map((tab) => ({
      ...tab,
      icon: tabIcons[tab.key],
    }));
  }, []);

  return (
    <AdminOnly>
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className={glass.shell}>
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                System Configuration
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Settings Command Center
                </h1>

                <p className={`mt-3 max-w-3xl ${typography.body}`}>
                  Manage company defaults, Command Center behavior, user access,
                  role controls, security settings, maintenance mode, and reset
                  tools. This is the room where one bad click can make the whole
                  building smell like burnt wiring.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resetSettings}
                disabled={!changed || saving}
                className={buttons.secondary}
              >
                <Undo2 className="h-4 w-4" />
                Reset Changes
              </button>

              <button
                type="button"
                onClick={saveSettings}
                disabled={!changed || saving}
                className={buttons.primary}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </button>
            </div>
          </div>
        </section>

        <PageHeader
          title="Settings"
          description="Manage company defaults, users, security controls, maintenance mode, and reset tools."
          action={null}
        />

        {message ? <MessageCard message={message} /> : null}

        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {loading ? (
          <section className={glass.panel}>
            <div className={colors.grid} />

            <div className="relative flex min-h-64 items-center justify-center p-6">
              <div className={`flex items-center gap-3 text-sm ${typography.bodyMuted}`}>
                <Loader2 className="h-5 w-5 animate-spin text-sky-200" />
                Loading settings...
              </div>
            </div>
          </section>
        ) : (
          <>
            {activeTab === "company" ? (
              <CompanyTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "preferences" ? (
              <PreferencesTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "inventory" ? (
              <InventoryTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "brightree" ? (
              <BrightreeReferencesTab
                settings={settings}
                setSettings={setSettings}
              />
            ) : null}

            {activeTab === "apis" ? <ApiRegistryTab /> : null}

            {activeTab === "vendor-research" ? (
              <VendorResearchTab />
            ) : null}

            {activeTab === "improvements" ? (
              <ImprovementsTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "users" ? (
              <UsersTab
                users={users}
                userDraft={userDraft}
                setUserDraft={setUserDraft}
                passwordResetForm={passwordResetForm}
                setPasswordResetForm={setPasswordResetForm}
                onCreateUser={createUserDraft}
                onResetPassword={resetEmployeePassword}
                onUpdateRole={updateUserRole}
                onUpdateStatus={updateUserStatus}
              />
            ) : null}

            {activeTab === "security" ? (
              <SecurityTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "danger" ? <DangerTab /> : null}
          </>
        )}
        </div>
      </main>
    </AdminOnly>
  );
}

