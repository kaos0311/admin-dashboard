"use client";

import { useState } from "react";

import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCog,
  } from "lucide-react";

import toast from "react-hot-toast";

import { httpsCallable } from "firebase/functions";

import { colors, glass, typography } from "@/theme";

import { auth, functions } from "@/lib/firebase";

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

import {
  type CreateFormState,
  emptyCreateForm,
  type UserRow,
} from "./users-types";

import { getErrorMessage } from "./users-utils";

import { useUsersData } from "./use-users-data";

export default function UsersPage() {
  const {
    loading: authLoading,
    isAdmin,
  } = useAuthRole();

  const currentUid =
    auth.currentUser?.uid ?? "";

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
} = useUsersData({
  authLoading,
  isAdmin,
});

  const [
    showCreateForm,
    setShowCreateForm,
  ] = useState(false);

  const [createForm, setCreateForm] =
    useState<CreateFormState>(
      emptyCreateForm
    );

  const [
    creatingUser,
    setCreatingUser,
  ] = useState(false);

  const [busyUid, setBusyUid] =
    useState<string | null>(
      null
    );

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  function resetCreateForm() {
    setCreateForm(
      emptyCreateForm
    );
  }

  async function bootstrapAdmin() {
    try {
      const fn = httpsCallable(
        functions,
        "bootstrapAdminClaim"
      );

      const result =
        await fn({});

      console.warn(
        "BOOTSTRAP RESULT:",
        result.data
      );

      toast.success(
        "Admin claim bootstrapped successfully."
      );
    } catch (error) {
      console.error(
        "BOOTSTRAP ERROR:",
        error
      );

      toast.error(
        "Bootstrap failed."
      );
    }
  }

  async function handleCreateUser() {
    const email =
      createForm.email.trim();

    const password =
      createForm.password;

    const displayName =
      createForm.displayName.trim();

    const role =
      createForm.role;

    if (
      !email ||
      !password ||
      !displayName
    ) {
      toast.error(
        "Email, password, and display name are required."
      );

      return;
    }

    if (
      password.length < 6
    ) {
      toast.error(
        "Password must be at least 6 characters."
      );

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

      toast.success(
        "User created."
      );

      resetCreateForm();

      setShowCreateForm(false);
    } catch (error: unknown) {
      console.error(
        "CREATE USER ERROR:",
        error
      );

      toast.error(
        getErrorMessage(
          error,
          "Failed to create user."
        )
      );
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleRoleChange(
    user: UserRow,
    nextRole: UserRole
  ) {
    if (
      user.role === nextRole
    ) {
      return;
    }

    if (
      user.uid === currentUid
    ) {
      toast.error(
        "You cannot change your own role."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Change ${
          user.email ||
          user.uid
        } to ${nextRole}?`
      );

    if (!confirmed) {
      return;
    }

    const previousUsers =
      users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid
            ? {
                ...row,
                role: nextRole,
              }
            : row
        )
      );

      await updateUserRole({
        uid: user.uid,
        role: nextRole,
      });

      await forceRefreshCurrentUserToken();

      toast.success(
        "Role updated."
      );
    } catch (error: unknown) {
      setUsers(previousUsers);

      console.error(
        "UPDATE ROLE ERROR:",
        error
      );

      toast.error(
        getErrorMessage(
          error,
          "Failed to update role."
        )
      );
    } finally {
      setBusyUid(null);
    }
  }

  async function handleToggleActive(
    user: UserRow
  ) {
    if (
      user.uid === currentUid
    ) {
      toast.error(
        "You cannot disable or enable your own account here."
      );

      return;
    }

    const actionText =
      user.active
        ? "disable"
        : "enable";

    const nextActive =
      !user.active;

    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionText} ${
          user.email ||
          user.uid
        }?`
      );

    if (!confirmed) {
      return;
    }

    const previousUsers =
      users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid
            ? {
                ...row,
                active:
                  nextActive,
              }
            : row
        )
      );

      if (user.active) {
        await disableDashboardUser({
          uid: user.uid,
        });

        toast.success(
          "User disabled."
        );
      } else {
        await enableDashboardUser({
          uid: user.uid,
        });

        toast.success(
          "User enabled."
        );
      }
    } catch (error: unknown) {
      setUsers(previousUsers);

      console.error(
        "TOGGLE ACTIVE ERROR:",
        error
      );

      toast.error(
        getErrorMessage(
          error,
          `Failed to ${actionText} user.`
        )
      );
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDeleteUser(
    user: UserRow
  ) {
    if (
      user.uid === currentUid
    ) {
      toast.error(
        "You cannot delete your own account."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${
          user.email ||
          user.uid
        }?\n\nThis removes the Auth account and deletes the Firestore user document.`
      );

    if (!confirmed) {
      return;
    }

    const previousUsers =
      users;

    try {
      setBusyUid(user.uid);

      setUsers((current) =>
        current.filter(
          (row) =>
            row.uid !==
            user.uid
        )
      );

      await deleteUserAccount({
        uid: user.uid,
      });

      toast.success(
        "User deleted."
      );
    } catch (error: unknown) {
      setUsers(previousUsers);

      console.error(
        "DELETE USER ERROR:",
        error
      );

      toast.error(
        getErrorMessage(
          error,
          "Failed to delete user."
        )
      );
    } finally {
      setBusyUid(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Loading State
  |--------------------------------------------------------------------------
  */

  if (authLoading) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className={glass.panel}>
            <div className={colors.grid} />

            <div className="relative flex items-center gap-3 p-6 text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-sky-200" />

              Loading admin access...
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Permission Gate
  |--------------------------------------------------------------------------
  */

  if (!isAdmin) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.18)]">
            Admin access required.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <section className={glass.panel}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                <ShieldCheck className="h-3.5 w-3.5" />

                Identity Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Users Command
                  Center
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Administrative
                  control for dashboard
                  role
                  permissions, access
                  states, onboarding,
                  authentication
                  control, and security
                  oversight.
                  Because eventually
                  someone gives the
                  intern admin access
                  and the universe
                  suffers accordingly.
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className={"flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl"}>
                  <UserCog className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      User System
                    </p>

                    <span className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />

                      Active
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Role and access
                    management online
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void bootstrapAdmin()
                }
                className={`${"inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"} mt-4 w-full`}
              >
                <ShieldCheck className="h-4 w-4" />

                Bootstrap Admin Claim
              </button>
            </div>
          </div>
        </section>

        <UsersHeader
          showCreateForm={
            showCreateForm
          }
          onToggleCreateForm={() =>
            setShowCreateForm(
              (previous) =>
                !previous
            )
          }
        />

        <UsersStats
          stats={stats}
        />

        {showCreateForm ? (
          <CreateUserPanel
            createForm={
              createForm
            }
            setCreateForm={
              setCreateForm
            }
            creatingUser={
              creatingUser
            }
            onCreateUser={() =>
              void handleCreateUser()
            }
            onCancel={() => {
              resetCreateForm();

              setShowCreateForm(
                false
              );
            }}
          />
        ) : null}

        <UsersFilters
          searchInput={
            searchInput
          }
          setSearchInput={
            setSearchInput
          }
          roleFilter={
            roleFilter
          }
          setRoleFilter={
            setRoleFilter
          }
          statusFilter={
            statusFilter
          }
          setStatusFilter={
            setStatusFilter
          }
        />

        <UserDirectory
          filteredUsers={
            filteredUsers
          }
          loadingUsers={
            loadingUsers
          }
          hasMore={hasMore}
          loadingMore={
            loadingMore
          }
          currentUid={
            currentUid
          }
          busyUid={busyUid}
          onLoadMore={() =>
            void loadMoreUsers()
          }
          onRoleChange={(
            user,
            nextRole
          ) =>
            void handleRoleChange(
              user,
              nextRole
            )
          }
          onToggleActive={(
            user
          ) =>
            void handleToggleActive(
              user
            )
          }
          onDeleteUser={(
            user
          ) =>
            void handleDeleteUser(
              user
            )
          }
        />

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="h-3.5 w-3.5" />

          Role changes may require affected users to sign out and back in.
        </div>
      </div>
    </main>
  );
}












