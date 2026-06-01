import type { Dispatch, SetStateAction } from "react";
import { Plus } from "lucide-react";
import { DEFAULT_USER_DRAFT, USER_ROLE_OPTIONS } from "../../settings-constants";
import type { UserDraft, UserRole } from "../../settings-types";
import { glassButton, primaryButton } from "../../styles/glass";
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
      title="Create User Record"
      description="This creates an app user document. Firebase Auth account and custom claims still need to be handled through your admin workflow."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto_auto]">
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

        <label className="block" htmlFor="new-user-role">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
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
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10"
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
          className={glassButton}
        >
          Clear
        </button>

        <button
          type="button"
          onClick={onCreateUser}
          className={primaryButton}
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>
    </InfoCard>
  );
}


