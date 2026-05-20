"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";

import {
  RECENT_ACTIVITY_LIMIT,
  USERS_PAGE_SIZE,
  initialCreateUserForm,
  initialIdentityForm,
  initialPasswordResetForm,
  initialSettings,
} from "./settings-constants";

import {
  createUserAction,
  deleteUserFullyAction,
  resetPasswordAction,
  runDatabaseResetAction,
  runReportsSoftResetAction,
  saveAppSettingsAction,
  saveIdentityAction,
  setUserActiveAction,
  setUserRoleAction,
} from "./settings-actions";

import type {
  AppSettings,
  AuditLogRow,
  CreateUserForm,
  IdentityForm,
  PasswordResetForm,
  TabKey,
  UserRole,
  UserRow,
} from "./settings-types";

import {
  getErrorMessage,
  normalizeSettings,
  normalizeUser,
  stableSettingsString,
} from "./settings-utils";

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export function useSettingsPage() {
  const authRole = useAuthRole();
  const { loading: roleLoading, isAdmin } = authRole;

  const currentUser =
    "user" in authRole && authRole.user
      ? (authRole.user as { uid?: string; email?: string | null })
      : null;

  const currentUid = currentUser?.uid ?? "";
  const currentEmail = currentUser?.email ?? "";

  const [activeTab, setActiveTab] = useState<TabKey>("company");

  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [savedSettings, setSavedSettings] =
    useState<AppSettings>(initialSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersRefreshing, setUsersRefreshing] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [lastUserCursor, setLastUserCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [recentActivity, setRecentActivity] = useState<AuditLogRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [adminCount, setAdminCount] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [createUserForm, setCreateUserForm] =
    useState<CreateUserForm>(initialCreateUserForm);
  const [identityForm, setIdentityForm] =
    useState<IdentityForm>(initialIdentityForm);
  const [passwordResetForm, setPasswordResetForm] =
    useState<PasswordResetForm>(initialPasswordResetForm);

  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [softResetConfirm, setSoftResetConfirm] = useState("");
  const [softResetting, setSoftResetting] = useState(false);
  const [softResetMessage, setSoftResetMessage] = useState("");

  const [databaseResetConfirm, setDatabaseResetConfirm] = useState("");
  const [databaseResetting, setDatabaseResetting] = useState(false);
  const [databaseResetMessage, setDatabaseResetMessage] = useState("");

  const hasUnsavedSettings =
    stableSettingsString(settings) !== stableSettingsString(savedSettings);

  const selectedUser = useMemo(
    () =>
      users.find(
        (user) =>
          user.uid === identityForm.uid || user.uid === passwordResetForm.uid
      ) ?? null,
    [identityForm.uid, passwordResetForm.uid, users]
  );

  const isSelectedCurrentUser = selectedUser?.uid === currentUid;

  const userSummary = useMemo(() => {
    let admins = 0;
    let staff = 0;
    let active = 0;
    let disabled = 0;

    for (const user of users) {
      if (user.role === "admin") admins += 1;
      if (user.role === "staff") staff += 1;
      if (user.active) active += 1;
      else disabled += 1;
    }

    return {
      totalLoaded: users.length,
      admins,
      staff,
      active,
      disabled,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) => {
      const status = user.active ? "active" : "disabled";

      return [user.email, user.displayName, user.role, status, user.uid]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [users, debouncedSearch]);

  const refreshAdminCount = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const countQuery = query(
        collection(db, "users"),
        where("role", "==", "admin")
      );

      const result = await getCountFromServer(countQuery);
      setAdminCount(result.data().count);
    } catch (error) {
      console.error("ADMIN COUNT ERROR:", error);
      setAdminCount(null);
    }
  }, [isAdmin]);

  const loadRecentActivity = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setActivityLoading(true);

      const activityQuery = query(
        collection(db, "auditLogs"),
        orderBy("createdAt", "desc"),
        limit(RECENT_ACTIVITY_LIMIT)
      );

      const snapshot = await getDocs(activityQuery);

      const rows: AuditLogRow[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAt =
          data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate().toLocaleString()
            : "Pending";

        return {
          id: docSnap.id,
          action: typeof data.action === "string" ? data.action : "unknown",
          actorEmail:
            typeof data.actorEmail === "string" ? data.actorEmail : "unknown",
          targetEmail:
            typeof data.targetEmail === "string" ? data.targetEmail : "",
          createdAtText: createdAt,
        };
      });

      setRecentActivity(rows);
    } catch (error) {
      console.error("RECENT ACTIVITY LOAD ERROR:", error);
    } finally {
      setActivityLoading(false);
    }
  }, [isAdmin]);

  const refreshUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setUsersRefreshing(true);
      setErrorMessage("");

      const usersQuery = query(
        collection(db, "users"),
        orderBy("email", "asc"),
        limit(USERS_PAGE_SIZE)
      );

      const snapshot = await getDocs(usersQuery);

      const rows = snapshot.docs.map((docSnap) =>
        normalizeUser(docSnap.id, docSnap.data())
      );

      setUsers(rows);
      setHasMoreUsers(snapshot.docs.length === USERS_PAGE_SIZE);
      setLastUserCursor(snapshot.docs.at(-1) ?? null);

      if (identityForm.uid) {
        const stillExists = rows.some((user) => user.uid === identityForm.uid);

        if (!stillExists) {
          setIdentityForm(initialIdentityForm);
          setPasswordResetForm(initialPasswordResetForm);
        }
      }

      void refreshAdminCount();
    } catch (error: unknown) {
      console.error("USERS REFRESH ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to refresh users."));
    } finally {
      setUsersRefreshing(false);
    }
  }, [identityForm.uid, isAdmin, refreshAdminCount]);

  const loadMoreUsers = useCallback(async () => {
    if (!isAdmin || !lastUserCursor) return;

    try {
      setLoadingMoreUsers(true);
      setErrorMessage("");

      const usersQuery = query(
        collection(db, "users"),
        orderBy("email", "asc"),
        startAfter(lastUserCursor),
        limit(USERS_PAGE_SIZE)
      );

      const snapshot = await getDocs(usersQuery);

      const rows = snapshot.docs.map((docSnap) =>
        normalizeUser(docSnap.id, docSnap.data())
      );

      setUsers((previous) => [...previous, ...rows]);
      setHasMoreUsers(snapshot.docs.length === USERS_PAGE_SIZE);
      setLastUserCursor(snapshot.docs.at(-1) ?? null);
    } catch (error: unknown) {
      console.error("LOAD MORE USERS ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to load more users."));
    } finally {
      setLoadingMoreUsers(false);
    }
  }, [isAdmin, lastUserCursor]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (roleLoading) return;

      if (!isAdmin) {
        setSettingsLoading(false);
        return;
      }

      try {
        setSettingsLoading(true);
        setErrorMessage("");

        const snapshot = await getDoc(doc(db, "settings", "app"));

        if (cancelled) return;

        const normalized = snapshot.exists()
          ? normalizeSettings(snapshot.data())
          : initialSettings;

        setSettings(normalized);
        setSavedSettings(normalized);
      } catch (error: unknown) {
        console.error("SETTINGS LOAD ERROR:", error);

        if (!cancelled) {
          setErrorMessage(getErrorMessage(error, "Failed to load settings."));
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, roleLoading]);

  useEffect(() => {
    let cancelled = false;

    async function initialUsersLoad() {
      if (roleLoading) return;

      if (!isAdmin) {
        setUsersLoading(false);
        return;
      }

      try {
        setUsersLoading(true);
        setErrorMessage("");

        const usersQuery = query(
          collection(db, "users"),
          orderBy("email", "asc"),
          limit(USERS_PAGE_SIZE)
        );

        const snapshot = await getDocs(usersQuery);

        if (cancelled) return;

        const rows = snapshot.docs.map((docSnap) =>
          normalizeUser(docSnap.id, docSnap.data())
        );

        setUsers(rows);
        setHasMoreUsers(snapshot.docs.length === USERS_PAGE_SIZE);
        setLastUserCursor(snapshot.docs.at(-1) ?? null);

        void refreshAdminCount();
      } catch (error: unknown) {
        console.error("USERS INITIAL LOAD ERROR:", error);

        if (!cancelled) {
          setErrorMessage(getErrorMessage(error, "Failed to load users."));
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
          setUsersRefreshing(false);
          setLoadingMoreUsers(false);
        }
      }
    }

    void initialUsersLoad();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, refreshAdminCount, roleLoading]);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      void loadRecentActivity();
    }
  }, [isAdmin, loadRecentActivity, roleLoading]);

  function handleSettingsChange<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function resetUnsavedSettings() {
    setSettings(savedSettings);
    setSaveMessage("Unsaved changes reset.");
    setErrorMessage("");
  }

  async function saveSettings() {
    try {
      setSavingSettings(true);
      setErrorMessage("");
      setSaveMessage("");

      const nextSettings = await saveAppSettingsAction({
        settings,
        actorUid: currentUid,
        actorEmail: currentEmail,
        activeTab,
      });

      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setSaveMessage("Settings saved.");

      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("SAVE SETTINGS ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to save settings."));
    } finally {
      setSavingSettings(false);
    }
  }

  async function runReportsSoftReset() {
    if (softResetConfirm !== "RESET REPORTS") {
      setSoftResetMessage("Type RESET REPORTS to confirm.");
      return;
    }

    try {
      setSoftResetting(true);
      setErrorMessage("");
      setSaveMessage("");
      setSoftResetMessage("");

      const deletedCollections = await runReportsSoftResetAction({
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setSoftResetMessage(
        `Reports soft reset complete. Cleared: ${
          deletedCollections.length
            ? deletedCollections.join(", ")
            : "no collection list returned"
        }.`
      );

      setSoftResetConfirm("");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("REPORTS SOFT RESET ERROR:", error);
      setSoftResetMessage(getErrorMessage(error, "Reports soft reset failed."));
    } finally {
      setSoftResetting(false);
    }
  }

  async function runDatabaseReset() {
    if (databaseResetConfirm !== "RESET DATABASE") {
      setDatabaseResetMessage("Type RESET DATABASE to confirm.");
      return;
    }

    try {
      setDatabaseResetting(true);
      setErrorMessage("");
      setSaveMessage("");
      setDatabaseResetMessage("");

      const clearedCollections = await runDatabaseResetAction({
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setDatabaseResetMessage(
        `Database reset complete. Cleared: ${
          clearedCollections.length
            ? clearedCollections.join(", ")
            : "no collection list returned"
        }.`
      );

      setDatabaseResetConfirm("");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("DATABASE RESET ERROR:", error);
      setDatabaseResetMessage(getErrorMessage(error, "Database reset failed."));
    } finally {
      setDatabaseResetting(false);
    }
  }

  async function createUser() {
    if (!createUserForm.email.trim()) {
      setErrorMessage("New user email is required.");
      return;
    }

    if (createUserForm.password.trim().length < 6) {
      setErrorMessage("New user password must be at least 6 characters.");
      return;
    }

    try {
      setCreatingUser(true);
      setErrorMessage("");
      setSaveMessage("");

      await createUserAction({
        form: createUserForm,
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setCreateUserForm(initialCreateUserForm);
      setSaveMessage("User created.");

      await refreshUsers();
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("CREATE USER ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to create user."));
    } finally {
      setCreatingUser(false);
    }
  }

  async function saveIdentity() {
    if (!identityForm.uid) {
      setErrorMessage("Select a user first.");
      return;
    }

    if (!identityForm.email.trim()) {
      setErrorMessage("Updated email is required.");
      return;
    }

    const target = users.find((user) => user.uid === identityForm.uid) ?? null;

    try {
      setSavingIdentity(true);
      setErrorMessage("");
      setSaveMessage("");

      const updated = await saveIdentityAction({
        form: identityForm,
        target,
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setUsers((previous) =>
        previous.map((user) =>
          user.uid === identityForm.uid
            ? {
                ...user,
                email: updated.email,
                displayName: updated.displayName,
              }
            : user
        )
      );

      setSaveMessage("User identity updated.");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("UPDATE USER IDENTITY ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to update username/email."));
    } finally {
      setSavingIdentity(false);
    }
  }

  async function resetPassword() {
    if (!passwordResetForm.uid) {
      setErrorMessage("Select a user first.");
      return;
    }

    if (passwordResetForm.newPassword.trim().length < 6) {
      setErrorMessage("New password must be at least 6 characters.");
      return;
    }

    const target =
      users.find((user) => user.uid === passwordResetForm.uid) ?? null;

    try {
      setResettingPassword(true);
      setErrorMessage("");
      setSaveMessage("");

      await resetPasswordAction({
        form: passwordResetForm,
        target,
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setPasswordResetForm(initialPasswordResetForm);
      setSaveMessage("Password reset.");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("RESET PASSWORD ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to reset password."));
    } finally {
      setResettingPassword(false);
    }
  }

  async function setRole(user: UserRow, role: UserRole) {
    if (user.uid === currentUid && user.role === "admin" && role !== "admin") {
      setErrorMessage("You cannot remove your own admin role.");
      return;
    }

    if (user.role === "admin" && role !== "admin" && adminCount === 1) {
      setErrorMessage("You cannot remove the last remaining admin.");
      return;
    }

    const previousUsers = users;

    try {
      setSavingUserId(user.uid);
      setErrorMessage("");
      setSaveMessage("");

      setUsers((previous) =>
        previous.map((row) => (row.uid === user.uid ? { ...row, role } : row))
      );

      await setUserRoleAction({
        user,
        role,
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setSaveMessage("Role updated.");
      void refreshAdminCount();
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("SET ROLE ERROR:", error);
      setUsers(previousUsers);
      setErrorMessage(getErrorMessage(error, "Failed to update role."));
    } finally {
      setSavingUserId(null);
    }
  }

  async function setActive(user: UserRow, active: boolean) {
    if (user.uid === currentUid && !active) {
      setErrorMessage("You cannot disable your own account.");
      return;
    }

    if (user.role === "admin" && !active && adminCount === 1) {
      setErrorMessage("You cannot disable the last remaining admin.");
      return;
    }

    const previousUsers = users;

    try {
      setSavingUserId(user.uid);
      setErrorMessage("");
      setSaveMessage("");

      setUsers((previous) =>
        previous.map((row) => (row.uid === user.uid ? { ...row, active } : row))
      );

      await setUserActiveAction({
        user,
        active,
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setSaveMessage(active ? "User enabled." : "User disabled.");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("SET ACTIVE ERROR:", error);
      setUsers(previousUsers);
      setErrorMessage(getErrorMessage(error, "Failed to update user status."));
    } finally {
      setSavingUserId(null);
    }
  }

  async function deleteUserFully(user: UserRow) {
    if (user.uid === currentUid) {
      setErrorMessage("You cannot fully delete your own account.");
      return;
    }

    if (user.role === "admin" && adminCount === 1) {
      setErrorMessage("You cannot delete the last remaining admin.");
      return;
    }

    const confirmed = window.confirm(
      `Fully delete ${user.email || user.uid}?\n\nThis removes their Firebase Auth account and Firestore user document.`
    );

    if (!confirmed) return;

    try {
      setDeletingUserId(user.uid);
      setErrorMessage("");
      setSaveMessage("");

      await deleteUserFullyAction({
        user,
        actorUid: currentUid,
        actorEmail: currentEmail,
      });

      setUsers((previous) =>
        previous.filter((existingUser) => existingUser.uid !== user.uid)
      );

      if (identityForm.uid === user.uid) setIdentityForm(initialIdentityForm);
      if (passwordResetForm.uid === user.uid) {
        setPasswordResetForm(initialPasswordResetForm);
      }

      setSaveMessage("User fully deleted.");
      void refreshAdminCount();
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("DELETE USER FULLY ERROR:", error);
      setErrorMessage(getErrorMessage(error, "Failed to fully delete user."));
    } finally {
      setDeletingUserId(null);
    }
  }

  function selectUserForIdentity(user: UserRow) {
    setIdentityForm({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    setPasswordResetForm((previous) => ({
      ...previous,
      uid: user.uid,
    }));
  }

  return {
    roleLoading,
    isAdmin,
    currentUid,
    currentEmail,

    activeTab,
    setActiveTab,

    settings,
    savedSettings,
    settingsLoading,
    hasUnsavedSettings,
    handleSettingsChange,
    resetUnsavedSettings,
    saveSettings,
    savingSettings,

    users,
    filteredUsers,
    usersLoading,
    usersRefreshing,
    loadingMoreUsers,
    hasMoreUsers,
    refreshUsers,
    loadMoreUsers,

    recentActivity,
    activityLoading,
    loadRecentActivity,

    adminCount,
    search,
    setSearch,

    saveMessage,
    errorMessage,

    createUserForm,
    setCreateUserForm: setCreateUserForm as Dispatch<
      SetStateAction<CreateUserForm>
    >,
    creatingUser,
    createUser,

    identityForm,
    setIdentityForm: setIdentityForm as Dispatch<SetStateAction<IdentityForm>>,
    passwordResetForm,
    setPasswordResetForm: setPasswordResetForm as Dispatch<
      SetStateAction<PasswordResetForm>
    >,

    selectedUser,
    isSelectedCurrentUser,
    savingIdentity,
    saveIdentity,

    resettingPassword,
    resetPassword,

    savingUserId,
    deletingUserId,
    setRole,
    setActive,
    deleteUserFully,
    selectUserForIdentity,

    userSummary,

    softResetConfirm,
    setSoftResetConfirm,
    softResetting,
    softResetMessage,
    runReportsSoftReset,

    databaseResetConfirm,
    setDatabaseResetConfirm,
    databaseResetting,
    databaseResetMessage,
    runDatabaseReset,
  };
}