export interface AdminAuditEntry {
  id: string;
  action: string;
  performedByUid: string;
  performedByEmail: string;
  targetUid: string | null;
  targetEmail: string | null;
  details: Record<string, unknown> | null;
  timestamp: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
}

export interface AuditLogFilterState {
  search: string;
  action: string;
  success: 'all' | 'true' | 'false';
}

export interface DateRangeFilter {
  start: Date | null;
  end: Date | null;
}
