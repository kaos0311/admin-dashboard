import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type ReportType =
  | "patients"
  | "demographics"
  | "items"
  | "purchases"
  | "rentals"
  | "unknown";

type CountsByType = Record<ReportType, number>;

const REPORT_TYPES: ReportType[] = [
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "unknown",
];

function normalizeReportType(value: unknown): ReportType {
  if (typeof value !== "string") return "unknown";

  const clean = value.trim().toLowerCase();

  if (REPORT_TYPES.includes(clean as ReportType)) {
    return clean as ReportType;
  }

  if (clean.includes("patient")) return "patients";
  if (clean.includes("demo")) return "demographics";
  if (clean.includes("item") || clean.includes("product")) return "items";
  if (clean.includes("purchase")) return "purchases";
  if (clean.includes("rental")) return "rentals";

  return "unknown";
}

function emptyCounts(): CountsByType {
  return {
    patients: 0,
    demographics: 0,
    items: 0,
    purchases: 0,
    rentals: 0,
    unknown: 0,
  };
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

export const rebuildReportsAnalytics = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    const role = request.auth?.token?.role;

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    if (role !== "admin" && role !== "staff") {
      throw new HttpsError(
        "permission-denied",
        "Only staff or admins can rebuild report analytics."
      );
    }

    const db = getFirestore();

    const countsByType = emptyCounts();
    const uniqueFiles = new Set<string>();
    let totalRows = 0;

    try {
      /**
       * This scans every importedReports/{reportId}/rows/{rowId}
       * row using a collection group query.
       *
       * It does not require an orderBy.
       * It usually does NOT need a composite index.
       */
      const rowsSnap = await db.collectionGroup("rows").get();

      rowsSnap.forEach((rowDoc) => {
        const data = rowDoc.data();

        totalRows += 1;

        const reportType = normalizeReportType(data.reportType);
        countsByType[reportType] += 1;

        const parentReportRef = rowDoc.ref.parent.parent;
        if (parentReportRef?.id) {
          uniqueFiles.add(parentReportRef.id);
        }

        if (typeof data.reportId === "string" && data.reportId.trim()) {
          uniqueFiles.add(data.reportId.trim());
        }
      });

      /**
       * Also count imported report documents, because uploaded files may exist
       * even if parsing created zero rows.
       */
      const reportsSnap = await db.collection("importedReports").get();

      reportsSnap.forEach((reportDoc) => {
        uniqueFiles.add(reportDoc.id);

        const data = reportDoc.data();
        const reportType = normalizeReportType(data.reportType);

        /**
         * If a report has a saved rowCount but no row docs were scanned,
         * this helps keep analytics from looking dead.
         */
        const rowCount = Number(data.rowCount);
        if (Number.isFinite(rowCount) && rowCount > 0) {
          // Do not add to totalRows here unless there are no row docs at all.
          // Prevents double-counting when rows exist.
          if (rowsSnap.empty) {
            totalRows += rowCount;
            countsByType[reportType] += rowCount;
          }
        }
      });

      const now = new Date();

      const analyticsPayload = {
        totalRows,
        totalFiles: uniqueFiles.size,
        countsByType,
        generatedAtLabel: formatGeneratedAtLabel(now),
        rebuiltAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        source: "rebuildReportsAnalytics",
      };

      await db.collection("analytics").doc("reports").set(analyticsPayload, {
        merge: true,
      });

      return {
        ok: true,
        message: "Reports analytics rebuilt successfully.",
        analytics: analyticsPayload,
      };
    } catch (error) {
      console.error("rebuildReportsAnalytics failed:", error);

      throw new HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "Failed to rebuild reports analytics."
      );
    }
  }
);