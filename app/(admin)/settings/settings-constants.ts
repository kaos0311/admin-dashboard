import type {
  AppSettings,
  CreateUserForm,
  IdentityForm,
  PasswordResetForm,
  SettingsTabKey,
  UserDraft,
  UserRole,
  UserStatus,
} from "./settings-types";

/* -------------------------------------------------------------------------- */
/* FIRESTORE                                                                  */
/* -------------------------------------------------------------------------- */

export const SETTINGS_COLLECTION = "settings";

export const SETTINGS_APP_DOC_ID = "app";

export const USERS_COLLECTION = "users";

export const AUDIT_LOGS_COLLECTION = "auditLogs";

/* -------------------------------------------------------------------------- */
/* PAGINATION / LIMITS                                                        */
/* -------------------------------------------------------------------------- */

export const USERS_PAGE_SIZE = 25;

export const RECENT_ACTIVITY_LIMIT = 25;

/* -------------------------------------------------------------------------- */
/* SETTINGS TABS                                                              */
/* -------------------------------------------------------------------------- */

export const SETTINGS_TABS: {
  key: SettingsTabKey;
  label: string;
  description: string;
}[] = [
  {
    key: "company",
    label: "Company",
    description: "Business identity and contact details.",
  },
  {
    key: "preferences",
    label: "Preferences",
    description: "Dashboard behavior and display options.",
  },
  {
    key: "users",
    label: "Users",
    description: "Manage staff and administrator access.",
  },
  {
    key: "security",
    label: "Security",
    description: "Access controls and protected workflows.",
  },
  {
    key: "danger",
    label: "Danger Zone",
    description: "High-risk reset and maintenance actions.",
  },
];

/* -------------------------------------------------------------------------- */
/* USER OPTIONS                                                               */
/* -------------------------------------------------------------------------- */

export const USER_ROLE_OPTIONS: {
  label: string;
  value: UserRole;
}[] = [
  {
    label: "Admin",
    value: "admin",
  },
  {
    label: "Staff",
    value: "staff",
  },
];

export const USER_STATUS_OPTIONS: {
  label: string;
  value: UserStatus;
}[] = [
  {
    label: "Active",
    value: "active",
  },
  {
    label: "Disabled",
    value: "disabled",
  },
  {
    label: "Pending",
    value: "pending",
  },
];

/* -------------------------------------------------------------------------- */
/* DEFAULT SETTINGS                                                           */
/* -------------------------------------------------------------------------- */

export const DEFAULT_APP_SETTINGS: AppSettings = {
  company: {
    companyName: "Advanced Home Medical",
    legalName: "Advanced Home Medical",
    phone: "",
    fax: "",
    email: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    timezone: "America/Chicago",
  },

  preferences: {
    defaultDashboardRoute: "/dashboard",
    compactTables: false,
    enableAnimations: true,
    showPhiWarnings: true,
    requireDeleteConfirmations: true,
    autoRefreshMinutes: 5,
  },

  security: {
    maintenanceMode: false,
    requireAdminForReportsReset: true,
    requireAdminForUserManagement: true,
    auditSettingsChanges: true,
    sessionTimeoutMinutes: 60,
    allowStaffExports: false,
  },
};

/* -------------------------------------------------------------------------- */
/* INITIAL STATE                                                              */
/* -------------------------------------------------------------------------- */

export const initialSettings: AppSettings =
  DEFAULT_APP_SETTINGS;

export const DEFAULT_USER_DRAFT: UserDraft = {
  email: "",
  displayName: "",
  role: "staff",
};

export const initialCreateUserForm: CreateUserForm = {
  email: "",
  displayName: "",
  password: "",
  role: "staff",
  active: true,
};

export const initialIdentityForm: IdentityForm = {
  uid: "",
  email: "",
  displayName: "",
};

export const initialPasswordResetForm: PasswordResetForm = {
  uid: "",
  newPassword: "",
};

/* -------------------------------------------------------------------------- */
/* UI                                                                         */
/* -------------------------------------------------------------------------- */

export const SETTINGS_SUCCESS_TIMEOUT = 2500;

export const SETTINGS_ERROR_TIMEOUT = 5000;

export const SETTINGS_SEARCH_DEBOUNCE = 250;


