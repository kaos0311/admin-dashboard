import type {
  AppSettings,
  CreateUserForm,
  IdentityForm,
  PasswordResetForm,
} from "./settings-types";

export const USERS_PAGE_SIZE = 100;
export const RECENT_ACTIVITY_LIMIT = 8;

export const initialSettings: AppSettings = {
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

export const initialCreateUserForm: CreateUserForm = {
  email: "",
  password: "",
  displayName: "",
  role: "staff",
};

export const initialPasswordResetForm: PasswordResetForm = {
  uid: "",
  newPassword: "",
};

export const initialIdentityForm: IdentityForm = {
  uid: "",
  email: "",
  displayName: "",
};

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#07090d] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";