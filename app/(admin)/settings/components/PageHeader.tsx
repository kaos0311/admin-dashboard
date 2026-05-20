"use client";

import { AlertTriangle, Loader2, RotateCcw, Save } from "lucide-react";

import {
  primaryButtonClass,
  secondaryButtonClass,
} from "../settings-constants";

export function PageHeader({
  hasUnsavedSettings,
  savingSettings,
  onSave,
  onReset,
}: {
  hasUnsavedSettings: boolean;
  savingSettings: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>

        <p className="mt-1 text-sm text-zinc-400">
          Manage company defaults, users, security controls, imports,
          maintenance mode, and reset tools.
        </p>

        {hasUnsavedSettings ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Unsaved changes
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          title="Reset Changes"
          aria-label="Reset Changes"
          onClick={onReset}
          disabled={!hasUnsavedSettings || savingSettings}
          className={secondaryButtonClass}
        >
          <RotateCcw className="h-4 w-4" />
          Reset Changes
        </button>

        <button
          type="button"
          title="Save Settings"
          aria-label="Save Settings"
          onClick={onSave}
          disabled={!hasUnsavedSettings || savingSettings}
          className={primaryButtonClass}
        >
          {savingSettings ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {savingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}