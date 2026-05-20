"use client";

import type {
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";
import {
  KeyRound,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../settings-constants";

import type {
  CreateUserForm,
  IdentityForm,
  PasswordResetForm,
  UserRole,
  UserRow,
} from "../../settings-types";

type UsersTabProps = {
  users: UserRow[];
  filteredUsers: UserRow[];
  userSummary: {
    totalLoaded: number;
    admins: number;
    staff: number;
    active: number;
    disabled: number;
  };

  search: string;
  setSearch: (value: string) => void;

  usersRefreshing: boolean;
  loadingMoreUsers: boolean;
  hasMoreUsers: boolean;

  savingUserId: string | null;
  deletingUserId: string | null;
  currentUid: string;
  adminCount: number | null;

  createUserForm: CreateUserForm;
  setCreateUserForm: Dispatch<SetStateAction<CreateUserForm>>;
  creatingUser: boolean;

  identityForm: IdentityForm;
  setIdentityForm: Dispatch<SetStateAction<IdentityForm>>;

  passwordResetForm: PasswordResetForm;
  setPasswordResetForm: Dispatch<SetStateAction<PasswordResetForm>>;

  selectedUser: UserRow | null;
  isSelectedCurrentUser: boolean;

  savingIdentity: boolean;
  resettingPassword: boolean;

  refreshUsers: () => Promise<void>;
  loadMoreUsers: () => Promise<void>;
  createUser: () => Promise<void>;
  saveIdentity: () => Promise<void>;
  resetPassword: () => Promise<void>;
  selectUserForIdentity: (user: UserRow) => void;
  setRole: (user: UserRow, role: UserRole) => Promise<void>;
  setActive: (user: UserRow, active: boolean) => Promise<void>;
  deleteUserFully: (user: UserRow) => Promise<void>;
};

export function UsersTab(props: UsersTabProps) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Loaded Users"
          value={props.userSummary.totalLoaded}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Admins"
          value={props.userSummary.admins}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Staff"
          value={props.userSummary.staff}
          icon={<UserCog className="h-5 w-5" />}
        />
        <StatCard
          title="Active"
          value={props.userSummary.active}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Disabled"
          value={props.userSummary.disabled}
          icon={<UserX className="h-5 w-5" />}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <UserCreateCard {...props} />
        <UserIdentityCard {...props} />
        <UserPasswordCard {...props} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeader
            icon={<ShieldCheck className="h-5 w-5 text-cyan-300" />}
            title="User Roles & Access"
            description="Manage user role and active status. Self-lockout protections are enabled."
          />

          <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

              <label htmlFor="user-search" className="sr-only">
                Search users
              </label>

              <input
                id="user-search"
                title="Search users"
                aria-label="Search users"
                placeholder="Search loaded users..."
                value={props.search}
                onChange={(event) => props.setSearch(event.target.value)}
                className={`${inputClass} py-2.5 pl-10`}
              />
            </div>

            <button
              type="button"
              title="Refresh users"
              aria-label="Refresh users"
              onClick={() => void props.refreshUsers()}
              disabled={props.usersRefreshing}
              className={secondaryButtonClass}
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  props.usersRefreshing ? "animate-spin" : ""
                }`}
              />
              {props.usersRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Protection</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {props.filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-zinc-400"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  props.filteredUsers.map((user) => (
                    <UserTableRow key={user.uid} user={user} {...props} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Loaded {props.users.length} user
            {props.users.length === 1 ? "" : "s"}.
          </p>

          {props.hasMoreUsers ? (
            <button
              type="button"
              title="Load more users"
              aria-label="Load more users"
              onClick={() => void props.loadMoreUsers()}
              disabled={props.loadingMoreUsers}
              className={secondaryButtonClass}
            >
              {props.loadingMoreUsers ? "Loading..." : "Load More Users"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function UserCreateCard(props: UsersTabProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <SectionHeader
        icon={<UserPlus className="h-5 w-5 text-cyan-300" />}
        title="Create New User"
      />

      <div className="mt-5 space-y-4">
        <Field label="New user email" id="create-user-email" srOnly>
          <input
            id="create-user-email"
            title="New user email"
            aria-label="New user email"
            placeholder="Email"
            value={props.createUserForm.email}
            onChange={(event) =>
              props.setCreateUserForm((previous) => ({
                ...previous,
                email: event.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>

        <Field label="Temporary password" id="create-user-password" srOnly>
          <input
            id="create-user-password"
            title="Temporary password"
            aria-label="Temporary password"
            placeholder="Temporary password"
            type="password"
            value={props.createUserForm.password}
            onChange={(event) =>
              props.setCreateUserForm((previous) => ({
                ...previous,
                password: event.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>

        <Field label="Display name" id="create-user-display-name" srOnly>
          <input
            id="create-user-display-name"
            title="Display name"
            aria-label="Display name"
            placeholder="Display name"
            value={props.createUserForm.displayName}
            onChange={(event) =>
              props.setCreateUserForm((previous) => ({
                ...previous,
                displayName: event.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>

        <Field label="User role" id="create-user-role" srOnly>
          <select
            id="create-user-role"
            title="User role"
            aria-label="User role"
            value={props.createUserForm.role}
            onChange={(event) =>
              props.setCreateUserForm((previous) => ({
                ...previous,
                role: event.target.value as UserRole,
              }))
            }
            className={inputClass}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>

        <button
          type="button"
          title="Create User"
          aria-label="Create User"
          onClick={() => void props.createUser()}
          disabled={props.creatingUser}
          className={primaryButtonClass}
        >
          <UserPlus className="h-4 w-4" />
          {props.creatingUser ? "Creating..." : "Create User"}
        </button>
      </div>
    </section>
  );
}

function UserIdentityCard(props: UsersTabProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <SectionHeader
        icon={<UserCog className="h-5 w-5 text-cyan-300" />}
        title="Reset Username"
      />

      <div className="mt-5 space-y-4">
        <Field label="Select user for identity update" id="identity-user" srOnly>
          <select
            id="identity-user"
            title="Select user for identity update"
            aria-label="Select user for identity update"
            value={props.identityForm.uid}
            onChange={(event) => {
              const selected = props.users.find(
                (user) => user.uid === event.target.value
              );

              if (!selected) return;

              props.selectUserForIdentity(selected);
            }}
            className={inputClass}
          >
            <option value="">Select user</option>

            {props.users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {user.email || user.uid}
              </option>
            ))}
          </select>
        </Field>

        <Field label="New email or username" id="identity-email" srOnly>
          <input
            id="identity-email"
            title="New email or username"
            aria-label="New email or username"
            placeholder="New email / username"
            value={props.identityForm.email}
            onChange={(event) =>
              props.setIdentityForm((previous) => ({
                ...previous,
                email: event.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>

        <Field label="Identity display name" id="identity-display-name" srOnly>
          <input
            id="identity-display-name"
            title="Identity display name"
            aria-label="Identity display name"
            placeholder="Display name"
            value={props.identityForm.displayName}
            onChange={(event) =>
              props.setIdentityForm((previous) => ({
                ...previous,
                displayName: event.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>

        {props.isSelectedCurrentUser ? (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">
            You are editing your own identity.
          </div>
        ) : null}

        <button
          type="button"
          title="Save Username"
          aria-label="Save Username"
          onClick={() => void props.saveIdentity()}
          disabled={props.savingIdentity}
          className={primaryButtonClass}
        >
          <UserCog className="h-4 w-4" />
          {props.savingIdentity ? "Saving..." : "Save Username"}
        </button>
      </div>
    </section>
  );
}

function UserPasswordCard(props: UsersTabProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <SectionHeader
        icon={<KeyRound className="h-5 w-5 text-cyan-300" />}
        title="Reset Password"
      />

      <div className="mt-5 space-y-4">
        <Field label="Select user for password reset" id="password-user" srOnly>
          <select
            id="password-user"
            title="Select user for password reset"
            aria-label="Select user for password reset"
            value={props.passwordResetForm.uid}
            onChange={(event) =>
              props.setPasswordResetForm((previous) => ({
                ...previous,
                uid: event.target.value,
              }))
            }
            className={inputClass}
          >
            <option value="">Select user</option>

            {props.users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {user.email || user.uid}
              </option>
            ))}
          </select>
        </Field>

        <Field label="New password" id="password-new" srOnly>
          <input
            id="password-new"
            title="New password"
            aria-label="New password"
            placeholder="New password"
            type="password"
            value={props.passwordResetForm.newPassword}
            onChange={(event) =>
              props.setPasswordResetForm((previous) => ({
                ...previous,
                newPassword: event.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>

        <button
          type="button"
          title="Reset Password"
          aria-label="Reset Password"
          onClick={() => void props.resetPassword()}
          disabled={props.resettingPassword}
          className={primaryButtonClass}
        >
          <KeyRound className="h-4 w-4" />
          {props.resettingPassword ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </section>
  );
}

function UserTableRow({
  user,
  ...props
}: UsersTabProps & {
  user: UserRow;
}) {
  const isSaving = props.savingUserId === user.uid;
  const isDeleting = props.deletingUserId === user.uid;
  const isCurrentUser = user.uid === props.currentUid;
  const isLastAdmin = user.role === "admin" && props.adminCount === 1;

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-4">
        <div className="font-medium text-white">
          {user.displayName || "No display name"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {user.email || user.uid}
        </div>
      </td>

      <td className="px-4 py-4">
        <label htmlFor={`role-${user.uid}`} className="sr-only">
          Role for {user.email || user.uid}
        </label>

        <select
          id={`role-${user.uid}`}
          title={`Role for ${user.email || user.uid}`}
          aria-label={`Role for ${user.email || user.uid}`}
          value={user.role}
          onChange={(event) =>
            void props.setRole(user, event.target.value as UserRole)
          }
          disabled={isSaving || isDeleting}
          className="rounded-xl border border-white/10 bg-[#07090d] px-3 py-2 text-sm outline-none disabled:opacity-50"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </td>

      <td className="px-4 py-4">
        <StatusPill active={user.active} />
      </td>

      <td className="px-4 py-4">
        <div className="space-y-1 text-xs text-zinc-400">
          {isCurrentUser ? (
            <div className="text-cyan-300">Current user</div>
          ) : null}

          {isLastAdmin ? (
            <div className="text-amber-300">Last admin</div>
          ) : null}

          {!isCurrentUser && !isLastAdmin ? <div>Standard</div> : null}
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            title={user.active ? "Disable user" : "Enable user"}
            aria-label={user.active ? "Disable user" : "Enable user"}
            onClick={() => void props.setActive(user, !user.active)}
            disabled={isSaving || isDeleting}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
              user.active
                ? "border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
            }`}
          >
            {user.active ? "Disable" : "Enable"}
          </button>

          <button
            type="button"
            title="Edit identity"
            aria-label="Edit identity"
            onClick={() => props.selectUserForIdentity(user)}
            disabled={isSaving || isDeleting}
            className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
          >
            Edit Identity
          </button>

          <button
            type="button"
            title="Delete user fully"
            aria-label="Delete user fully"
            onClick={() => void props.deleteUserFully(user)}
            disabled={isSaving || isDeleting}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete Fully"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>

      <div>
        <h2 className="text-lg font-semibold">{title}</h2>

        {description ? (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  children,
  srOnly = false,
}: {
  label: string;
  id: string;
  children: ReactNode;
  srOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={srOnly ? "sr-only" : "text-sm text-zinc-300"}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {value.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/20 bg-red-500/10 text-red-300"
      }`}
    >
      {active ? "Active" : "Disabled"}
    </span>
  );
}