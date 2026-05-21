"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Loader2,
  LockKeyhole,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Undo2,
  Users,
} from "lucide-react";
import {
  SETTINGS_TABS,
} from "./settings-constants";
import type { SettingsTabKey } from "./settings-types";
import { hasSettingsChanged } from "./settings-utils";
import { useSettingsPage } from "./hooks/use-settings-page";
import { PageHeader } from "./components/PageHeader";
import { TabBar } from "./components/TabBar";
import { MessageCard } from "./components/MessageCard";
import { CompanyTab } from "./components/company/CompanyTab";
import { PreferencesTab } from "./components/preferences/PreferencesTab";
import { UsersTab } from "./components/users/UsersTab";
import { SecurityTab } from "./components/security/SecurityTab";
import { DangerTab } from "./components/danger/DangerTab";
import { glassButton, primaryButton } from "./styles/glass";

const tabIcons: Record<SettingsTabKey, React.ReactNode> = {
  company: <Building2 className="h-4 w-4" />,
  preferences: <SlidersHorizontal className="h-4 w-4" />,
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
    loading,
    saving,
    message,
    saveSettings,
    resetSettings,
    createUserDraft,
    updateUserRole,
    updateUserStatus,
  } = useSettingsPage();

  const changed = useMemo(
    () => hasSettingsChanged(settings, savedSettings),
    [settings, savedSettings]
  );

  const tabs = useMemo(
    () =>
      SETTINGS_TABS.map((tab) => ({
        ...tab,
        icon: tabIcons[tab.key],
      })),
    []
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.12),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#020617_48%,_#030712_100%)] px-4 py-6 text-white md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <PageHeader
          title="Settings"
          description="Manage company defaults, users, security controls, maintenance mode, and reset tools."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resetSettings}
                disabled={!changed || saving}
                className={glassButton}
              >
                <Undo2 className="h-4 w-4" />
                Reset Changes
              </button>

              <button
                type="button"
                onClick={saveSettings}
                disabled={!changed || saving}
                className={primaryButton}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </button>
            </div>
          }
        />

        {message ? <MessageCard message={message} /> : null}

        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.045]">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
              Loading settings...
            </div>
          </div>
        ) : (
          <>
            {activeTab === "company" ? (
              <CompanyTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "preferences" ? (
              <PreferencesTab settings={settings} setSettings={setSettings} />
            ) : null}

            {activeTab === "users" ? (
              <UsersTab
                users={users}
                userDraft={userDraft}
                setUserDraft={setUserDraft}
                onCreateUser={createUserDraft}
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
  );
}