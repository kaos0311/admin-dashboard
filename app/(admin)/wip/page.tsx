"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  FileWarning,
  Filter,
  MessageSquareText,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

import { db } from "@/lib/firebase";

type ReviewBucket = "resolved" | "unresolved" | "pending" | "needs_review";
type SortMode = "oldest" | "newest" | "patient" | "charge" | "allow";
type AgingSeverity = "normal" | "warning" | "critical" | "overdue";
type UserRole = "admin" | "staff" | "unknown";

type WipRow = {
  id: string;
  reportId?: string;
  reportType?: string;
  sourceReportId?: string;
  sourceRowId?: string;
  deletedFromWip?: boolean;
  deletedAt?: unknown;
  deletedBy?: string;
  SOKey?: string | number;
  PatientName?: string;
  PtKey?: string | number;
  PatientID?: string | number;
  PatientAccountNumber?: string;
  SOTypeName?: string;
  SOStatus?: string;
  BranchName?: string;
  InsVerified?: string | boolean;
  CovVerified?: string | boolean;
  ManHold?: string | boolean;
  Reference?: string;
  CreateDate?: string;
  SchedDeliveryDate?: string;
  ActualDeliveryDate?: string;
  OrderingDoctorName?: string;
  IsConfirmed?: string | boolean;
  Qty?: string | number;
  SaleType?: string;
  ItemDescription?: string;
  HCPC?: string;
  Mod1?: string;
  Mod2?: string;
  Mod3?: string;
  Mod4?: string;
  ExtChargeAmt?: string | number;
  ExtAllowAmt?: string | number;
  PARExpDate?: string;
  PARInitialDate?: string;
  PARLogged?: string | boolean;
  PARLoggedCount?: string | number;
  PARTotalCount?: string | number;
  CMNExpDate?: string;
  CMNInitialDate?: string;
  CMNLogged?: string | boolean;
  CMNLoggedCount?: string | number;
  CMNTotalCount?: string | number;
  Username?: string;
  SODtlKey?: string | number;
  proccode?: string;
  SOClassificationName?: string;
  WIPStatusName?: string;
  WIPDaysInState?: string | number;
  WIPAssignedTo?: string;
  WIPDateNeeded?: string;
  WIPCompleted?: string | boolean;
  PrimaryInsuranceName?: string;
  IsPrimaryVerified?: string | boolean;
  SecondaryInsuranceName?: string;
  IsSecondaryVerified?: string | boolean;
  TopFourDiagCodes?: string;
  SODiagCodes?: string;
  PrimaryDoctorName?: string;
  PractitionerName?: string;
  MarketingRepName?: string;
  DeliveryTechName?: string;
  ConfirmedByName?: string;
  CreatedByName?: string;
  "Patient Branch Name"?: string;
  wipReviewStatus?: ReviewBucket;
  wipReviewNotes?: string;
  wipReviewUpdatedAt?: unknown;
  wipReviewUpdatedBy?: string;
  staleOwnership?: boolean;
};

type PatientGroup = {
  key: string;
  patientName: string;
  patientId: string;
  accountNumber: string;
  assignedTo: string;
  rows: WipRow[];
  totalCharge: number;
  totalAllow: number;
  oldestDays: number;
  newestDays: number;
  fixItems: string[];
  reviewBucket: ReviewBucket;
  notes: string;
  severity: AgingSeverity;
};

type DeletedSnapshot = {
  deletedRows: WipRow[];
  deletedAtLabel: string;
};

const PAGE_LIMIT = 3000;

const REVIEW_LABELS: Record<ReviewBucket, string> = {
  resolved: "Resolved",
  unresolved: "Unresolved",
  pending: "Pending",
  needs_review: "Needs Further Review",
};

const SEVERITY_LABELS: Record<AgingSeverity, string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  overdue: "Overdue",
};

function safeText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim() || fallback;
}

function blankText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = typeof value === "string" ? value.replace(/[$,]/g, "").trim() : value;
  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function money(value: unknown): string {
  return safeNumber(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const normalized = String(value ?? "").trim().toLowerCase();

  return ["true", "yes", "y", "1", "verified", "complete", "completed"].includes(
    normalized
  );
}

function assignedName(row: WipRow): string {
  return safeText(row.WIPAssignedTo || row.Username || row.CreatedByName, "Unassigned");
}

function patientKey(row: WipRow): string {
  const id = blankText(row.PtKey || row.PatientID || row.PatientAccountNumber);
  const name = safeText(row.PatientName, "Unknown Patient");
  return `${id || name}-${assignedName(row)}`;
}

function agingSeverity(days: number): AgingSeverity {
  if (days >= 30) return "overdue";
  if (days >= 15) return "critical";
  if (days >= 8) return "warning";
  return "normal";
}

function rowBucket(row: WipRow): ReviewBucket {
  if (row.wipReviewStatus) return row.wipReviewStatus;

  const completed = boolish(row.WIPCompleted);
  const status = blankText(row.WIPStatusName).toLowerCase();
  const days = safeNumber(row.WIPDaysInState);

  if (completed || status.includes("complete") || status.includes("resolved")) {
    return "resolved";
  }

  if (
    status.includes("pending") ||
    status.includes("waiting") ||
    status.includes("hold")
  ) {
    return "pending";
  }

  if (
    days >= 30 ||
    boolish(row.ManHold) ||
    status.includes("denial") ||
    status.includes("review") ||
    !boolish(row.InsVerified) ||
    !boolish(row.CovVerified) ||
    !boolish(row.IsPrimaryVerified)
  ) {
    return "needs_review";
  }

  return "unresolved";
}

function getFixItems(rows: WipRow[]): string[] {
  const fixes = new Set<string>();

  rows.forEach((row) => {
    const days = safeNumber(row.WIPDaysInState);
    const status = blankText(row.WIPStatusName).toLowerCase();

    if (!boolish(row.InsVerified) && !boolish(row.IsPrimaryVerified)) {
      fixes.add("Verify insurance");
    }

    if (!boolish(row.CovVerified)) fixes.add("Verify coverage");
    if (boolish(row.ManHold)) fixes.add("Manual hold");

    if (!boolish(row.PARLogged) && blankText(row.PARExpDate)) {
      fixes.add("PAR needs review");
    }

    if (!boolish(row.CMNLogged) && blankText(row.CMNExpDate)) {
      fixes.add("CMN needs review");
    }

    if (!blankText(row.HCPC)) fixes.add("Missing HCPC");
    if (!blankText(row.WIPDateNeeded)) fixes.add("Missing needed date");

    if (days >= 30) fixes.add("Aging over 30 days");
    if (days >= 15 && days < 30) fixes.add("Aging 15-29 days");
    if (status.includes("denial")) fixes.add("Denial status");
    if (status.includes("hold")) fixes.add("Hold status");
    if (status.includes("pending")) fixes.add("Pending status");
  });

  return Array.from(fixes).sort();
}

function groupBucket(rows: WipRow[]): ReviewBucket {
  const buckets = rows.map(rowBucket);

  if (buckets.includes("needs_review")) return "needs_review";
  if (buckets.includes("pending")) return "pending";
  if (buckets.includes("unresolved")) return "unresolved";
  return "resolved";
}

function buildPatientGroups(rows: WipRow[], sortMode: SortMode): PatientGroup[] {
  const map = new Map<string, WipRow[]>();

  rows.forEach((row) => {
    const key = patientKey(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  });

  const groups = Array.from(map.entries()).map(([key, groupRows]) => {
    const first = groupRows[0];
    const notes = groupRows
      .map((row) => blankText(row.wipReviewNotes))
      .filter(Boolean)
      .join("\n\n");

    const oldestDays = groupRows.reduce(
      (max, row) => Math.max(max, safeNumber(row.WIPDaysInState)),
      0
    );

    const newestDays = groupRows.reduce(
      (min, row) => Math.min(min, safeNumber(row.WIPDaysInState) || 0),
      Number.POSITIVE_INFINITY
    );

    return {
      key,
      patientName: safeText(first.PatientName, "Unknown Patient"),
      patientId: safeText(first.PatientID || first.PtKey),
      accountNumber: safeText(first.PatientAccountNumber),
      assignedTo: assignedName(first),
      rows: groupRows,
      totalCharge: groupRows.reduce((sum, row) => sum + safeNumber(row.ExtChargeAmt), 0),
      totalAllow: groupRows.reduce((sum, row) => sum + safeNumber(row.ExtAllowAmt), 0),
      oldestDays,
      newestDays: Number.isFinite(newestDays) ? newestDays : 0,
      fixItems: getFixItems(groupRows),
      reviewBucket: groupBucket(groupRows),
      notes,
      severity: agingSeverity(oldestDays),
    };
  });

  return groups.sort((a, b) => {
    if (sortMode === "newest") return a.newestDays - b.newestDays;
    if (sortMode === "patient") return a.patientName.localeCompare(b.patientName);
    if (sortMode === "charge") return b.totalCharge - a.totalCharge;
    if (sortMode === "allow") return b.totalAllow - a.totalAllow;
    return b.oldestDays - a.oldestDays;
  });
}

function rowFromDoc(docSnap: QueryDocumentSnapshot<DocumentData>): WipRow {
  const data = docSnap.data() as Omit<WipRow, "id">;

  return {
    id: docSnap.id,
    sourceReportId: data.sourceReportId || data.reportId,
    sourceRowId: data.sourceRowId,
    ...data,
  };
}

async function getCurrentUserRole(): Promise<UserRole> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) return "unknown";

  const token = await user.getIdTokenResult(true);
  const claimRole = token.claims.role;

  if (claimRole === "admin" || claimRole === "staff") return claimRole;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const role = userDoc.data()?.role;

  if (role === "admin" || role === "staff") return role;

  return "unknown";
}

async function writeAuditLog(action: string, details: Record<string, unknown>) {
  const auth = getAuth();
  const user = auth.currentUser;

  await addDoc(collection(db, "auditLogs"), {
    action,
    actorUid: user?.uid ?? "unknown",
    actorEmail: user?.email ?? "unknown",
    details,
    createdAt: serverTimestamp(),
  });
}

async function markSourceRowDeleted(row: WipRow, deleted: boolean) {
  if (!row.sourceReportId || !row.sourceRowId) return;

  await updateDoc(
    doc(db, "importedReports", row.sourceReportId, "rows", row.sourceRowId),
    {
      deletedFromWip: deleted,
      deletedAt: deleted ? serverTimestamp() : null,
      restoredAt: deleted ? null : serverTimestamp(),
    }
  );
}

function downloadCsv(filename: string, rows: WipRow[]) {
  const headers = [
    "PatientName",
    "PatientID",
    "PatientAccountNumber",
    "WIPAssignedTo",
    "WIPStatusName",
    "WIPDaysInState",
    "ItemDescription",
    "HCPC",
    "ExtChargeAmt",
    "ExtAllowAmt",
    "PrimaryInsuranceName",
    "wipReviewStatus",
    "wipReviewNotes",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header as keyof WipRow];
          return `"${String(value ?? "").replace(/"/g, '""')}"`
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function WipPage() {
  const [rows, setRows] = useState<WipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [role, setRole] = useState<UserRole>("unknown");

  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastDeleted, setLastDeleted] = useState<DeletedSnapshot | null>(null);

  const [search, setSearch] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [rawStatusFilter, setRawStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewBucket | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<AgingSeverity | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("oldest");
  const [selectedPatientKey, setSelectedPatientKey] = useState("");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const isAdmin = role === "admin";

  useEffect(() => {
    let mounted = true;

    getCurrentUserRole()
      .then((nextRole) => {
        if (mounted) setRole(nextRole);
      })
      .catch(() => {
        if (mounted) setRole("unknown");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const wipQuery = query(
      collection(db, "patients"),
      where("reportType", "==", "work_in_progress"),
      orderBy("PatientName"),
      limit(PAGE_LIMIT)
    );

    const unsubscribe = onSnapshot(
      wipQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const nextRows = snapshot.docs
          .map(rowFromDoc)
          .filter((row) => row.deletedFromWip !== true);

        setRows(nextRows);
        setFromCache(snapshot.metadata.fromCache);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to load WIP rows.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const assignedUsers = useMemo(() => {
    return Array.from(new Set(rows.map((row) => assignedName(row)))).sort();
  }, [rows]);

  const rawStatuses = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => blankText(row.WIPStatusName)).filter(Boolean))
    ).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (assignedFilter !== "all" && assignedName(row) !== assignedFilter) return false;
      if (rawStatusFilter !== "all" && blankText(row.WIPStatusName) !== rawStatusFilter) {
        return false;
      }
      if (reviewFilter !== "all" && rowBucket(row) !== reviewFilter) return false;
      if (severityFilter !== "all" && agingSeverity(safeNumber(row.WIPDaysInState)) !== severityFilter) {
        return false;
      }

      if (!needle) return true;

      const haystack = [
        row.PatientName,
        row.PatientID,
        row.PtKey,
        row.PatientAccountNumber,
        row.SOKey,
        row.SODtlKey,
        row.SOStatus,
        row.SOTypeName,
        row.SaleType,
        row.ItemDescription,
        row.HCPC,
        row.WIPStatusName,
        row.WIPAssignedTo,
        row.PrimaryInsuranceName,
        row.SecondaryInsuranceName,
        row.OrderingDoctorName,
        row.PrimaryDoctorName,
        row.PractitionerName,
        row.CreatedByName,
        row.BranchName,
        row.Reference,
        row.wipReviewNotes,
      ]
        .map((value) => safeText(value, "").toLowerCase())
        .join(" ");

      return haystack.includes(needle);
    });
  }, [rows, search, assignedFilter, rawStatusFilter, reviewFilter, severityFilter]);

  const patientGroups = useMemo(() => {
    return buildPatientGroups(filteredRows, sortMode);
  }, [filteredRows, sortMode]);

  const groupedByEmployee = useMemo(() => {
    const map = new Map<string, PatientGroup[]>();

    patientGroups.forEach((group) => {
      map.set(group.assignedTo, [...(map.get(group.assignedTo) ?? []), group]);
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [patientGroups]);

  const selectedProfile = useMemo(() => {
    return (
      patientGroups.find((group) => group.key === selectedPatientKey) ??
      patientGroups[0] ??
      null
    );
  }, [patientGroups, selectedPatientKey]);

  useEffect(() => {
    setNoteDraft(selectedProfile?.notes ?? "");
  }, [selectedProfile?.key, selectedProfile?.notes]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const bucket = rowBucket(row);
        const severity = agingSeverity(safeNumber(row.WIPDaysInState));

        acc.charge += safeNumber(row.ExtChargeAmt);
        acc.allow += safeNumber(row.ExtAllowAmt);
        acc.oldest = Math.max(acc.oldest, safeNumber(row.WIPDaysInState));
        acc[bucket] += 1;
        acc[severity] += 1;

        return acc;
      },
      {
        charge: 0,
        allow: 0,
        oldest: 0,
        resolved: 0,
        unresolved: 0,
        pending: 0,
        needs_review: 0,
        normal: 0,
        warning: 0,
        critical: 0,
        overdue: 0,
      }
    );
  }, [filteredRows]);

  const toggleExpandedRow = useCallback((rowId: string) => {
    setExpandedRows((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  }, []);

  async function saveRowReview(row: WipRow, status: ReviewBucket, notes?: string) {
    try {
      setBusyId(row.id);
      setError("");
      setNotice("");

      const user = getAuth().currentUser;

      await updateDoc(doc(db, "patients", row.id), {
        wipReviewStatus: status,
        wipReviewNotes: notes ?? row.wipReviewNotes ?? "",
        wipReviewUpdatedAt: serverTimestamp(),
        wipReviewUpdatedBy: user?.email ?? "unknown",
      });

      await writeAuditLog("wip_review_updated", {
        rowId: row.id,
        patientName: row.PatientName ?? "Unknown Patient",
        status,
      });

      setNotice("WIP review status saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save WIP review.");
    } finally {
      setBusyId("");
    }
  }

  async function savePatientNotes() {
    if (!selectedProfile) return;

    try {
      setBulkBusy(true);
      setError("");
      setNotice("");

      const user = getAuth().currentUser;

      for (const row of selectedProfile.rows) {
        await updateDoc(doc(db, "patients", row.id), {
          wipReviewNotes: noteDraft.trim(),
          wipReviewUpdatedAt: serverTimestamp(),
          wipReviewUpdatedBy: user?.email ?? "unknown",
        });
      }

      await writeAuditLog("wip_notes_updated", {
        count: selectedProfile.rows.length,
        patientName: selectedProfile.patientName,
        patientId: selectedProfile.patientId,
      });

      setNotice("Notes saved to all WIP rows for this patient.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save notes.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkMarkSelectedPatient(status: ReviewBucket) {
    if (!selectedProfile) return;

    try {
      setBulkBusy(true);
      setError("");
      setNotice("");

      const user = getAuth().currentUser;

      for (const row of selectedProfile.rows) {
        await updateDoc(doc(db, "patients", row.id), {
          wipReviewStatus: status,
          wipReviewUpdatedAt: serverTimestamp(),
          wipReviewUpdatedBy: user?.email ?? "unknown",
        });
      }

      await writeAuditLog("wip_bulk_review_updated", {
        count: selectedProfile.rows.length,
        patientName: selectedProfile.patientName,
        patientId: selectedProfile.patientId,
        status,
      });

      setNotice(`All visible WIP items for this patient marked ${REVIEW_LABELS[status]}.`);
    } catch (bulkError) {
      setError(
        bulkError instanceof Error ? bulkError.message : "Failed to update patient WIP rows."
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function softDeleteRows(targetRows: WipRow[], mode: "single" | "bulk") {
    if (!isAdmin) {
      setError("Only admins can delete WIP items.");
      return;
    }

    if (targetRows.length === 0) return;

    const confirmed = window.confirm(
      mode === "single"
        ? "Delete this WIP item from the active WIP list?"
        : `Delete ${targetRows.length} WIP item(s) for this patient from the active WIP list?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setNotice("");
      setBulkBusy(mode === "bulk");

      const user = getAuth().currentUser;

      for (const row of targetRows) {
        setBusyId(row.id);

        await updateDoc(doc(db, "patients", row.id), {
          deletedFromWip: true,
          deletedAt: serverTimestamp(),
          deletedBy: user?.email ?? "unknown",
        });

        await markSourceRowDeleted(row, true);
      }

      await writeAuditLog(mode === "single" ? "wip_deleted" : "wip_bulk_deleted", {
        count: targetRows.length,
        patientName: targetRows[0]?.PatientName ?? "Unknown Patient",
        patientId: targetRows[0]?.PatientID ?? targetRows[0]?.PtKey ?? "",
        rowIds: targetRows.map((row) => row.id),
      });

      setLastDeleted({
        deletedRows: targetRows,
        deletedAtLabel: new Date().toLocaleString(),
      });

      setNotice(
        mode === "single"
          ? "WIP item deleted. Use undo if needed."
          : "Patient WIP items deleted. Use undo if needed."
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete WIP item."
      );
    } finally {
      setBusyId("");
      setBulkBusy(false);
    }
  }

  async function restoreLastDeleted() {
    if (!isAdmin) {
      setError("Only admins can restore deleted WIP items.");
      return;
    }

    if (!lastDeleted || lastDeleted.deletedRows.length === 0) return;

    try {
      setError("");
      setNotice("");
      setBulkBusy(true);

      for (const row of lastDeleted.deletedRows) {
        await updateDoc(doc(db, "patients", row.id), {
          deletedFromWip: false,
          deletedAt: null,
          deletedBy: null,
          restoredAt: serverTimestamp(),
        });

        await markSourceRowDeleted(row, false);
      }

      await writeAuditLog("wip_restore_deleted", {
        count: lastDeleted.deletedRows.length,
        rowIds: lastDeleted.deletedRows.map((row) => row.id),
      });

      setNotice("Deleted WIP item(s) restored.");
      setLastDeleted(null);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Failed to restore deleted WIP item(s)."
      );
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-700/40 bg-yellow-950/30 px-4 py-2 text-sm text-yellow-300">
            <ClipboardList className="h-4 w-4" />
            Work In Progress
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            WIP Command Center
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Filter by employee, WIP status, review state, aging severity, and patient-level notes.
          </p>
        </div>

        {fromCache ? (
          <section className="mb-6 rounded-3xl border border-yellow-800 bg-yellow-950/30 p-5 text-yellow-200">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5" />
              <div>
                Showing cached Firestore data. Changes may not be fully synced yet.
              </div>
            </div>
          </section>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Visible Rows" value={filteredRows.length} />
          <StatCard label="Patients" value={patientGroups.length} />
          <StatCard label="Resolved" value={totals.resolved} />
          <StatCard label="Unresolved" value={totals.unresolved} />
          <StatCard label="Pending" value={totals.pending} />
          <StatCard label="Review" value={totals.needs_review} />
          <StatCard label="Overdue" value={totals.overdue} />
          <StatCard label="Charges" value={money(totals.charge)} icon={<DollarSign className="h-4 w-4" />} />
        </div>

        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_200px_200px_200px_190px_170px]">
            <div>
              <label htmlFor="wip-search" className="mb-2 block text-sm font-medium text-zinc-300">
                Search WIP
              </label>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="wip-search"
                  name="wipSearch"
                  title="Search WIP rows"
                  aria-label="Search WIP rows"
                  placeholder="Search patient, SO, HCPC, item, insurance, note, employee..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
              </div>
            </div>

            <FilterSelect
              id="assigned-filter"
              label="Employee Owner"
              value={assignedFilter}
              onChange={setAssignedFilter}
              defaultLabel="All employees"
              options={assignedUsers}
            />

            <FilterSelect
              id="review-filter"
              label="Review Bucket"
              value={reviewFilter}
              onChange={(value) => setReviewFilter(value as ReviewBucket | "all")}
              defaultLabel="All review buckets"
              options={Object.keys(REVIEW_LABELS)}
              labelMap={REVIEW_LABELS}
            />

            <FilterSelect
              id="severity-filter"
              label="Aging Severity"
              value={severityFilter}
              onChange={(value) => setSeverityFilter(value as AgingSeverity | "all")}
              defaultLabel="All aging levels"
              options={Object.keys(SEVERITY_LABELS)}
              labelMap={SEVERITY_LABELS}
            />

            <FilterSelect
              id="status-filter"
              label="Raw WIP Status"
              value={rawStatusFilter}
              onChange={setRawStatusFilter}
              defaultLabel="All raw statuses"
              options={rawStatuses}
            />

            <FilterSelect
              id="sort-mode"
              label="Sort"
              value={sortMode}
              onChange={(value) => setSortMode(value as SortMode)}
              defaultLabel="Oldest first"
              options={["oldest", "newest", "patient", "charge", "allow"]}
              labelMap={{
                oldest: "Oldest first",
                newest: "Newest first",
                patient: "Patient A-Z",
                charge: "Charge high-low",
                allow: "Allow high-low",
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => downloadCsv("wip-visible-rows.csv", filteredRows)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              <Download className="h-4 w-4" />
              Export Visible Rows
            </button>
          </div>
        </section>

        {notice ? (
          <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-800 bg-emerald-950/30 p-5 text-emerald-200">
            <div>{notice}</div>

            {lastDeleted && isAdmin ? (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={restoreLastDeleted}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/50 px-3 py-2 text-sm hover:bg-emerald-700/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Undo last delete
              </button>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-3xl border border-red-800 bg-red-950/30 p-5 text-red-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>{error}</div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_540px]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Clickable WIP Queues</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Click a patient card to open details, notes, bulk actions, and row-level tools.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
                <Filter className="h-4 w-4" />
                {loading ? "Loading..." : `${patientGroups.length} patient(s)`}
              </div>
            </div>

            {loading ? (
              <EmptyState text="Loading WIP data..." />
            ) : groupedByEmployee.length === 0 ? (
              <EmptyState text="No WIP records matched the current filters." />
            ) : (
              <div className="space-y-6">
                {groupedByEmployee.map(([employee, groups]) => {
                  const employeeOldest = groups.reduce(
                    (max, group) => Math.max(max, group.oldestDays),
                    0
                  );

                  return (
                    <div key={employee} className="rounded-3xl border border-zinc-800 bg-black/40 p-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
                            <Users className="h-5 w-5 text-zinc-300" />
                          </div>

                          <div>
                            <h3 className="font-semibold text-white">{employee}</h3>
                            <p className="text-sm text-zinc-500">
                              {groups.length} patient WIP group(s)
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full border border-yellow-700/40 bg-yellow-950/30 px-3 py-1 text-xs text-yellow-300">
                          Oldest: {employeeOldest} day(s)
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {groups.map((group) => {
                          const selected = selectedProfile?.key === group.key;
                          const hasFixes = group.fixItems.length > 0;

                          return (
                            <button
                              key={group.key}
                              type="button"
                              onClick={() => setSelectedPatientKey(group.key)}
                              className={`rounded-2xl border p-4 text-left transition hover:border-zinc-500 ${
                                selected
                                  ? "border-yellow-600 bg-yellow-950/20"
                                  : "border-zinc-800 bg-zinc-900"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <UserRound className="h-4 w-4 shrink-0 text-zinc-500" />
                                    <div className="truncate font-semibold text-white">
                                      {group.patientName}
                                    </div>
                                  </div>

                                  <div className="mt-1 text-xs text-zinc-500">
                                    ID: {group.patientId} · Acct: {group.accountNumber}
                                  </div>
                                </div>

                                {hasFixes ? (
                                  <FileWarning className="h-5 w-5 shrink-0 text-yellow-400" />
                                ) : (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <ReviewBadge bucket={group.reviewBucket} />
                                <SeverityBadge severity={group.severity} />
                              </div>

                              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                <MiniMetric label="Rows" value={group.rows.length} />
                                <MiniMetric label="Oldest" value={group.oldestDays} highlight />
                                <MiniMetric label="Fixes" value={group.fixItems.length} />
                              </div>

                              {group.notes ? (
                                <div className="mt-3 line-clamp-2 rounded-xl border border-zinc-800 bg-black/30 p-2 text-xs text-zinc-400">
                                  {group.notes}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-auto">
            {!selectedProfile ? (
              <EmptyState text="Select a WIP card to view details." />
            ) : (
              <div>
                <div className="mb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">
                        {selectedProfile.patientName}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        ID: {selectedProfile.patientId} · Account: {selectedProfile.accountNumber}
                      </p>
                    </div>

                    <ReviewBadge bucket={selectedProfile.reviewBucket} />
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-3 gap-3">
                  <MiniMetric label="Rows" value={selectedProfile.rows.length} />
                  <MiniMetric label="Oldest" value={selectedProfile.oldestDays} highlight />
                  <MiniMetric label="Charge" value={money(selectedProfile.totalCharge)} />
                </div>

                <section className="mb-5 rounded-2xl border border-zinc-800 bg-black/40 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-zinc-100">
                    <MessageSquareText className="h-4 w-4" />
                    Clean Notes
                  </div>

                  <label htmlFor="wip-notes" className="sr-only">
                    WIP review notes
                  </label>

                  <textarea
                    id="wip-notes"
                    name="wipNotes"
                    title="WIP review notes"
                    aria-label="WIP review notes"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add clean internal notes for this patient WIP..."
                    className="min-h-28 w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                  />

                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={savePatientNotes}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Save Notes to This Patient WIP
                  </button>
                </section>

                <section className="mb-5 rounded-2xl border border-zinc-800 bg-black/40 p-4">
                  <div className="mb-3 font-semibold text-zinc-100">Bulk Review Actions</div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <BulkButton disabled={bulkBusy} onClick={() => bulkMarkSelectedPatient("resolved")}>
                      Mark All Resolved
                    </BulkButton>
                    <BulkButton disabled={bulkBusy} onClick={() => bulkMarkSelectedPatient("unresolved")}>
                      Mark All Unresolved
                    </BulkButton>
                    <BulkButton disabled={bulkBusy} onClick={() => bulkMarkSelectedPatient("pending")}>
                      Mark All Pending
                    </BulkButton>
                    <BulkButton disabled={bulkBusy} onClick={() => bulkMarkSelectedPatient("needs_review")}>
                      Needs Further Review
                    </BulkButton>
                  </div>
                </section>

                {isAdmin ? (
                  <button
                    type="button"
                    disabled={bulkBusy || selectedProfile.rows.length === 0}
                    onClick={() => softDeleteRows(selectedProfile.rows, "bulk")}
                    className="mb-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-700/50 bg-red-950/20 px-4 py-3 text-sm font-medium text-red-200 hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete All WIP Items for This Patient
                  </button>
                ) : null}

                <section className="mb-5 rounded-2xl border border-red-900/60 bg-red-950/20 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-red-100">
                    <Wrench className="h-4 w-4" />
                    Needs Fixed
                  </div>

                  {selectedProfile.fixItems.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      No obvious fix flags found.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedProfile.fixItems.map((fix) => (
                        <span
                          key={fix}
                          className="rounded-full border border-red-800 bg-red-950/50 px-3 py-1 text-xs text-red-100"
                        >
                          {fix}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mb-5 rounded-2xl border border-zinc-800 bg-black/40 p-4">
                  <div className="mb-3 font-semibold text-zinc-100">
                    Patient / Insurance
                  </div>

                  <div className="grid gap-3 text-sm">
                    <InfoRow label="Employee Owner" value={selectedProfile.assignedTo} />
                    <InfoRow label="Primary Insurance" value={selectedProfile.rows[0]?.PrimaryInsuranceName} />
                    <InfoRow label="Primary Verified" value={boolish(selectedProfile.rows[0]?.IsPrimaryVerified) ? "Yes" : "No"} />
                    <InfoRow label="Secondary Insurance" value={selectedProfile.rows[0]?.SecondaryInsuranceName} />
                    <InfoRow label="Doctor" value={selectedProfile.rows[0]?.OrderingDoctorName || selectedProfile.rows[0]?.PrimaryDoctorName || selectedProfile.rows[0]?.PractitionerName} />
                    <InfoRow label="Diagnosis Codes" value={selectedProfile.rows[0]?.TopFourDiagCodes || selectedProfile.rows[0]?.SODiagCodes} />
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                  <div className="mb-3 font-semibold text-zinc-100">
                    Clickable WIP Items
                  </div>

                  <div className="space-y-3">
                    {selectedProfile.rows
                      .slice()
                      .sort((a, b) => safeNumber(b.WIPDaysInState) - safeNumber(a.WIPDaysInState))
                      .map((row) => {
                        const deleting = busyId === row.id;
                        const bucket = rowBucket(row);
                        const expanded = expandedRows.includes(row.id);

                        return (
                          <article
                            key={row.id}
                            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                          >
                            <button
                              type="button"
                              onClick={() => toggleExpandedRow(row.id)}
                              className="w-full text-left"
                              aria-expanded={expanded}
                              aria-controls={`wip-row-${row.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-medium text-white">
                                    {safeText(row.ItemDescription)}
                                  </div>
                                  <div className="mt-1 text-xs text-zinc-500">
                                    SO #{safeText(row.SOKey)} · Detail #{safeText(row.SODtlKey)} · {safeText(row.SOTypeName)}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <ReviewBadge bucket={bucket} />
                                  {expanded ? (
                                    <EyeOff className="h-5 w-5 text-zinc-400" />
                                  ) : (
                                    <Eye className="h-5 w-5 text-zinc-400" />
                                  )}
                                  {bucket === "resolved" ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-400" />
                                  )}
                                </div>
                              </div>
                            </button>

                            {expanded ? (
                              <div id={`wip-row-${row.id}`} className="mt-4">
                                <div className="grid gap-2 text-sm">
                                  <InfoRow label="Raw WIP Status" value={row.WIPStatusName} />
                                  <InfoRow label="Days In State" value={row.WIPDaysInState} />
                                  <InfoRow label="Needed Date" value={row.WIPDateNeeded} icon={<CalendarDays className="h-4 w-4" />} />
                                  <InfoRow label="HCPC" value={row.HCPC} />
                                  <InfoRow label="Qty" value={row.Qty} />
                                  <InfoRow label="Charge" value={money(row.ExtChargeAmt)} />
                                  <InfoRow label="Allow" value={money(row.ExtAllowAmt)} />
                                  <InfoRow label="Created By" value={row.CreatedByName} />
                                  <InfoRow label="Delivery Tech" value={row.DeliveryTechName} />
                                  <InfoRow label="Reference" value={row.Reference} />
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                  <BulkButton disabled={deleting || bulkBusy} onClick={() => saveRowReview(row, "resolved", row.wipReviewNotes)}>
                                    Mark Resolved
                                  </BulkButton>

                                  <BulkButton disabled={deleting || bulkBusy} onClick={() => saveRowReview(row, "unresolved", row.wipReviewNotes)}>
                                    Mark Unresolved
                                  </BulkButton>

                                  <BulkButton disabled={deleting || bulkBusy} onClick={() => saveRowReview(row, "pending", row.wipReviewNotes)}>
                                    Mark Pending
                                  </BulkButton>

                                  <BulkButton disabled={deleting || bulkBusy} onClick={() => saveRowReview(row, "needs_review", row.wipReviewNotes)}>
                                    Needs Further Review
                                  </BulkButton>
                                </div>

                                {isAdmin ? (
                                  <button
                                    type="button"
                                    disabled={deleting || bulkBusy}
                                    onClick={() => softDeleteRows([row], "single")}
                                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-600/40 px-3 py-2 text-xs text-red-300 hover:bg-red-600/10 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Delete this WIP item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {deleting ? "Working..." : "Delete This WIP Item"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function ReviewBadge({ bucket }: { bucket: ReviewBucket }) {
  const classes: Record<ReviewBucket, string> = {
    resolved: "border-emerald-700/50 bg-emerald-950/30 text-emerald-200",
    unresolved: "border-red-700/50 bg-red-950/30 text-red-200",
    pending: "border-blue-700/50 bg-blue-950/30 text-blue-200",
    needs_review: "border-yellow-700/50 bg-yellow-950/30 text-yellow-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${classes[bucket]}`}>
      {REVIEW_LABELS[bucket]}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: AgingSeverity }) {
  const classes: Record<AgingSeverity, string> = {
    normal: "border-zinc-700 bg-zinc-900 text-zinc-300",
    warning: "border-yellow-700/50 bg-yellow-950/30 text-yellow-200",
    critical: "border-orange-700/50 bg-orange-950/30 text-orange-200",
    overdue: "border-red-700/50 bg-red-950/30 text-red-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${classes[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 font-semibold ${highlight ? "text-yellow-300" : "text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  defaultLabel,
  options,
  labelMap,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  defaultLabel: string;
  options: string[];
  labelMap?: Record<string, string>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
      </label>

      <select
        id={id}
        name={id}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
      >
        <option value="all">{defaultLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelMap?.[option] ?? option}
          </option>
        ))}
      </select>
    </div>
  );
}

function BulkButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
      {text}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: unknown;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right text-zinc-200">{safeText(value)}</div>
    </div>
  );
}