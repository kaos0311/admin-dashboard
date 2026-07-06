import type { Dispatch, SetStateAction } from "react";
import { Plus } from "lucide-react";
import { buttons, forms, typography } from "@/theme";
import { DEFAULT_USER_DRAFT, USER_ROLE_OPTIONS } from "../../settings-constants";
import type { UserDraft, UserRole } from "../../settings-types";
import { Field } from "../shared/Field";
import { InfoCard } from "../shared/InfoCard";

type UserCreateCardProps = {
  userDraft: UserDraft;
  setUserDraft: Dispatch<SetStateAction<UserDraft>>;
  onCreateUser: () => Promise<void>;
};

export function UserCreateCard({
  userDraft,
  setUserDraft,
  onCreateUser,
}: UserCreateCardProps) {
  return (
    <InfoCard
      title="Create Employee Login"
      description="Creates the Firebase Auth account, assigns the dashboard role claim, and writes the app user record."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_220px_180px_auto_auto]">
        <Field
          id="new-user-email"
          label="Email"
          type="email"
          value={userDraft.email}
          onChange={(value) =>
            setUserDraft((current) => ({
              ...current,
              email: value,
            }))
          }
          placeholder="user@example.com"
        />

        <Field
          id="new-user-display-name"
          label="Display Name"
          value={userDraft.displayName}
          onChange={(value) =>
            setUserDraft((current) => ({
              ...current,
              displayName: value,
            }))
          }
          placeholder="Full name"
        />

        <Field
          id="new-user-password"
          label="Temporary Password"
          type="password"
          value={userDraft.password}
          onChange={(value) =>
            setUserDraft((current) => ({
              ...current,
              password: value,
            }))
          }
          placeholder="Minimum 8 characters"
        />

        <label className="block" htmlFor="new-user-role">
          <span
            className={`text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}
          >
            Role
          </span>

          <select
            id="new-user-role"
            value={userDraft.role}
            aria-label="New user role"
            onChange={(event) =>
              setUserDraft((current) => ({
                ...current,
                role: event.target.value as UserRole,
              }))
            }
            className={`${forms.select} mt-2`}
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
        </label>

        <button
          type="button"
          onClick={() => setUserDraft(DEFAULT_USER_DRAFT)}
          className={buttons.secondary}
        >
          Clear
        </button>

        <button
          type="button"
          onClick={onCreateUser}
          disabled={
            !userDraft.email.trim() ||
            userDraft.password.length < 8
          }
          className={buttons.primary}
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>
    </InfoCard>
  );
}



