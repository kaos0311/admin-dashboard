"use client";

import type { ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { colors, typography } from "@/theme";
import { useAuthRole } from "@/app/hooks/useAuthRole";

import type { AuthRoleState } from "../upload-types";
import { cn } from "../upload-utils";
import { uploadUi } from "./upload-ui";

type UploadAccessGateProps = {
  children: (context: {
    authRole: AuthRoleState;
    user: AuthRoleState["user"];
    role: string | null;
    canManageUploads: boolean;
  }) => ReactNode;
};

export function UploadAccessGate({ children }: UploadAccessGateProps) {
  const authRole = useAuthRole() as AuthRoleState;

  const user = authRole.user ?? null;
  const role = authRole.role ?? null;
  const roleLoading = Boolean(authRole.loading);
  const roleError =
    typeof authRole.error === "string"
      ? authRole.error
      : authRole.error?.message ?? null;

  const canManageUploads = Boolean(
    authRole.isAdmin || authRole.isStaff || role === "admin" || role === "staff"
  );

  if (roleLoading) {
    return (
      <main className={cn(uploadUi.page, colors.app)}>
        <div className={colors.grid} aria-hidden="true" />

        <section
          className={cn(
            uploadUi.shell,
            "min-h-[70vh] items-center justify-center"
          )}
        >
          <div className={cn(uploadUi.panel, "max-w-md p-8 text-center")}>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-200" />

            <h1 className={cn(typography.sectionTitle, "mt-4")}>
              Checking access
            </h1>

            <p className={cn(typography.bodyMuted, "mt-2")}>
              Verifying upload permissions before touching protected report data.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!canManageUploads) {
    return (
      <main className={cn(uploadUi.page, colors.app)}>
        <div className={colors.grid} aria-hidden="true" />

        <section
          className={cn(
            uploadUi.shell,
            "min-h-[70vh] items-center justify-center"
          )}
        >
          <div className={cn(uploadUi.panel, "max-w-xl p-8 text-center")}>
            <div className={cn(uploadUi.icon, "mx-auto")}>
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>

            <h1 className={cn(typography.pageTitle, "mt-5")}>
              Access restricted
            </h1>

            <p className={cn(typography.bodyMuted, "mt-3")}>
              You need staff or admin permissions to upload reports.
            </p>

            {roleError ? (
              <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {roleError}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return children({
    authRole,
    user,
    role,
    canManageUploads,
  });
}


