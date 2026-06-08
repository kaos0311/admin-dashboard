"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { buttons, glass, typography } from "@/theme";

import type { UserRole } from "@/lib/adminUsers";
import type { UserRow } from "../users-types";
import { UserRowCard } from "./UserRowCard";

type UserDirectoryProps = {
  filteredUsers: UserRow[];
  loadingUsers: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  currentUid: string;
  busyUid: string | null;
  onLoadMore: () => void;
  onRoleChange: (user: UserRow, nextRole: UserRole) => void;
  onToggleActive: (user: UserRow) => void;
  onDeleteUser: (user: UserRow) => void;
};

export function UserDirectory({
  filteredUsers,
  loadingUsers,
  hasMore,
  loadingMore,
  currentUid,
  busyUid,
  onLoadMore,
  onRoleChange,
  onToggleActive,
  onDeleteUser,
}: UserDirectoryProps) {
  return (
    <section className={glass.panel}>
      <div className={`${glass.toolbar} sticky top-0 z-10 px-5 py-4`}>
        <h2 className={typography.sectionTitle}>User Directory</h2>
        <p className={`mt-1 ${typography.bodyMuted}`}>
          {filteredUsers.length} visible user
          {filteredUsers.length === 1 ? "" : "s"}
        </p>
      </div>

      {loadingUsers ? (
        <div className={`flex items-center gap-3 px-5 py-10 ${typography.bodyMuted}`}>
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading users...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className={`px-5 py-10 ${typography.bodyMuted}`}>No users found.</div>
      ) : (
        <div className="divide-y divide-white/10">
          {filteredUsers.map((user) => (
            <UserRowCard
              key={user.uid}
              user={user}
              currentUid={currentUid}
              busyUid={busyUid}
              onRoleChange={onRoleChange}
              onToggleActive={onToggleActive}
              onDeleteUser={onDeleteUser}
            />
          ))}
        </div>
      )}

      {!loadingUsers && hasMore ? (
        <div className={`${glass.divider} px-5 py-5`}>
          <button
            type="button"
            title="Load more users"
            aria-label="Load more users"
            disabled={loadingMore}
            onClick={onLoadMore}
            className={buttons.secondary}
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Load More Users
          </button>
        </div>
      ) : null}
    </section>
  );
}




