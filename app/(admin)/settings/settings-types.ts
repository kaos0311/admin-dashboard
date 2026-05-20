export type UserRole = "admin" | "staff";
export type ThemeMode = "light" | "dark" | "system";
export type TabKey = "company" | "preferences" | "users" | "security" | "danger";

export type HomeScreen =
  | "/dashboard"
  | "/dashboard/products"
  | "/dashboard/orders"
  | "/dashboard/rentals"
  | "/dashboard/users"
  | "/dashboard/settings"
  | "/dashboard/reports";

export type UserRow = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
};

export type AppSettings = {
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

export type CreateUserForm = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
};

export type PasswordResetForm = {
  uid: string;
  newPassword: string;
};

export type IdentityForm = {
  uid: string;
  email: string;
  displayName: string;
};

export type AuditLogRow = {
  id: string;
  action: string;
  actorEmail: string;
  targetEmail: string;
  createdAtText: string;
};