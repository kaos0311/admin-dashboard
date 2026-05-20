"use client";

import { DangerTab } from "./components/DangerTab";
import { MessageCard } from "./components/MessageCard";
import { PageHeader } from "./components/PageHeader";
import { TabBar } from "./components/TabBar";
import { useSettingsPage } from "./use-settings-page";

export default function SettingsPage() {
  const state = useSettingsPage();

  if (state.roleLoading || state.settingsLoading || state.usersLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6 text-sm text-zinc-400">
        Loading settings...
      </div>
    );
  }

  if (!state.isAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        hasUnsavedSettings={state.hasUnsavedSettings}
        savingSettings={state.savingSettings}
        onSave={state.saveSettings}
        onReset={state.resetUnsavedSettings}
      />

      {state.errorMessage ? (
        <MessageCard tone="error">{state.errorMessage}</MessageCard>
      ) : null}

      {state.saveMessage ? (
        <MessageCard tone="success">{state.saveMessage}</MessageCard>
      ) : null}

      <TabBar activeTab={state.activeTab} onChange={state.setActiveTab} />

      {state.activeTab === "company" ? (
        <PlaceholderTab
          title="Company"
          message="Company tab is not split into its own component yet."
        />
      ) : null}

      {state.activeTab === "preferences" ? (
        <PlaceholderTab
          title="Preferences"
          message="Preferences tab is not split into its own component yet."
        />
      ) : null}

      {state.activeTab === "users" ? (
        <PlaceholderTab
          title="Users"
          message="Users tab is not split into its own component yet."
        />
      ) : null}

      {state.activeTab === "security" ? (
        <PlaceholderTab
          title="Security"
          message="Security tab is not split into its own component yet."
        />
      ) : null}

      {state.activeTab === "danger" ? (
        <DangerTab
          softResetConfirm={state.softResetConfirm}
          setSoftResetConfirm={state.setSoftResetConfirm}
          softResetting={state.softResetting}
          softResetMessage={state.softResetMessage}
          onRunReportsSoftReset={state.runReportsSoftReset}
          databaseResetConfirm={state.databaseResetConfirm}
          setDatabaseResetConfirm={state.setDatabaseResetConfirm}
          databaseResetting={state.databaseResetting}
          databaseResetMessage={state.databaseResetMessage}
          onRunDatabaseReset={state.runDatabaseReset}
        />
      ) : null}
    </div>
  );
}

function PlaceholderTab({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{message}</p>
    </section>
  );
}