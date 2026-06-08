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
import { badges, buttons, typography } from "@/theme";
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
                ? badges.info
                : badges.neutral
            }`}
          >
            {user.role}
          </span>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              user.active
                ? badges.success
                : badges.danger
            }`}
          >
            {user.active ? "active" : "disabled"}
          </span>

          {isSelf ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badges.warning}`}>
              you
            </span>
          ) : null}
        </div>

        <p className={`mt-2 break-all ${typography.body}`}>
          {user.email || "â€”"}
        </p>

        <p className={`mt-1 break-all ${typography.smallMuted}`}>UID: {user.uid}</p>

        <div className={`mt-3 grid gap-2 ${typography.smallMuted} md:grid-cols-2`}>
          <p>Created: {formatTimestamp(user.createdAt)}</p>
          <p>Updated: {formatTimestamp(user.updatedAt)}</p>
          <p>Theme: {user.theme}</p>
          <p>Phone: {user.phone || "â€”"}</p>
        </div>
      </div>

      <div>
        <p className={typography.caption}>
          Role
        </p>

        <div className="flex items-center gap-2">
          <Shield className={`h-4 w-4 ${typography.smallMuted}`} />

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
        <p className={typography.caption}>
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
              ? buttons.danger
              : buttons.success
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
        <p className={typography.caption}>
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
            className={buttons.secondary}
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
            className={buttons.danger}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>

        {isSelf ? (
          <p className={`mt-2 ${typography.smallMuted}`}>
            Self-delete, self-disable, and self-role-change are blocked.
          </p>
        ) : null}
      </div>
    </article>
  );
}






