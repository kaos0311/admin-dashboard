"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

export type ImportJobStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "error"
  | "cancelled"
  | "stuck";

export type ImportJob = {
  id: string;
  fileName: string;
  reportType: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  progress: number;
  storagePath: string | null;
  downloadUrl: string | null;
  error: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
};

export type ImportJobsStats = {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  stuck: number;
};

type UseImportJobsOptions = {
  maxResults?: number;
  reportType?: string;
  status?: ImportJobStatus | "all";
};

type UseImportJobsResult = {
  jobs: ImportJob[];
  stats: ImportJobsStats;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
};

const DEFAULT_MAX_RESULTS = 50;

const EMPTY_STATS: ImportJobsStats = {
  total: 0,
  queued: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  stuck: 0,
};

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStatus(value: unknown): ImportJobStatus {
  const status = typeof value === "string" ? value.toLowerCase().trim() : "";

  if (
    status === "queued" ||
    status === "uploading" ||
    status === "processing" ||
    status === "completed" ||
    status === "failed" ||
    status === "error" ||
    status === "cancelled" ||
    status === "stuck"
  ) {
    return status;
  }

  return "queued";
}

function isProbablyStuck(job: ImportJob): boolean {
  if (job.status !== "processing" && job.status !== "uploading") return false;
  if (!job.updatedAt) return false;

  const fifteenMinutes = 15 * 60 * 1000;

  return Date.now() - job.updatedAt.getTime() > fifteenMinutes;
}

function normalizeImportJob(id: string, data: Record<string, unknown>): ImportJob {
  const totalRows = toNumber(data.totalRows ?? data.rowCount ?? data.total);
  const processedRows = toNumber(data.processedRows ?? data.importedRows);
  const failedRows = toNumber(data.failedRows ?? data.errorRows);

  const calculatedProgress =
    totalRows <= 0 ? 0 : Math.round((processedRows / totalRows) * 100);

  const rawProgress = toNumber(data.progress);

  const createdAt = toDate(data.createdAt);
  const updatedAt = toDate(data.updatedAt);
  const completedAt = toDate(data.completedAt);

  const job: ImportJob = {
    id,
    fileName:
      toStringOrNull(data.fileName) ??
      toStringOrNull(data.originalFileName) ??
      toStringOrNull(data.name) ??
      "Unnamed import",

    reportType:
      toStringOrNull(data.reportType) ??
      toStringOrNull(data.type) ??
      "generic",

    status: normalizeStatus(data.status),

    totalRows,
    processedRows,
    failedRows,

    progress: Math.min(Math.max(rawProgress || calculatedProgress, 0), 100),

    storagePath: toStringOrNull(data.storagePath),
    downloadUrl: toStringOrNull(data.downloadUrl),

    error:
      toStringOrNull(data.error) ??
      toStringOrNull(data.errorMessage) ??
      null,

    createdAt,
    updatedAt,
    completedAt,
  };

  return {
    ...job,
    status: isProbablyStuck(job) ? "stuck" : job.status,
  };
}

async function getStatusCount(status: ImportJobStatus): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, "importJobs"), where("status", "==", status)),
  );

  return snapshot.data().count;
}

export function useImportJobs(
  options?: UseImportJobsOptions,
): UseImportJobsResult {
  const {
    maxResults = DEFAULT_MAX_RESULTS,
    reportType,
    status = "all",
  } = options ?? {};

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const constraints = [];

      if (reportType && reportType !== "all") {
        constraints.push(where("reportType", "==", reportType));
      }

      if (status !== "all" && status !== "stuck") {
        constraints.push(where("status", "==", status));
      }

      constraints.push(orderBy("createdAt", "desc"));
      constraints.push(limit(maxResults));

      const jobsQuery = query(collection(db, "importJobs"), ...constraints);
      const snapshot = await getDocs(jobsQuery);

      let normalizedJobs = snapshot.docs.map((jobDoc) =>
        normalizeImportJob(jobDoc.id, jobDoc.data() as Record<string, unknown>),
      );

      if (status === "stuck") {
        normalizedJobs = normalizedJobs.filter((job) => job.status === "stuck");
      }

      setJobs(normalizedJobs);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load import jobs.";

      setError(message);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [maxResults, reportType, status]);

  const refresh = useCallback(async () => {
    await loadJobs();
  }, [loadJobs]);

  const deleteJob = useCallback(
    async (jobId: string) => {
      await deleteDoc(doc(db, "importJobs", jobId));

      setJobs((current) => current.filter((job) => job.id !== jobId));
    },
    [],
  );

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const stats = useMemo<ImportJobsStats>(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;

        if (job.status === "queued") acc.queued += 1;
        if (job.status === "processing" || job.status === "uploading") {
          acc.processing += 1;
        }
        if (job.status === "completed") acc.completed += 1;
        if (job.status === "failed" || job.status === "error") acc.failed += 1;
        if (job.status === "stuck") acc.stuck += 1;

        return acc;
      },
      { ...EMPTY_STATS },
    );
  }, [jobs]);

  return {
    jobs,
    stats,
    loading,
    refreshing,
    error,
    refresh,
    deleteJob,
  };
}
