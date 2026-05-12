"use client";

import { useSyncExternalStore } from "react";
import {
  doc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AppTheme = "light" | "dark" | "system";

export type AppSettings = {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  defaultTheme: AppTheme;
  maintenanceMode: boolean;
  skipHospicePatientsOnRegularPages: boolean;
};

export type UseAppSettingsResult = {
  settings: AppSettings;
  loading: boolean;
  error: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  companyName: "Advanced Home Medical",
  companyPhone: "",
  companyEmail: "",
  companyAddress: "",
  defaultTheme: "dark",
  maintenanceMode: false,
  skipHospicePatientsOnRegularPages: true,
};

const INITIAL_SNAPSHOT: UseAppSettingsResult = {
  settings: DEFAULT_APP_SETTINGS,
  loading: true,
  error: "",
};

const DISABLED_SNAPSHOT: UseAppSettingsResult = {
  settings: DEFAULT_APP_SETTINGS,
  loading: false,
  error: "",
};

const SERVER_SNAPSHOT: UseAppSettingsResult = {
  settings: DEFAULT_APP_SETTINGS,
  loading: false,
  error: "",
};

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeTheme(value: unknown): AppTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return DEFAULT_APP_SETTINGS.defaultTheme;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSettings(data: Record<string, unknown>): AppSettings {
  return {
    companyName: normalizeText(
      data.companyName,
      DEFAULT_APP_SETTINGS.companyName
    ),
    companyPhone: normalizeText(
      data.companyPhone,
      DEFAULT_APP_SETTINGS.companyPhone
    ),
    companyEmail: normalizeText(
      data.companyEmail,
      DEFAULT_APP_SETTINGS.companyEmail
    ),
    companyAddress: normalizeText(
      data.companyAddress,
      DEFAULT_APP_SETTINGS.companyAddress
    ),
    defaultTheme: normalizeTheme(data.defaultTheme),
    maintenanceMode: normalizeBoolean(
      data.maintenanceMode,
      DEFAULT_APP_SETTINGS.maintenanceMode
    ),
    skipHospicePatientsOnRegularPages: normalizeBoolean(
      data.skipHospicePatientsOnRegularPages,
      DEFAULT_APP_SETTINGS.skipHospicePatientsOnRegularPages
    ),
  };
}

function subscribeDisabled(): () => void {
  return () => {};
}

function getDisabledSnapshot(): UseAppSettingsResult {
  return DISABLED_SNAPSHOT;
}

const appSettingsStore = (() => {
  let snapshot: UseAppSettingsResult = INITIAL_SNAPSHOT;
  let unsubscribeFirestore: Unsubscribe | null = null;
  let hasStarted = false;

  const listeners = new Set<() => void>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function setSnapshot(nextSnapshot: UseAppSettingsResult) {
    snapshot = nextSnapshot;
    emit();
  }

  function startListening() {
    if (unsubscribeFirestore || hasStarted) return;

    hasStarted = true;

    unsubscribeFirestore = onSnapshot(
      doc(db, "settings", "app"),
      (docSnap) => {
        if (!docSnap.exists()) {
          setSnapshot({
            settings: DEFAULT_APP_SETTINGS,
            loading: false,
            error: "",
          });
          return;
        }

        setSnapshot({
          settings: normalizeSettings(
            docSnap.data() as Record<string, unknown>
          ),
          loading: false,
          error: "",
        });
      },
      (error) => {
        console.error("APP SETTINGS LOAD ERROR:", error);

        setSnapshot({
          settings: DEFAULT_APP_SETTINGS,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load app settings.",
        });
      }
    );
  }

  function stopListeningIfUnused() {
    if (listeners.size > 0) return;

    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }

    hasStarted = false;
    snapshot = INITIAL_SNAPSHOT;
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      startListening();

      return () => {
        listeners.delete(listener);
        stopListeningIfUnused();
      };
    },

    getSnapshot(): UseAppSettingsResult {
      return snapshot;
    },

    getServerSnapshot(): UseAppSettingsResult {
      return SERVER_SNAPSHOT;
    },
  };
})();

export function useAppSettings(
  enabled: boolean
): UseAppSettingsResult {
  return useSyncExternalStore(
    enabled ? appSettingsStore.subscribe : subscribeDisabled,
    enabled ? appSettingsStore.getSnapshot : getDisabledSnapshot,
    enabled ? appSettingsStore.getServerSnapshot : getDisabledSnapshot
  );
}