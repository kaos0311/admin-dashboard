"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import { auth } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import {
  createDashboardUser,
  deleteUserAccount,
  disableDashboardUser,
  enableDashboardUser,
  forceRefreshCurrentUserToken,
  updateUserRole,
  type UserRole,
} from "@/lib/adminUsers";

import { CreateUserPanel } from "./components/CreateUserPanel";
import { UserDirectory } from "./components/UserDirectory";
import { UsersFilters } from "./components/UsersFilters";
import { UsersHeader } from "./components/UsersHeader";
import { UsersStats } from "./components/UsersStats";
import { emptyCreateForm, type CreateFormState, type UserRow } from "./users-types";
import { getErrorMessage } from "./users-utils";
import { useUsersData } from "./use-users-data";

export default function UsersPage() {
  const { loading: authLoading, isAdmin } = useAuthRole();

  const currentUid = auth.currentUser?.uid ?? "";

  const {
    users,
    setUsers,
    filteredUsers,
    stats,
    loadingUsers,
    loadingMore,
    hasMore,
    loadMoreUsers,
    searchInput,
    setSearchInput,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
  } = useUsersData({ authLoading, isAdmin });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateFormState>(emptyCreateForm);
  const [creatingUser, setCreatingUser] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  function resetCreateForm() {
    setCreateForm(emptyCreateForm);
  }

  async function handleCreateUser() {
    const email = createForm.email.trim();
    const password = createForm.password;
    const displayName = createForm.displayName.trim();
    const role = createForm.role;

    if (!email || !password || !displayName) {
      toast.error("Email, password, and display name are required.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setCreatingUser(true);

      await createDashboardUser({
        email,
        password,
        displayName,
        role,
      });

      toast.success("User created.");
      resetCreateForm();
      setShowCreateForm(false);
    } catch (error: unknown) {
      console.error("CREATE USER ERROR:", error);
      toast.error(getErrorMessage(error, "Failed to create user."));
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleRoleChange(user: UserRow, nextRole: UserRole) {
    if (user.role === nextRole) return;

    if (user.uid === currentUid) {
      toast.error("You cannot change your own role.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${user.email || user.uid} to ${nextRole}?`
    );

    if (!confirmed) return;

    const previousUsers = users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid ? { ...row, role: nextRole } : row
        )
      );

      await updateUserRole({ uid: user.uid, role: nextRole });
      await forceRefreshCurrentUserToken();

      toast.success("Role updated.");
    } catch (error: unknown) {
      setUsers(previousUsers);
      console.error("UPDATE ROLE ERROR:", error);
      toast.error(getErrorMessage(error, "Failed to update role."));
    } finally {
      setBusyUid(null);
    }
  }

  async function handleToggleActive(user: UserRow) {
    if (user.uid === currentUid) {
      toast.error("You cannot disable or enable your own account here.");
      return;
    }

    const actionText = user.active ? "disable" : "enable";
    const nextActive = !user.active;

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${user.email || user.uid}?`
    );

    if (!confirmed) return;

    const previousUsers = users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid ? { ...row, active: nextActive } : row
        )
      );

      if (user.active) {
        await disableDashboardUser({ uid: user.uid });
        toast.success("User disabled.");
      } else {
        await enableDashboardUser({ uid: user.uid });
        toast.success("User enabled.");
      }
    } catch (error: unknown) {
      setUsers(previousUsers);
      console.error("TOGGLE ACTIVE ERROR:", error);
      toast.error(getErrorMessage(error, `Failed to ${actionText} user.`));
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDeleteUser(user: UserRow) {
    if (user.uid === currentUid) {
      toast.error("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${user.email || user.uid}?\n\nThis removes the Auth account and deletes the Firestore user document.`
    );

    if (!confirmed) return;

    const previousUsers = users;

    try {
      setBusyUid(user.uid);

      setUsers((current) => current.filter((row) => row.uid !== user.uid));

      await deleteUserAccount({ uid: user.uid });

      toast.success("User deleted.");
    } catch (error: unknown) {
      setUsers(previousUsers);
      console.error("DELETE USER ERROR:", error);
      toast.error(getErrorMessage(error, "Failed to delete user."));
    } finally {
      setBusyUid(null);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
        <div className="w-full max-w-none">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-zinc-300 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading access...</span>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.16),_transparent_34%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
        <div className="w-full max-w-none">
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <h1 className="text-2xl font-semibold">Admin access required</h1>
            <p className="mt-2 text-sm text-zinc-300">
              You do not have permission to manage users.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="w-full max-w-none space-y-6">
        <UsersHeader
          showCreateForm={showCreateForm}
          onToggleCreateForm={() => setShowCreateForm((previous) => !previous)}
        />

        <UsersStats stats={stats} />

        {showCreateForm ? (
          <CreateUserPanel
            createForm={createForm}
            setCreateForm={setCreateForm}
            creatingUser={creatingUser}
            onCreateUser={() => void handleCreateUser()}
            onCancel={() => {
              resetCreateForm();
              setShowCreateForm(false);
            }}
          />
        ) : null}

        <UsersFilters
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        <UserDirectory
          filteredUsers={filteredUsers}
          loadingUsers={loadingUsers}
          hasMore={hasMore}
          loadingMore={loadingMore}
          currentUid={currentUid}
          busyUid={busyUid}
          onLoadMore={() => void loadMoreUsers()}
          onRoleChange={(user, nextRole) => void handleRoleChange(user, nextRole)}
          onToggleActive={(user) => void handleToggleActive(user)}
          onDeleteUser={(user) => void handleDeleteUser(user)}
        />

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <RefreshCw className="h-3.5 w-3.5" />
          Role changes may require the affected user to sign out and back in.
        </div>
      </div>
    </main>
  );
}