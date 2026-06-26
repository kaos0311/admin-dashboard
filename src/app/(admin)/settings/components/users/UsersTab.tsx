import type { Dispatch, SetStateAction } from "react";
import { KeyRound } from "lucide-react";

import { buttons, forms, glass, typography } from "@/theme";

import type {
  AdminUser,
  PasswordResetForm,
  UserDraft,
  UserRole,
  UserStatus,
} from "../../settings-types";

import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { UserCreateCard } from "./UserCreateCard";
import { UsersTable } from "./UsersTable";

type UsersTabProps = {
  users: AdminUser[];
  userDraft: UserDraft;
  setUserDraft: Dispatch<SetStateAction<UserDraft>>;
  passwordResetForm: PasswordResetForm;
  setPasswordResetForm: Dispatch<SetStateAction<PasswordResetForm>>;
  onCreateUser: () => Promise<void>;
  onResetPassword: () => Promise<void>;
  onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onUpdateStatus: (userId: string, status: UserStatus) => Promise<void>;
};

export function UsersTab({
  users,
  userDraft,
  setUserDraft,
  passwordResetForm,
  setPasswordResetForm,
  onCreateUser,
  onResetPassword,
  onUpdateRole,
  onUpdateStatus,
}: UsersTabProps) {
  return (
    <section className={`${glass.card} p-5`}>
      <SectionHeader
        eyebrow="Users"
        title="User Access"
        description="Manage app user documents, roles, status, and admin-only employee password resets."
      />

      <div className="mt-6 grid gap-5">
        <UserCreateCard
          userDraft={userDraft}
          setUserDraft={setUserDraft}
          onCreateUser={onCreateUser}
        />

        <InfoCard
          title="Reset Employee Password"
          description="Admins can assign a temporary password for an employee Firebase Auth account. The password is sent to Firebase Auth and is not stored in Firestore."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,1fr)_auto]">
            <label className="block" htmlFor="password-reset-user">
              <span
                className={`text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}
              >
                Employee
              </span>

              <select
                id="password-reset-user"
                value={passwordResetForm.uid}
                aria-label="Employee for password reset"
                onChange={(event) =>
                  setPasswordResetForm((current) => ({
                    ...current,
                    uid: event.target.value,
                  }))
                }
                className={`${forms.select} mt-2`}
              >
                <option value="" className="bg-slate-950">
                  Select employee
                </option>

                {users.map((user) => (
                  <option
                    key={user.uid || user.id}
                    value={user.uid || user.id}
                    className="bg-slate-950"
                  >
                    {user.displayName || user.email || user.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="password-reset-new-password">
              <span
                className={`text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}
              >
                Temporary Password
              </span>

              <input
                id="password-reset-new-password"
                type="password"
                value={passwordResetForm.newPassword}
                onChange={(event) =>
                  setPasswordResetForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className={`${forms.input} mt-2`}
              />
            </label>

            <button
              type="button"
              onClick={onResetPassword}
              disabled={
                !passwordResetForm.uid ||
                passwordResetForm.newPassword.length < 8
              }
              className={`${buttons.primary} self-end disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <KeyRound className="h-4 w-4" />
              Reset Password
            </button>
          </div>
        </InfoCard>

        <InfoCard title="Current Users">
          <UsersTable
            users={users}
            onUpdateRole={onUpdateRole}
            onUpdateStatus={onUpdateStatus}
          />
        </InfoCard>
      </div>
    </section>
  );
}
