"use client";

import type { ReactNode } from "react";

import {
  Loader2,
  Lock,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { useAppSettings } from "@/app/hooks/useAppSettings";
import { useAuthRole } from "@/app/hooks/useAuthRole";

type MaintenanceGateProps = {
  children: ReactNode;
};

type GateTone = "neutral" | "danger" | "warning";

type GateMessageProps = {
  title?: string;
  message: string;
  tone?: GateTone;
  loading?: boolean;
};

function GateMessage({
  title,
  message,
  tone = "neutral",
  loading = false,
}: GateMessageProps) {
  const toneClasses: Record<GateTone, string> = {
    neutral:
      "border-white/10 bg-neutral-950 text-neutral-300",
    danger:
      "border-red-500/20 bg-red-950/20 text-red-300",
    warning:
      "border-yellow-500/20 bg-yellow-950/20 text-yellow-200",
  };

  const iconClasses: Record<GateTone, string> = {
    neutral:
      "border-white/10 bg-white/5 text-neutral-300",
    danger:
      "border-red-500/20 bg-red-500/10 text-red-300",
    warning:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-200",
  };

  const Icon = loading
    ? Loader2
    : tone === "danger"
      ? ShieldAlert
      : tone === "warning"
        ? Wrench
        : Lock;

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <section
        role="status"
        aria-live="polite"
        className={`w-full max-w-md rounded-3xl border p-8 shadow-2xl shadow-black/40 ${toneClasses[tone]}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`rounded-2xl border p-3 ${iconClasses[tone]}`}
          >
            <Icon
              className={`h-5 w-5 ${
                loading ? "animate-spin" : ""
              }`}
              aria-hidden={true}
            />
          </div>

          <div className="min-w-0">
            {title ? (
              <h1 className="text-xl font-semibold text-white">
                {title}
              </h1>
            ) : null}

            <p
              className={`text-sm leading-6 ${
                title ? "mt-2" : ""
              }`}
            >
              {message}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function MaintenanceGate({
  children,
}: MaintenanceGateProps) {
  const {
    loading: authLoading,
    isAdmin,
    isStaff,
    user,
  } = useAuthRole();

  const canReadSettings = Boolean(
    user && (isAdmin || isStaff)
  );

  const {
    settings,
    loading: settingsLoading,
  } = useAppSettings(canReadSettings);

  if (authLoading) {
    return (
      <GateMessage
        title="Checking Session"
        message="Verifying your dashboard access..."
        loading
      />
    );
  }

  if (!user) {
    return (
      <GateMessage
        title="Sign In Required"
        message="You must be signed in to access this dashboard."
        tone="danger"
      />
    );
  }

  if (!isAdmin && !isStaff) {
    return (
      <GateMessage
        title="Access Denied"
        message="Your account does not have permission to access this dashboard."
        tone="danger"
      />
    );
  }

  if (canReadSettings && settingsLoading) {
    return (
      <GateMessage
        title="Loading Settings"
        message="Checking dashboard configuration..."
        loading
      />
    );
  }

  if (
    settings?.maintenanceMode &&
    !isAdmin
  ) {
    return (
      <GateMessage
        title="Maintenance Mode"
        message="The dashboard is temporarily unavailable while maintenance mode is enabled."
        tone="warning"
      />
    );
  }

  return <>{children}</>;
}