import { typography } from "@/theme";

import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from "../../settings-constants";

import type { AdminUser, UserRole, UserStatus } from "../../settings-types";

import { StatusPill } from "../shared/StatusPill";

type UserRowProps = {
  user: AdminUser;
  onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onUpdateStatus: (userId: string, status: UserStatus) => Promise<void>;
};

function getStatusTone(status: UserStatus) {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  return "danger";
}

export function UserRow({
  user,
  onUpdateRole,
  onUpdateStatus,
}: UserRowProps) {
  return (
    <tr className="border-b border-white/10 transition hover:bg-white/[0.035]">
      <td className="px-4 py-4">
        <p className={typography.cardTitle}>
          {user.displayName || "Unnamed User"}
        </p>
        <p className="mt-1 text-xs ${typography.caption}">{user.email || "No email"}</p>
      </td>

      <td className="px-4 py-4">
        <select
          value={user.role}
          aria-label={`Role for ${user.email || user.id}`}
          onChange={(event) =>
            void onUpdateRole(user.id, event.target.value as UserRole)
          }
          className="h-10 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10"
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
          aria-label={`Status for ${user.email || user.id}`}
          onChange={(event) =>
            void onUpdateStatus(user.id, event.target.value as UserStatus)
          }
          className="h-10 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10"
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
        <StatusPill label={user.status} tone={getStatusTone(user.status)} />
      </td>
    </tr>
  );
}







