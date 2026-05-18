// functions/src/maintenance/rebuildReportsAnalytics.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";

import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";

import { logger } from "firebase-functions";

import {
  cleanText,
} from "../imports/utils/normalize.js";

import {
  resolveReportType,
} from "../imports/reportRegistry.js";

const db = getFirestore();

const MAX_ANALYTICS_ROWS = 5_000_000;

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
  | "generic";

type CountsByType = Record<
  ReportType,
  number
>;

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
  "generic",
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

function requireStaffOrAdmin(
  request: CallableRequestLike
): void {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  const role =
    request.auth.token.role;

  if (
    role !== "admin" &&
    role !== "staff"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only staff or admins can rebuild report analytics."
    );
  }
}

function getPayload(
  data: unknown
): RebuildReportsAnalyticsPayload {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return {};
  }

  return data as RebuildReportsAnalyticsPayload;
}

function getAuthEmail(
  request: CallableRequestLike
): string {
  const email =
    request.auth?.token.email;

  return typeof email === "string"
    ? email
    : "";
}

function normalizeReportType(
  value: unknown
): ReportType {
  const resolved =
    resolveReportType(
      cleanText(value)
    );

  return (
    REPORT_TYPES.includes(
      resolved as ReportType
    )
      ? (resolved as ReportType)
      : "generic"
  );
}

function emptyCounts(): CountsByType {
  return REPORT_TYPES.reduce(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as CountsByType
  );
}

function safeNumber(
  value: unknown
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : 0;
}

function formatGeneratedAtLabel(
  date = new Date()
): string {
  return date.toLocaleString(
    "en-US",
    {
      timeZone:
        "America/Chicago",

      year: "numeric",

      month: "short",

      day: "2-digit",

      hour: "numeric",

      minute: "2-digit",
    }
  );
}

export const rebuildReportsAnalytics =
  onCall(
    {
      region: "us-central1",

      timeoutSeconds: 540,

      memory: "1GiB",
    },

    async (request) => {
      requireStaffOrAdmin(
        request as CallableRequestLike
      );

      const payload =
        getPayload(request.data);

      const includeRowScan =
        payload.includeRowScan !==
        false;

      const uid =
        request.auth!.uid;

      const email =
        getAuthEmail(
          request as CallableRequestLike
        );

      const startedAtMs =
        Date.now();

      const jobRef =
        await db
          .collection("systemJobs")
          .add({
            type:
              "rebuildReportsAnalytics",

            status:
              "processing",

            stage: "starting",

            includeRowScan,

            requestedBy: uid,

            requestedByEmail:
              email,

            startedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          });

      try {
        const countsByType =
          emptyCounts();

        const filesByType =
          emptyCounts();

        const uniqueFiles =
          new Set<string>();

        let totalRows = 0;

        let totalReportDocs = 0;

        let reportsWithZeroRows = 0;

        let scannedRowDocs = 0;

        await jobRef.set(
          {
            stage:
              "reading_reports",

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const reportsSnap =
          await db
            .collection(
              "importedReports"
            )
            .get();

        totalReportDocs =
          reportsSnap.size;

        for (const reportDoc of reportsSnap.docs) {
          const data =
            reportDoc.data();

          uniqueFiles.add(
            reportDoc.id
          );

          const reportType =
            normalizeReportType(
              data.reportType ||
                data.detectedReportType ||
                data.sourceReportType ||
                data.fileName
            );

          filesByType[
            reportType
          ] += 1;

          const rowCount =
            safeNumber(
              data.totalRows
            ) ||
            safeNumber(
              data.rowCount
            ) ||
            safeNumber(
              data.processedRows
            );

          if (rowCount > 0) {
            totalRows += rowCount;

            countsByType[
              reportType
            ] += rowCount;
          } else {
            reportsWithZeroRows += 1;
          }
        }

        if (
          includeRowScan
        ) {
          await jobRef.set(
            {
              stage:
                "scanning_rows",

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const rowCounts =
            emptyCounts();

          const rowsSnap =
            await db
              .collectionGroup(
                "rows"
              )
              .get();

          scannedRowDocs =
            rowsSnap.size;

          if (
            scannedRowDocs >
            MAX_ANALYTICS_ROWS
          ) {
            throw new Error(
              `Row scan exceeded max allowed rows (${MAX_ANALYTICS_ROWS})`
            );
          }

          rowsSnap.forEach(
            (rowDoc) => {
              const data =
                rowDoc.data();

              const parentReportId =
                rowDoc.ref.parent
                  .parent?.id;

              if (
                parentReportId
              ) {
                uniqueFiles.add(
                  parentReportId
                );
              }

              const reportType =
                normalizeReportType(
                  data.reportType ||
                    data.sourceReportType ||
                    data.detectedReportType ||
                    parentReportId
                );

              rowCounts[
                reportType
              ] += 1;
            }
          );

          totalRows =
            scannedRowDocs;

          for (const type of REPORT_TYPES) {
            countsByType[
              type
            ] =
              rowCounts[type];
          }
        }

        const durationMs =
          Date.now() -
          startedAtMs;

        const analyticsPayload =
          {
            totalRows,

            totalFiles:
              uniqueFiles.size,

            totalReportDocs,

            reportsWithZeroRows,

            scannedRowDocs,

            countsByType,

            filesByType,

            includeRowScan,

            generatedAtLabel:
              formatGeneratedAtLabel(),

            rebuiltByUid:
              uid,

            rebuiltByEmail:
              email,

            durationMs,

            analyticsVersion:
              "reports-v3",

            analyticsGeneratedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          };

        await db
          .collection(
            "analytics"
          )
          .doc("reports")
          .set(
            analyticsPayload,
            {
              merge: true,
            }
          );

        await jobRef.set(
          {
            status:
              "completed",

            stage:
              "completed",

            totalRows,

            totalFiles:
              uniqueFiles.size,

            totalReportDocs,

            reportsWithZeroRows,

            scannedRowDocs,

            countsByType,

            filesByType,

            durationMs,

            completedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        logger.info(
          "Reports analytics rebuilt",
          {
            totalRows,

            totalFiles:
              uniqueFiles.size,

            totalReportDocs,

            scannedRowDocs,

            durationMs,
          }
        );

        return {
          ok: true,

          totalRows,

          totalFiles:
            uniqueFiles.size,

          totalReportDocs,

          scannedRowDocs,

          durationMs,
        };

      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed rebuilding analytics";

        logger.error(
          "rebuildReportsAnalytics failed",
          {
            error: message,
          }
        );

        await jobRef.set(
          {
            status: "failed",

            stage: "failed",

            error: message,

            failedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        throw new HttpsError(
          "internal",
          message
        );
      }
    }
  );