"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
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
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronRight,
  Filter,
  House,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
  Wrench,
} from "lucide-react";

import { db, functions } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";

type UserRole = "admin" | "staff";
type ThemeMode = "light" | "dark" | "system";
type TabKey = "company" | "preferences" | "users" | "security" | "danger";

type HomeScreen =
  | "/dashboard"
  | "/dashboard/products"
  | "/dashboard/orders"
  | "/dashboard/rentals"
  | "/dashboard/users"
  | "/dashboard/settings"
  | "/dashboard/reports";

type UserRow = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
};

type AppSettings = {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  defaultTheme: ThemeMode;
  defaultHomeScreen: HomeScreen;
  compactTables: boolean;
  showDashboardCounters: boolean;
  enableOrderFilters: boolean;
  enableProductFilters: boolean;
  enableRentalFilters: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowAdminsDuringMaintenance: boolean;
  allowedUploadTypes: string;
  maxUploadSizeMb: number;
  pdfParsingEnabled: boolean;
  csvParsingEnabled: boolean;
  autoIndexAfterUpload: boolean;
  keepRawUploadsInStorage: boolean;
};

type CreateUserForm = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
};

type PasswordResetForm = {
  uid: string;
  newPassword: string;
};

type IdentityForm = {
  uid: string;
  email: string;
  displayName: string;
};

type AuditLogRow = {
  id: string;
  action: string;
  actorEmail: string;
  targetEmail: string;
  createdAtText: string;
};

const USERS_PAGE_SIZE = 100;
const RECENT_ACTIVITY_LIMIT = 8;

const initialSettings: AppSettings = {
  companyName: "",
  companyPhone: "",
  companyEmail: "",
  companyAddress: "",
  defaultTheme: "dark",
  defaultHomeScreen: "/dashboard",
  compactTables: false,
  showDashboardCounters: true,
  enableOrderFilters: true,
  enableProductFilters: true,
  enableRentalFilters: true,
  maintenanceMode: false,
  maintenanceMessage: "The admin dashboard is temporarily under maintenance.",
  allowAdminsDuringMaintenance: true,
  allowedUploadTypes: ".csv,.pdf,.xlsx",
  maxUploadSizeMb: 25,
  pdfParsingEnabled: true,
  csvParsingEnabled: true,
  autoIndexAfterUpload: true,
  keepRawUploadsInStorage: true,
};

const initialCreateUserForm: CreateUserForm = {
  email: "",
  password: "",
  displayName: "",
  role: "staff",
};

const initialPasswordResetForm: PasswordResetForm = {
  uid: "",
  newPassword: "",
};

const initialIdentityForm: IdentityForm = {
  uid: "",
  email: "",
  displayName: "",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "staff";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isHomeScreen(value: unknown): value is HomeScreen {
  return (
    value === "/dashboard" ||
    value === "/dashboard/products" ||
    value === "/dashboard/orders" ||
    value === "/dashboard/rentals" ||
    value === "/dashboard/users" ||
    value === "/dashboard/settings" ||
    value === "/dashboard/reports"
  );
}

function normalizeUser(uid: string, data: Record<string, unknown>): UserRow {
  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: isUserRole(data.role) ? data.role : "staff",
    active: typeof data.active === "boolean" ? data.active : true,
  };
}

function normalizeSettings(raw: unknown): AppSettings {
  const data = isRecord(raw) ? raw : {};

  return {
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    companyPhone: typeof data.companyPhone === "string" ? data.companyPhone : "",
    companyEmail: typeof data.companyEmail === "string" ? data.companyEmail : "",
    companyAddress:
      typeof data.companyAddress === "string" ? data.companyAddress : "",
    defaultTheme: isThemeMode(data.defaultTheme) ? data.defaultTheme : "dark",
    defaultHomeScreen: isHomeScreen(data.defaultHomeScreen)
      ? data.defaultHomeScreen
      : "/dashboard",
    compactTables:
      typeof data.compactTables === "boolean" ? data.compactTables : false,
    showDashboardCounters:
      typeof data.showDashboardCounters === "boolean"
        ? data.showDashboardCounters
        : true,
    enableOrderFilters:
      typeof data.enableOrderFilters === "boolean"
        ? data.enableOrderFilters
        : true,
    enableProductFilters:
      typeof data.enableProductFilters === "boolean"
        ? data.enableProductFilters
        : true,
    enableRentalFilters:
      typeof data.enableRentalFilters === "boolean"
        ? data.enableRentalFilters
        : true,
    maintenanceMode:
      typeof data.maintenanceMode === "boolean" ? data.maintenanceMode : false,
    maintenanceMessage:
      typeof data.maintenanceMessage === "string"
        ? data.maintenanceMessage
        : initialSettings.maintenanceMessage,
    allowAdminsDuringMaintenance:
      typeof data.allowAdminsDuringMaintenance === "boolean"
        ? data.allowAdminsDuringMaintenance
        : true,
    allowedUploadTypes:
      typeof data.allowedUploadTypes === "string"
        ? data.allowedUploadTypes
        : ".csv,.pdf,.xlsx",
    maxUploadSizeMb:
      typeof data.maxUploadSizeMb === "number" ? data.maxUploadSizeMb : 25,
    pdfParsingEnabled:
      typeof data.pdfParsingEnabled === "boolean"
        ? data.pdfParsingEnabled
        : true,
    csvParsingEnabled:
      typeof data.csvParsingEnabled === "boolean"
        ? data.csvParsingEnabled
        : true,
    autoIndexAfterUpload:
      typeof data.autoIndexAfterUpload === "boolean"
        ? data.autoIndexAfterUpload
        : true,
    keepRawUploadsInStorage:
      typeof data.keepRawUploadsInStorage === "boolean"
        ? data.keepRawUploadsInStorage
        : true,
  };
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function stableSettingsString(value: AppSettings): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

export default function SettingsPage() {
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

  const writeAuditLog = useCallback(
    async (
      action: string,
      details: Record<string, unknown> = {},
      target?: UserRow | null
    ) => {
      try {
        await setDoc(doc(collection(db, "auditLogs")), {
          action,
          actorUid: currentUid || "unknown",
          actorEmail: currentEmail || "unknown",
          targetUid: target?.uid ?? "",
          targetEmail: target?.email ?? "",
          details,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("AUDIT LOG WRITE ERROR:", error);
      }
    },
    [currentEmail, currentUid]
  );

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

      const nextSettings: AppSettings = {
        ...settings,
        maxUploadSizeMb: Number(settings.maxUploadSizeMb) || 25,
      };

      await setDoc(
        doc(db, "settings", "app"),
        {
          ...nextSettings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setSaveMessage("Settings saved.");

      await writeAuditLog("settings_updated", {
        section: activeTab,
        maintenanceMode: nextSettings.maintenanceMode,
      });

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

      const callable = httpsCallable<
        { confirmText: string },
        { ok?: boolean; deletedCollections?: string[] }
      >(functions, "softResetReports");

      const result = await callable({
        confirmText: "RESET REPORTS",
      });

      const deletedCollections = result.data.deletedCollections ?? [];

      setSoftResetMessage(
        `Reports soft reset complete. Cleared: ${
          deletedCollections.length
            ? deletedCollections.join(", ")
            : "no collection list returned"
        }.`
      );

      setSoftResetConfirm("");

      await writeAuditLog("reports_soft_reset", {
        deletedCollections,
      });

      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("REPORTS SOFT RESET ERROR:", error);
      setSoftResetMessage(getErrorMessage(error, "Reports soft reset failed."));
    } finally {
      setSoftResetting(false);
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

      const callable = httpsCallable<
        {
          email: string;
          password: string;
          displayName: string;
          role: UserRole;
        },
        { success: boolean; uid: string }
      >(functions, "adminCreateUser");

      const result = await callable({
        email: createUserForm.email.trim(),
        password: createUserForm.password.trim(),
        displayName: createUserForm.displayName.trim(),
        role: createUserForm.role,
      });

      await writeAuditLog(
        "user_created",
        {
          role: createUserForm.role,
          displayName: createUserForm.displayName.trim(),
        },
        {
          uid: result.data.uid,
          email: createUserForm.email.trim(),
          displayName: createUserForm.displayName.trim(),
          role: createUserForm.role,
          active: true,
        }
      );

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

      const callable = httpsCallable<
        { uid: string; email: string; displayName: string },
        { success: boolean }
      >(functions, "adminUpdateUserIdentity");

      await callable({
        uid: identityForm.uid,
        email: identityForm.email.trim(),
        displayName: identityForm.displayName.trim(),
      });

      setUsers((previous) =>
        previous.map((user) =>
          user.uid === identityForm.uid
            ? {
                ...user,
                email: identityForm.email.trim(),
                displayName: identityForm.displayName.trim(),
              }
            : user
        )
      );

      await writeAuditLog(
        "user_identity_updated",
        {
          previousEmail: target?.email ?? "",
          newEmail: identityForm.email.trim(),
          newDisplayName: identityForm.displayName.trim(),
        },
        target
      );

      setSaveMessage("User identity updated.");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("UPDATE USER IDENTITY ERROR:", error);
      setErrorMessage(
        getErrorMessage(error, "Failed to update username/email.")
      );
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

      const callable = httpsCallable<
        { uid: string; newPassword: string },
        { success: boolean }
      >(functions, "adminResetPassword");

      await callable({
        uid: passwordResetForm.uid,
        newPassword: passwordResetForm.newPassword.trim(),
      });

      await writeAuditLog("password_reset", {}, target);

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

      await updateDoc(doc(db, "users", user.uid), {
        role,
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog(
        "role_updated",
        {
          previousRole: user.role,
          newRole: role,
        },
        user
      );

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

      await updateDoc(doc(db, "users", user.uid), {
        active,
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog(
        active ? "user_enabled" : "user_disabled",
        {
          previousActive: user.active,
          newActive: active,
        },
        user
      );

      setSaveMessage(active ? "User enabled." : "User disabled.");
      void loadRecentActivity();
    } catch (error: unknown) {
      console.error("SET ACTIVE ERROR:", error);
      setUsers(previousUsers);
      setErrorMessage(
        getErrorMessage(error, "Failed to update user status.")
      );
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

      const callable = httpsCallable<{ uid: string }, { success: boolean }>(
        functions,
        "adminDeleteUserFully"
      );

      await callable({ uid: user.uid });

      await writeAuditLog("user_deleted_fully", {}, user);

      setUsers((previous) =>
        previous.filter((existingUser) => existingUser.uid !== user.uid)
      );

      if (identityForm.uid === user.uid) {
        setIdentityForm(initialIdentityForm);
      }

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

  if (roleLoading || settingsLoading || usersLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6 text-sm text-zinc-400">
        Loading settings...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        hasUnsavedSettings={hasUnsavedSettings}
        savingSettings={savingSettings}
        onSave={() => void saveSettings()}
        onReset={resetUnsavedSettings}
      />

      {errorMessage ? <MessageCard tone="error">{errorMessage}</MessageCard> : null}
      {saveMessage ? <MessageCard tone="success">{saveMessage}</MessageCard> : null}

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "company" ? (
        <CompanyTab
          settings={settings}
          onChange={handleSettingsChange}
          recentActivity={recentActivity}
          activityLoading={activityLoading}
        />
      ) : null}

      {activeTab === "preferences" ? (
        <PreferencesTab settings={settings} onChange={handleSettingsChange} />
      ) : null}

      {activeTab === "users" ? (
        <UsersTab
          users={users}
          filteredUsers={filteredUsers}
          userSummary={userSummary}
          search={search}
          setSearch={setSearch}
          usersRefreshing={usersRefreshing}
          loadingMoreUsers={loadingMoreUsers}
          hasMoreUsers={hasMoreUsers}
          savingUserId={savingUserId}
          deletingUserId={deletingUserId}
          currentUid={currentUid}
          adminCount={adminCount}
          createUserForm={createUserForm}
          setCreateUserForm={setCreateUserForm}
          creatingUser={creatingUser}
          identityForm={identityForm}
          setIdentityForm={setIdentityForm}
          passwordResetForm={passwordResetForm}
          setPasswordResetForm={setPasswordResetForm}
          selectedUser={selectedUser}
          isSelectedCurrentUser={isSelectedCurrentUser}
          savingIdentity={savingIdentity}
          resettingPassword={resettingPassword}
          onRefresh={() => void refreshUsers()}
          onLoadMore={() => void loadMoreUsers()}
          onCreateUser={() => void createUser()}
          onSaveIdentity={() => void saveIdentity()}
          onResetPassword={() => void resetPassword()}
          onSelectUser={selectUserForIdentity}
          onSetRole={(user, role) => void setRole(user, role)}
          onSetActive={(user, active) => void setActive(user, active)}
          onDeleteUser={(user) => void deleteUserFully(user)}
        />
      ) : null}

      {activeTab === "security" ? (
        <SecurityTab
          currentEmail={currentEmail}
          currentUid={currentUid}
          adminCount={adminCount}
          recentActivity={recentActivity}
          activityLoading={activityLoading}
          onRefreshActivity={() => void loadRecentActivity()}
        />
      ) : null}

      {activeTab === "danger" ? (
        <DangerTab
          softResetConfirm={softResetConfirm}
          setSoftResetConfirm={setSoftResetConfirm}
          softResetting={softResetting}
          softResetMessage={softResetMessage}
          onRunReportsSoftReset={() => void runReportsSoftReset()}
        />
      ) : null}
    </div>
  );
}

function PageHeader({
  hasUnsavedSettings,
  savingSettings,
  onSave,
  onReset,
}: {
  hasUnsavedSettings: boolean;
  savingSettings: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage company defaults, users, security controls, imports,
          maintenance mode, and report reset tools.
        </p>

        {hasUnsavedSettings ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Unsaved changes
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          title="Reset Changes"
          aria-label="Reset Changes"
          onClick={onReset}
          disabled={!hasUnsavedSettings || savingSettings}
          className={secondaryButtonClass}
        >
          <RotateCcw className="h-4 w-4" />
          Reset Changes
        </button>

        <button
          type="button"
          title="Save Settings"
          aria-label="Save Settings"
          onClick={onSave}
          disabled={!hasUnsavedSettings || savingSettings}
          className={primaryButtonClass}
        >
          {savingSettings ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {savingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
    { key: "company", label: "Company", icon: <Building2 className="h-4 w-4" /> },
    { key: "preferences", label: "Preferences", icon: <SlidersHorizontal className="h-4 w-4" /> },
    { key: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { key: "security", label: "Security", icon: <Lock className="h-4 w-4" /> },
    { key: "danger", label: "Danger Zone", icon: <ShieldAlert className="h-4 w-4" /> },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b1220] p-2">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              title={tab.label}
              aria-label={tab.label}
              onClick={() => onChange(tab.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompanyTab({
  settings,
  onChange,
  recentActivity,
  activityLoading,
}: {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Building2 className="h-5 w-5 text-cyan-300" />}
          title="Company Information"
          description="These values can be reused across invoices, reports, headers, and admin views."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company Name" id="company-name">
            <input
              id="company-name"
              title="Company Name"
              aria-label="Company Name"
              placeholder="Company Name"
              value={settings.companyName}
              onChange={(event) => onChange("companyName", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Company Phone" id="company-phone">
            <input
              id="company-phone"
              title="Company Phone"
              aria-label="Company Phone"
              placeholder="Company Phone"
              value={settings.companyPhone}
              onChange={(event) => onChange("companyPhone", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Company Email" id="company-email">
            <input
              id="company-email"
              title="Company Email"
              aria-label="Company Email"
              placeholder="Company Email"
              value={settings.companyEmail}
              onChange={(event) => onChange("companyEmail", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Company Address" id="company-address" wide>
            <textarea
              id="company-address"
              title="Company Address"
              aria-label="Company Address"
              placeholder="Company Address"
              rows={4}
              value={settings.companyAddress}
              onChange={(event) =>
                onChange("companyAddress", event.target.value)
              }
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>
      </section>

      <RecentActivityCard
        recentActivity={recentActivity}
        activityLoading={activityLoading}
      />
    </div>
  );
}

function PreferencesTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-cyan-300" />}
          title="Layout Defaults"
          description="Control the dashboard’s default view and interface behavior."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Default Theme" id="default-theme">
            <select
              id="default-theme"
              title="Default Theme"
              aria-label="Default Theme"
              value={settings.defaultTheme}
              onChange={(event) =>
                onChange("defaultTheme", event.target.value as ThemeMode)
              }
              className={inputClass}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </Field>

          <Field label="Default Home Screen" id="default-home-screen">
            <select
              id="default-home-screen"
              title="Default Home Screen"
              aria-label="Default Home Screen"
              value={settings.defaultHomeScreen}
              onChange={(event) =>
                onChange("defaultHomeScreen", event.target.value as HomeScreen)
              }
              className={inputClass}
            >
              <option value="/dashboard">Dashboard</option>
              <option value="/dashboard/products">Products</option>
              <option value="/dashboard/orders">Orders</option>
              <option value="/dashboard/rentals">Rentals</option>
              <option value="/dashboard/users">Users</option>
              <option value="/dashboard/settings">Settings</option>
              <option value="/dashboard/reports">Reports</option>
            </select>
          </Field>
        </div>

        <div className="mt-6 space-y-4">
          <ToggleRow label="Compact tables" icon={<LayoutDashboard className="h-4 w-4 text-zinc-400" />} checked={settings.compactTables} onChange={(checked) => onChange("compactTables", checked)} />
          <ToggleRow label="Show dashboard counters" icon={<House className="h-4 w-4 text-zinc-400" />} checked={settings.showDashboardCounters} onChange={(checked) => onChange("showDashboardCounters", checked)} />
          <ToggleRow label="Enable order filters" icon={<Filter className="h-4 w-4 text-zinc-400" />} checked={settings.enableOrderFilters} onChange={(checked) => onChange("enableOrderFilters", checked)} />
          <ToggleRow label="Enable product filters" icon={<Filter className="h-4 w-4 text-zinc-400" />} checked={settings.enableProductFilters} onChange={(checked) => onChange("enableProductFilters", checked)} />
          <ToggleRow label="Enable rental filters" icon={<Filter className="h-4 w-4 text-zinc-400" />} checked={settings.enableRentalFilters} onChange={(checked) => onChange("enableRentalFilters", checked)} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Wrench className="h-5 w-5 text-cyan-300" />}
          title="Maintenance & Imports"
          description="Production controls for uploads, parsing, indexing, and maintenance mode."
        />

        <div className="mt-6 space-y-4">
          <ToggleRow label="Maintenance mode" checked={settings.maintenanceMode} onChange={(checked) => onChange("maintenanceMode", checked)} />
          <ToggleRow label="Allow admins during maintenance" checked={settings.allowAdminsDuringMaintenance} onChange={(checked) => onChange("allowAdminsDuringMaintenance", checked)} />

          <Field label="Maintenance Message" id="maintenance-message">
            <textarea
              id="maintenance-message"
              title="Maintenance Message"
              aria-label="Maintenance Message"
              placeholder="Maintenance Message"
              rows={3}
              value={settings.maintenanceMessage}
              onChange={(event) =>
                onChange("maintenanceMessage", event.target.value)
              }
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Allowed upload types" id="allowed-upload-types">
            <input
              id="allowed-upload-types"
              title="Allowed upload types"
              aria-label="Allowed upload types"
              placeholder=".csv,.pdf,.xlsx"
              value={settings.allowedUploadTypes}
              onChange={(event) =>
                onChange("allowedUploadTypes", event.target.value)
              }
              className={inputClass}
            />
          </Field>

          <Field label="Max upload size, MB" id="max-upload-size">
            <input
              id="max-upload-size"
              title="Max upload size, MB"
              aria-label="Max upload size, MB"
              placeholder="25"
              type="number"
              min={1}
              max={100}
              value={settings.maxUploadSizeMb}
              onChange={(event) =>
                onChange("maxUploadSizeMb", Number(event.target.value))
              }
              className={inputClass}
            />
          </Field>

          <ToggleRow label="PDF parsing enabled" checked={settings.pdfParsingEnabled} onChange={(checked) => onChange("pdfParsingEnabled", checked)} />
          <ToggleRow label="CSV parsing enabled" checked={settings.csvParsingEnabled} onChange={(checked) => onChange("csvParsingEnabled", checked)} />
          <ToggleRow label="Auto-index after upload" checked={settings.autoIndexAfterUpload} onChange={(checked) => onChange("autoIndexAfterUpload", checked)} />
          <ToggleRow label="Keep raw uploads in Storage" checked={settings.keepRawUploadsInStorage} onChange={(checked) => onChange("keepRawUploadsInStorage", checked)} />
        </div>
      </section>
    </div>
  );
}

function UsersTab(props: {
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
  onRefresh: () => void;
  onLoadMore: () => void;
  onCreateUser: () => void;
  onSaveIdentity: () => void;
  onResetPassword: () => void;
  onSelectUser: (user: UserRow) => void;
  onSetRole: (user: UserRow, role: UserRole) => void;
  onSetActive: (user: UserRow, active: boolean) => void;
  onDeleteUser: (user: UserRow) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Loaded Users" value={props.userSummary.totalLoaded} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Admins" value={props.userSummary.admins} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard title="Staff" value={props.userSummary.staff} icon={<UserCog className="h-5 w-5" />} />
        <StatCard title="Active" value={props.userSummary.active} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard title="Disabled" value={props.userSummary.disabled} icon={<UserX className="h-5 w-5" />} />
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
              onClick={props.onRefresh}
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
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  props.filteredUsers.map((user) => {
                    const isSaving = props.savingUserId === user.uid;
                    const isDeleting = props.deletingUserId === user.uid;
                    const isCurrentUser = user.uid === props.currentUid;
                    const isLastAdmin =
                      user.role === "admin" && props.adminCount === 1;

                    return (
                      <tr key={user.uid} className="border-t border-white/5">
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
                              props.onSetRole(
                                user,
                                event.target.value as UserRole
                              )
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
                            {isCurrentUser ? <div className="text-cyan-300">Current user</div> : null}
                            {isLastAdmin ? <div className="text-amber-300">Last admin</div> : null}
                            {!isCurrentUser && !isLastAdmin ? <div>Standard</div> : null}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              title={user.active ? "Disable user" : "Enable user"}
                              aria-label={user.active ? "Disable user" : "Enable user"}
                              onClick={() => props.onSetActive(user, !user.active)}
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
                              onClick={() => props.onSelectUser(user)}
                              disabled={isSaving || isDeleting}
                              className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                            >
                              Edit Identity
                            </button>

                            <button
                              type="button"
                              title="Delete user fully"
                              aria-label="Delete user fully"
                              onClick={() => props.onDeleteUser(user)}
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Loaded {props.users.length} user{props.users.length === 1 ? "" : "s"}.
          </p>

          {props.hasMoreUsers ? (
            <button
              type="button"
              title="Load more users"
              aria-label="Load more users"
              onClick={props.onLoadMore}
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

function UserCreateCard(props: Parameters<typeof UsersTab>[0]) {
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
          onClick={props.onCreateUser}
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

function UserIdentityCard(props: Parameters<typeof UsersTab>[0]) {
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
              props.onSelectUser(selected);
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
          onClick={props.onSaveIdentity}
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

function UserPasswordCard(props: Parameters<typeof UsersTab>[0]) {
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
          onClick={props.onResetPassword}
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

function SecurityTab({
  currentEmail,
  currentUid,
  adminCount,
  recentActivity,
  activityLoading,
  onRefreshActivity,
}: {
  currentEmail: string;
  currentUid: string;
  adminCount: number | null;
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
  onRefreshActivity: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        <SectionHeader
          icon={<Lock className="h-5 w-5 text-cyan-300" />}
          title="Security Overview"
          description="Quick production checks for the current admin session."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoCard label="Current admin email" value={currentEmail || "Unknown"} />
          <InfoCard label="Current user UID" value={currentUid || "Unknown"} />
          <InfoCard
            label="Admin accounts"
            value={adminCount === null ? "Unable to count" : adminCount.toString()}
          />
          <InfoCard label="Audit logging" value="Enabled on admin actions" />
          <InfoCard label="Self-disable protection" value="Enabled" />
          <InfoCard label="Last-admin protection" value="Enabled" />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Password resets, account deletion, role changes, maintenance changes,
          and report resets should always appear in the full Audit Logs page.
        </div>
      </section>

      <RecentActivityCard
        recentActivity={recentActivity}
        activityLoading={activityLoading}
        onRefresh={onRefreshActivity}
      />
    </div>
  );
}

function DangerTab({
  softResetConfirm,
  setSoftResetConfirm,
  softResetting,
  softResetMessage,
  onRunReportsSoftReset,
}: {
  softResetConfirm: string;
  setSoftResetConfirm: (value: string) => void;
  softResetting: boolean;
  softResetMessage: string;
  onRunReportsSoftReset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-black/30 p-3 text-red-300">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold text-red-100">Danger Zone</h2>

          <p className="mt-2 text-sm text-red-100/80">
            Destructive controls live here. This section is intentionally
            separated so nobody nukes reports while looking for the theme toggle.
          </p>

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-black/30 p-5">
            <h3 className="font-semibold text-red-100">Reports Soft Reset</h3>

            <p className="mt-2 text-sm text-red-100/75">
              Clears imported reports, report rows, patient indexes, hospice
              indexes, insurance indexes, analytics, import jobs, and audit logs.
              It does not delete users, settings, products, orders, rentals, or
              uploaded Storage files.
            </p>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-red-100">
                Type RESET REPORTS to confirm
              </span>

              <input
                title="Soft reset confirmation"
                aria-label="Soft reset confirmation"
                placeholder="RESET REPORTS"
                value={softResetConfirm}
                onChange={(event) => setSoftResetConfirm(event.target.value)}
                disabled={softResetting}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-400/50"
              />
            </label>

            {softResetMessage ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-red-100">
                {softResetMessage}
              </div>
            ) : null}

            <button
              type="button"
              title="Soft Reset Reports"
              aria-label="Soft Reset Reports"
              onClick={onRunReportsSoftReset}
              disabled={softResetting || softResetConfirm !== "RESET REPORTS"}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {softResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Soft Reset Reports
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecentActivityCard({
  recentActivity,
  activityLoading,
  onRefresh,
}: {
  recentActivity: AuditLogRow[];
  activityLoading: boolean;
  onRefresh?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <SectionHeader
          icon={<Activity className="h-5 w-5 text-cyan-300" />}
          title="Recent Admin Activity"
          description="Last few admin actions. Full investigation stays on the Audit Logs page."
        />

        {onRefresh ? (
          <button
            type="button"
            title="Refresh activity"
            aria-label="Refresh activity"
            onClick={onRefresh}
            className={secondaryButtonClass}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        ) : null}
      </div>

      {activityLoading ? (
        <div className="rounded-xl border border-white/10 bg-[#07090d] p-4 text-sm text-zinc-400">
          Loading activity...
        </div>
      ) : recentActivity.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#07090d] p-4 text-sm text-zinc-400">
          No recent activity found.
        </div>
      ) : (
        <div className="space-y-3">
          {recentActivity.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/10 bg-[#07090d] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-white">{row.action}</div>
                <div className="text-xs text-zinc-500">{row.createdAtText}</div>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Actor: {row.actorEmail}
              </div>
              {row.targetEmail ? (
                <div className="mt-1 text-xs text-zinc-500">
                  Target: {row.targetEmail}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/dashboard/audit-logs"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200"
      >
        View full audit log
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
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
  wide = false,
  srOnly = false,
}: {
  label: string;
  id: string;
  children: ReactNode;
  wide?: boolean;
  srOnly?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}>
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

function ToggleRow({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#07090d] px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-zinc-200">
        {icon}
        {label}
      </span>
      <input
        title={label}
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07090d] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-white">{value}</p>
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

function MessageCard({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}