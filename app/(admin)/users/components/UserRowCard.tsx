"use client";

import {
  Loader2,
  Shield,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";

import type { UserRole } from "@/lib/adminUsers";
import type { UserRow } from "../users-types";
import { formatTimestamp } from "../users-utils";

type UserRowCardProps = {
  user: UserRow;
  currentUid: string;
  busyUid: string | null;
  onRoleChange: (user: UserRow, nextRole: UserRole) => void;
  onToggleActive: (user: UserRow) => void;
  onDeleteUser: (user: UserRow) => void;
};

export function UserRowCard({
  user,
  currentUid,
  busyUid,
  onRoleChange,
  onToggleActive,
  onDeleteUser,
}: UserRowCardProps) {
  const isBusy = busyUid === user.uid;
  const isSelf = currentUid === user.uid;
  const userLabel = user.email || user.uid;

  return (
    <article className="grid gap-4 px-5 py-5 transition hover:bg-white/[0.03] xl:grid-cols-[2fr_1fr_1fr_1.2fr]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold text-white">
            {user.displayName || "Unnamed User"}
          </p>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              user.role === "admin"
                ? "bg-blue-500/15 text-blue-300"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {user.role}
          </span>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              user.active
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {user.active ? "active" : "disabled"}
          </span>

          {isSelf ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
              you
            </span>
          ) : null}
        </div>

        <p className="mt-2 break-all text-sm text-zinc-300">
          {user.email || "—"}
        </p>

        <p className="mt-1 break-all text-xs text-zinc-500">UID: {user.uid}</p>

        <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
          <p>Created: {formatTimestamp(user.createdAt)}</p>
          <p>Updated: {formatTimestamp(user.updatedAt)}</p>
          <p>Theme: {user.theme}</p>
          <p>Phone: {user.phone || "—"}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Role
        </p>

        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-zinc-500" />

          <label htmlFor={`role-${user.uid}`} className="sr-only">
            Change role for {userLabel}
          </label>

          <select
            id={`role-${user.uid}`}
            title={`Change role for ${userLabel}`}
            aria-label={`Change role for ${userLabel}`}
            value={user.role}
            disabled={isBusy || isSelf}
            onChange={(event) =>
              onRoleChange(user, event.target.value as UserRole)
            }
            className="w-full rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="staff">staff</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Account
        </p>

        <button
          type="button"
          aria-label={user.active ? `Disable ${userLabel}` : `Enable ${userLabel}`}
          title={
            isSelf
              ? "You cannot disable or enable your own account."
              : user.active
                ? "Disable user"
                : "Enable user"
          }
          disabled={isBusy || isSelf}
          onClick={() => onToggleActive(user)}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
            user.active
              ? "border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15"
              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
          }`}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : user.active ? (
            <UserMinus className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {user.active ? "Disable" : "Enable"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Actions
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label={`Toggle role for ${userLabel}`}
            title={
              isSelf ? "You cannot change your own role." : "Toggle user role"
            }
            disabled={isBusy || isSelf}
            onClick={() =>
              onRoleChange(user, user.role === "admin" ? "staff" : "admin")
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCog className="h-4 w-4" />
            )}
            Toggle Role
          </button>

          <button
            type="button"
            aria-label={`Delete ${userLabel}`}
            title={isSelf ? "You cannot delete your own account." : "Delete user"}
            disabled={isBusy || isSelf}
            onClick={() => onDeleteUser(user)}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>

        {isSelf ? (
          <p className="mt-2 text-xs text-zinc-500">
            Self-delete, self-disable, and self-role-change are blocked.
          </p>
        ) : null}
      </div>
    </article>
  );
}