export type SettingsTabKey =
  | "company"
  | "preferences"
  | "inventory"
  | "brightree"
  | "apis"
  | "vendor-research"
  | "improvements"
  | "users"
  | "security"
  | "danger";

export type TabKey = SettingsTabKey;

export type UserRole = "admin" | "staff" | "tank";

export type UserStatus = "active" | "disabled" | "pending";

export type CompanySettings = {
  companyName: string;
  legalName: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  timezone: string;
};

export type PreferenceSettings = {
  defaultDashboardRoute: string;
  compactTables: boolean;
  enableAnimations: boolean;
  showPhiWarnings: boolean;
  requireDeleteConfirmations: boolean;
  autoRefreshMinutes: number;
};

export type SecuritySettings = {
  maintenanceMode: boolean;
  requireAdminForReportsReset: boolean;
  requireAdminForUserManagement: boolean;
  auditSettingsChanges: boolean;
  sessionTimeoutMinutes: number;
  allowStaffExports: boolean;
};

export type InventorySettings = {
  defaultReorderLevel: number;
  cpapSupplyReorderLevel: number;
  oxygenReorderLevel: number;
  rentalEquipmentReorderLevel: number;
  highDemandReorderLevel: number;
  lowStockWarningEnabled: boolean;
  jarvisRecallInternetScanEnabled: boolean;
  jarvisRecallScanNewProductsEnabled: boolean;
  jarvisDiscontinuedInternetScanEnabled: boolean;
  jarvisDiscontinuedScanNewProductsEnabled: boolean;
};

export type BrightreeReferenceRecord = {
  id: string;
  name: string;
  description?: string;
  group?: string;
  address?: string;
  phone?: string;
  fax?: string;
  itemGroupNo?: string;
  paymentType?: string;
};

export type BrightreeReferenceKey =
  | "insuranceGroups"
  | "practitionerNoteReasons"
  | "pickupExchangeReasons"
  | "itemGroups"
  | "planTypes"
  | "manufacturers"
  | "insuranceCompanies"
  | "paymentReasons";

export type BrightreeReferenceSettings = Record<
  BrightreeReferenceKey,
  BrightreeReferenceRecord[]
>;

export type AppSettings = {
  company: CompanySettings;
  preferences: PreferenceSettings;
  security: SecuritySettings;
  inventory: InventorySettings;
  brightreeReferences: BrightreeReferenceSettings;
  updatedAt?: unknown;
  updatedBy?: string;
};

export type AdminUser = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  active: boolean;
  disabled?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
};

export type UserRow = AdminUser;

export type CreateUserForm = {
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
  active: boolean;
};

export type IdentityForm = {
  uid: string;
  email: string;
  displayName: string;
};

export type PasswordResetForm = {
  uid: string;
  newPassword: string;
};

export type UserDraft = {
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
};

export type AuditLogRow = {
  id: string;
  action: string;
  actorEmail: string;
  actorName?: string;
  actorUid?: string;
  target?: string;
  targetId?: string;
  targetEmail?: string;
  message?: string;
  collection?: string;
  documentId?: string;
  type?: string;
  createdAt?: unknown;
  timestamp?: unknown;
  createdAtText?: string;
  metadata?: Record<string, unknown>;
};

export type VendorResearchSite = {
  id: string;
  name: string;
  url: string;
  category: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedByEmail?: string;
};

export type ImprovementProposalStatus = "pending" | "approved" | "rejected" | "applied";

export type ImprovementProposal = {
  id: string;
  title: string;
  description: string;
  category: "ui" | "api" | "data" | "security" | "automation" | "other";
  priority: "low" | "medium" | "high";
  status: ImprovementProposalStatus;
  proposedChanges: string;
  estimatedImpact: string;
  proposedByUid: string;
  proposedByEmail: string;
  approvedByUid?: string;
  approvedByEmail?: string;
  rejectionReason?: string;
  appliedAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
};

export type SettingsMessage = {
  type: "success" | "error" | "info";
  text: string;
};


