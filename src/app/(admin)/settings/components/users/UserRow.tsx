"use client";

import { useState } from "react";

import {
  Loader2,
  Trash2,
} from "lucide-react";

import { typography } from "@/theme";

import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from "../../settings-constants";

import type {
  AdminUser,
  UserRole,
  UserStatus,
} from "../../settings-types";

import { StatusPill } from "../shared/StatusPill";

type UserRowProps = {
  user: AdminUser;
  saving: boolean;

  onUpdateRole: (
    userId: string,
    role: UserRole
  ) => Promise<void>;

  onUpdateStatus: (
    userId: string,
    status: UserStatus
  ) => Promise<void>;

  onDeleteUser: (
    userId: string
  ) => Promise<void>;
};

function getStatusTone(status: UserStatus) {
  if (status === "active") {
    return "success";
  }

  if (status === "pending") {
    return "warning";
  }

  return "danger";
}

export function UserRow({
  user,
  saving,
  onUpdateRole,
  onUpdateStatus,
  onDeleteUser,
}: UserRowProps) {
  const [isDeleting, setIsDeleting] =
    useState(false);

  const userId = user.uid || user.id;

  const userLabel =
    user.displayName ||
    user.email ||
    userId;

  const controlsDisabled =
    saving || isDeleting;

  async function handleDelete(): Promise<void> {
    if (controlsDisabled) {
      return;
    }

    const confirmed = window.confirm(
      [
        `Delete ${userLabel}?`,
        "",
        "This permanently deletes the Firebase Auth account and dashboard user record.",
        "",
        "This action cannot be undone.",
      ].join("\n")
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await onDeleteUser(userId);
    } catch (error) {
      console.error(
        "[UserRow] Delete request failed",
        error
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <tr className="border-b border-white/10 transition last:border-b-0 hover:bg-white/[0.035]">
      <td className="px-4 py-4">
        <p className={typography.cardTitle}>
          {user.displayName || "Unnamed User"}
        </p>

        <p
          className={`mt-1 text-xs ${typography.caption}`}
        >
          {user.email || "No email"}
        </p>
      </td>

      <td className="px-4 py-4">
        <select
          value={user.role}
          disabled={controlsDisabled}
          aria-label={`Role for ${userLabel}`}
          onChange={(event) => {
            void onUpdateRole(
              userId,
              event.target.value as UserRole
            );
          }}
          className="h-10 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {USER_ROLE_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-slate-950"
            >
              {option.label}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-4">
        <select
          value={user.status}
          disabled={controlsDisabled}
          aria-label={`Status for ${userLabel}`}
          onChange={(event) => {
            void onUpdateStatus(
              userId,
              event.target.value as UserStatus
            );
          }}
          className="h-10 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {USER_STATUS_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-slate-950"
            >
              {option.label}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-4">
        <StatusPill
          label={user.status}
          tone={getStatusTone(user.status)}
        />
      </td>

      <td className="px-4 py-4 text-right">
        <button
          type="button"
          onClick={() => {
            void handleDelete();
          }}
          disabled={controlsDisabled}
          aria-label={`Delete ${userLabel}`}
          aria-busy={isDeleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}

          {isDeleting
            ? "Deleting..."
            : "Delete"}
        </button>
      </td>
    </tr>
  );
}


