/**
 * Administrative audit log action types.
 *
 * Every admin action performed in the dashboard must produce an audit entry.
 * Add new actions here as the system grows.
 */
export type AdminAuditAction =
  | "user_created"
  | "user_deleted"
  | "user_password_reset"
  | "user_role_updated"
  | "user_status_updated"
  | "settings_saved"
  | "maintenance_mode_enabled"
  | "maintenance_mode_disabled"
  | "api_key_changed"
  | "vendor_settings_changed"
  | "brightree_config_changed"
  | "database_clean_completed"
  | "database_clean_dry_run"
  | "system_rebuild"
  | "report_reset"
  | "custom";

/**
 * Immutable audit log entry written to Firestore by Cloud Functions.
 */
export interface AdminAuditEntry {
  action: AdminAuditAction | string;

  performedByUid: string;
  performedByEmail: string;

  targetUid: string | null;
  targetEmail: string | null;

  details: Record<string, unknown>;

  timestamp: unknown; // FieldValue.serverTimestamp()

  ipAddress: string | null;
  userAgent: string | null;

  success: boolean;
  failureReason: string | null;
}

/**
 * Input payload for writing an audit entry.
 * timestamp is always server-side; omitted here.
 */
export interface AdminAuditEntryInput {
  action: AdminAuditAction | string;
  performedByUid: string;
  performedByEmail: string;
  targetUid?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  failureReason?: string | null;
}
