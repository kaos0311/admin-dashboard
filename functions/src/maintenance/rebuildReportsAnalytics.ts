import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";

type ReportType =
  | "patients"
  | "demographics"
  | "items"
  | "purchases"
  | "rentals"
  | "orders"
  | "delivery"
  | "billing"
  | "insurance"
  | "hospice"
  | "wip"
  | "cpap"
  | "unknown";

type CountsByType = Record<ReportType, number>;

const REPORT_TYPES: ReportType[] = [
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "orders",
  "delivery",
  "billing",
  "insurance",
  "hospice",
  "wip",
  "cpap",
  "unknown",
];

type RebuildReportsAnalyticsPayload = {
  includeRowScan?: boolean;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data?: unknown;
};

function requireStaffOrAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = request.auth.token.role;

  if (role !== "admin" && role !== "staff") {
    throw new HttpsError(
      "permission-denied",
      "Only staff or admins can rebuild report analytics."
    );
  }
}

function getPayload(data: unknown): RebuildReportsAnalyticsPayload {
  if (!data || typeof data !== "object") return {};
  return data as RebuildReportsAnalyticsPayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

function normalizeString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalizeReportType(value: unknown): ReportType {
  if (typeof value !== "string") return "unknown";

  const clean = value.trim().toLowerCase();

  if (REPORT_TYPES.includes(clean as ReportType)) {
    return clean as ReportType;
  }

  if (clean.includes("hospice")) return "hospice";
  if (clean.includes("wip")) return "wip";
  if (clean.includes("work in progress")) return "wip";
  if (clean.includes("work_in_progress")) return "wip";
  if (clean.includes("cpap") || clean.includes("pap")) return "cpap";
  if (clean.includes("insurance") || clean.includes("payer") || clean.includes("payor")) return "insurance";
  if (clean.includes("billing") || clean.includes("invoice") || clean.includes("claim")) return "billing";
  if (clean.includes("delivery") || clean.includes("ticket")) return "delivery";
  if (clean.includes("order") || clean.includes("sales")) return "orders";
  if (clean.includes("patient")) return "patients";
  if (clean.includes("demo")) return "demographics";
  if (clean.includes("item") || clean.includes("product") || clean.includes("inventory")) return "items";
  if (clean.includes("purchase")) return "purchases";
  if (clean.includes("rental")) return "rentals";

  return "unknown";
}

function emptyCounts(): CountsByType {
  return REPORT_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as CountsByType);
}

function formatGeneratedAtLabel(date = new Date()): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function numberFromUnknown(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const rebuildReportsAnalytics = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    requireStaffOrAdmin(request as CallableRequestLike);

    const db = getFirestore();
    const payload = getPayload(request.data);

    const includeRowScan = payload.includeRowScan !== false;

    const uid = request.auth!.uid;
    const email = getAuthEmail(request as CallableRequestLike);

    const startedAt = Timestamp.now();
    const startedAtMs = Date.now();

    const jobRef = await db.collection("systemJobs").add({
      type: "rebuildReportsAnalytics",
      status: "processing",
      stage: "starting",
      requestedBy: uid,
      requestedByEmail: email,
      includeRowScan,
      startedAt,
      updatedAt: startedAt,
    });

    const countsByType = emptyCounts();
    const filesByType = emptyCounts();
    const uniqueFiles = new Set<string>();

    let totalRows = 0;
    let totalReportDocs = 0;
    let reportsWithZeroRows = 0;
    let scannedRowDocs = 0;

    try {
      await jobRef.set(
        {
          stage: "reading_report_docs",
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      const reportsSnap = await db.collection("importedReports").get();

      totalReportDocs = reportsSnap.size;

      for (const reportDoc of reportsSnap.docs) {
        const data = reportDoc.data();

        uniqueFiles.add(reportDoc.id);

        const reportType = normalizeReportType(
          data.reportType ||
            data.detectedReportType ||
            data.sourceReportType ||
            data.fileType ||
            data.fileName
        );

        filesByType[reportType] += 1;

        const savedRowCount =
          numberFromUnknown(data.totalRows) ||
          numberFromUnknown(data.rowCount) ||
          numberFromUnknown(data.processedRows);

        if (savedRowCount > 0) {
          totalRows += savedRowCount;
          countsByType[reportType] += savedRowCount;
        } else {
          reportsWithZeroRows += 1;
        }
      }

      if (includeRowScan) {
        await jobRef.set(
          {
            stage: "scanning_row_docs",
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        const rowCountsByType = emptyCounts();
        const rowUniqueFiles = new Set<string>();

        const rowsSnap = await db.collectionGroup("rows").get();

        scannedRowDocs = rowsSnap.size;

        rowsSnap.forEach((rowDoc) => {
          const data = rowDoc.data();

          const parentReportRef = rowDoc.ref.parent.parent;
          const parentReportId = parentReportRef?.id || "";

          if (parentReportId) {
            rowUniqueFiles.add(parentReportId);
            uniqueFiles.add(parentReportId);
          }

          const reportId = normalizeString(
            data.reportId || data.sourceReportId
          );

          if (reportId) {
            rowUniqueFiles.add(reportId);
            uniqueFiles.add(reportId);
          }

          const reportType = normalizeReportType(
            data.reportType ||
              data.sourceReportType ||
              data.detectedReportType ||
              parentReportId
          );

          rowCountsByType[reportType] += 1;
        });

        if (scannedRowDocs > 0) {
          totalRows = scannedRowDocs;

          for (const type of REPORT_TYPES) {
            countsByType[type] = rowCountsByType[type];
          }
        }
      }

      const now = new Date();
      const completedAt = Timestamp.now();
      const durationMs = Date.now() - startedAtMs;

      const analyticsPayload = {
        totalRows,
        totalFiles: uniqueFiles.size,
        totalReportDocs,
        reportsWithZeroRows,
        scannedRowDocs,

        countsByType,
        filesByType,

        includeRowScan,
        generatedAtLabel: formatGeneratedAtLabel(now),

        rebuiltByUid: uid,
        rebuiltByEmail: email,
        durationMs,

        rebuiltAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        source: "rebuildReportsAnalytics",
        analyticsVersion: "reports-v2",
      };

      await db.collection("analytics").doc("reports").set(analyticsPayload, {
        merge: true,
      });

      await jobRef.set(
        {
          status: "completed",
          stage: "completed",
          totalRows,
          totalFiles: uniqueFiles.size,
          totalReportDocs,
          reportsWithZeroRows,
          scannedRowDocs,
          countsByType,
          filesByType,
          completedAt,
          updatedAt: completedAt,
          durationMs,
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: "reports_analytics_rebuilt",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          totalRows,
          totalFiles: uniqueFiles.size,
          totalReportDocs,
          reportsWithZeroRows,
          scannedRowDocs,
          includeRowScan,
          durationMs,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        message: "Reports analytics rebuilt successfully.",
        analytics: analyticsPayload,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to rebuild reports analytics.";

      logger.error("rebuildReportsAnalytics failed", {
        error: message,
        requestedBy: uid,
      });

      await jobRef.set(
        {
          status: "failed",
          stage: "failed",
          error: message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: "reports_analytics_rebuild_failed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          error: message,
          includeRowScan,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", message);
    }
  }
);