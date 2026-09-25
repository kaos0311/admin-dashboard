"use client";

import {
  type Dispatch,
  type SetStateAction,
  useState,
} from "react";

import {
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";

import {
  buttons,
  forms,
  typography,
} from "@/theme";

import {
  DEFAULT_USER_DRAFT,
  USER_ROLE_OPTIONS,
} from "../../settings-constants";

import type {
  UserDraft,
  UserRole,
} from "../../settings-types";

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
  const [isCreating, setIsCreating] = useState(false);

  const emailIsValid =
    userDraft.email.trim().length > 0 &&
    userDraft.email.includes("@");

  const passwordIsValid =
    userDraft.password.length >= 8;

  const displayNameIsValid =
    userDraft.displayName.trim().length > 0;

  const canCreate =
    emailIsValid &&
    passwordIsValid &&
    displayNameIsValid &&
    !isCreating;

  function clearForm(): void {
    if (isCreating) {
      return;
    }

    setUserDraft(DEFAULT_USER_DRAFT);
  }

  async function handleCreateUser(): Promise<void> {
    if (!canCreate) {
      console.warn(
        "[UserCreateCard] Create blocked by validation",
        {
          emailIsValid,
          passwordIsValid,
          displayNameIsValid,
          isCreating,
        }
      );

      return;
    }

    console.log(
      "[UserCreateCard] Create button pressed"
    );

    setIsCreating(true);

    try {
      await onCreateUser();

      console.log(
        "[UserCreateCard] Create handler completed"
      );
    } catch (error) {
      console.error(
        "[UserCreateCard] Create handler failed",
        error
      );
    } finally {
      setIsCreating(false);

      console.log(
        "[UserCreateCard] Create button restored"
      );
    }
  }

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

        <label
          className="block"
          htmlFor="new-user-role"
        >
          <span
            className={`text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}
          >
            Role
          </span>

          <select
            id="new-user-role"
            value={userDraft.role}
            aria-label="New user role"
            disabled={isCreating}
            onChange={(event) =>
              setUserDraft((current) => ({
                ...current,
                role: event.target.value as UserRole,
              }))
            }
            className={`${forms.select} mt-2 disabled:cursor-not-allowed disabled:opacity-50`}
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
          onClick={clearForm}
          disabled={isCreating}
          className={`${buttons.secondary} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <RotateCcw className="h-4 w-4" />
          Clear
        </button>

        <button
          type="button"
          onClick={() => {
            void handleCreateUser();
          }}
          disabled={!canCreate}
          aria-busy={isCreating}
          className={`${buttons.primary} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}

          {isCreating ? "Creating..." : "Create"}
        </button>
      </div>

      <div
        className={`mt-4 text-xs ${typography.bodyMuted}`}
      >
        {!userDraft.email.trim()
          ? "Enter an email address."
          : !emailIsValid
            ? "Enter a valid email address."
            : !displayNameIsValid
              ? "Enter the employee display name."
              : !passwordIsValid
                ? "Temporary password must be at least 8 characters."
                : "Ready to create the employee login."}
      </div>
    </InfoCard>
  );
}