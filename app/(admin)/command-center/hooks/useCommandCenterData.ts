"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  orderBy,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import type {
  CommandCenterStats,
  CommandImportedReport,
  CommandTask,
  ComplianceIssue,
  EquipmentRecall,
  HospiceRecord,
} from "../types";
import { priorityRank, severityRank } from "../utils/commandCenterSort";

type LoadState = {
  issues: boolean;
  tasks: boolean;
  hospice: boolean;
  recalls: boolean;
  importedReports: boolean;
  importJobs: boolean;
};

const INITIAL_LOAD_STATE: LoadState = {
  issues: false,
  tasks: false,
  hospice: false,
  recalls: false,
  importedReports: false,
  importJobs: false,
};

function mapDoc<T extends { id: string }>(
  doc: { id: string; data: () => Record<string, unknown> }
): T {
  return {
    id: doc.id,
    ...doc.data(),
  } as T;
}

function reportRowCount(report: CommandImportedReport): number {
  return (
    Number(report.rowCount) ||
    Number(report.rowsInserted) ||
    Number(report.rowsProcessed) ||
    Number(report.processedRows) ||
    Number(report.totalRows) ||
    0
  );
}

function reportType(report: CommandImportedReport): string {
  return (
    report.reportType ||
    report.primaryReportType ||
    report.selectedReportType ||
    "custom"
  );
}

function mergeCommandImports(
  reports: CommandImportedReport[],
  jobs: CommandImportedReport[]
): CommandImportedReport[] {
  const merged = new Map<string, CommandImportedReport>();

  jobs.forEach((job) => merged.set(job.id, job));
  reports.forEach((report) => {
    const job = merged.get(report.id);

    merged.set(report.id, {
      ...job,
      ...report,
      rowCount: reportRowCount(report) || (job ? reportRowCount(job) : 0),
      uploadedAt:
        report.uploadedAt || job?.uploadedAt || job?.createdAt || job?.startedAt || null,
    });
  });

  return [...merged.values()].slice(0, 50);
}

export function useCommandCenterData() {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [tasks, setTasks] = useState<CommandTask[]>([]);
  const [hospice, setHospice] = useState<HospiceRecord[]>([]);
  const [recalls, setRecalls] = useState<EquipmentRecall[]>([]);
  const [importedReportDocs, setImportedReportDocs] = useState<CommandImportedReport[]>([]);
  const [importJobDocs, setImportJobDocs] = useState<CommandImportedReport[]>([]);
  const [loaded, setLoaded] = useState<LoadState>(INITIAL_LOAD_STATE);

  useEffect(() => {
    const issueQuery = query(
      collection(db, "complianceIssues"),
      where("status", "in", ["open", "reviewed"]),
      limit(100)
    );

    const taskQuery = query(
      collection(db, "tasks"),
      where("status", "in", ["open", "in_progress", "blocked"]),
      limit(100)
    );

    const hospiceQuery = query(collection(db, "hospiceOversight"), limit(50));

    const recallQuery = query(
      collection(db, "equipmentRecalls"),
      where("active", "==", true),
      limit(50)
    );

    const importQuery = query(
      collection(db, "importedReports"),
      orderBy("uploadedAt", "desc"),
      limit(50)
    );

    const importJobsQuery = query(
      collection(db, "importJobs"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubIssues = onSnapshot(
      issueQuery,
      (snapshot) => {
        setIssues(snapshot.docs.map((doc) => mapDoc<ComplianceIssue>(doc)));
        setLoaded((current) => ({ ...current, issues: true }));
      },
      (error) => {
        console.error("COMMAND CENTER ISSUES SNAPSHOT ERROR:", error);
        toast.error("Failed to load compliance issues.");
        setLoaded((current) => ({ ...current, issues: true }));
      }
    );

    const unsubTasks = onSnapshot(
      taskQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map((doc) => mapDoc<CommandTask>(doc)));
        setLoaded((current) => ({ ...current, tasks: true }));
      },
      (error) => {
        console.error("COMMAND CENTER TASKS SNAPSHOT ERROR:", error);
        toast.error("Failed to load command tasks.");
        setLoaded((current) => ({ ...current, tasks: true }));
      }
    );

    const unsubHospice = onSnapshot(
      hospiceQuery,
      (snapshot) => {
        setHospice(snapshot.docs.map((doc) => mapDoc<HospiceRecord>(doc)));
        setLoaded((current) => ({ ...current, hospice: true }));
      },
      (error) => {
        console.error("COMMAND CENTER HOSPICE SNAPSHOT ERROR:", error);
        toast.error("Failed to load hospice oversight.");
        setLoaded((current) => ({ ...current, hospice: true }));
      }
    );

    const unsubImports = onSnapshot(
      importQuery,
      (snapshot) => {
        setImportedReportDocs(
          snapshot.docs.map((doc) => mapDoc<CommandImportedReport>(doc))
        );
        setLoaded((current) => ({ ...current, importedReports: true }));
      },
      (error) => {
        console.error("COMMAND CENTER IMPORTS SNAPSHOT ERROR:", error);
        toast.error("Failed to load uploaded report command feed.");
        setLoaded((current) => ({ ...current, importedReports: true }));
      }
    );

    const unsubImportJobs = onSnapshot(
      importJobsQuery,
      (snapshot) => {
        setImportJobDocs(
          snapshot.docs.map((doc) => mapDoc<CommandImportedReport>(doc))
        );
        setLoaded((current) => ({ ...current, importJobs: true }));
      },
      (error) => {
        console.error("COMMAND CENTER IMPORT JOBS SNAPSHOT ERROR:", error);
        toast.error("Failed to load import job command feed.");
        setLoaded((current) => ({ ...current, importJobs: true }));
      }
    );

    const unsubRecalls = onSnapshot(
      recallQuery,
      (snapshot) => {
        setRecalls(snapshot.docs.map((doc) => mapDoc<EquipmentRecall>(doc)));
        setLoaded((current) => ({ ...current, recalls: true }));
      },
      (error) => {
        console.error("COMMAND CENTER RECALLS SNAPSHOT ERROR:", error);
        toast.error("Failed to load equipment recalls.");
        setLoaded((current) => ({ ...current, recalls: true }));
      }
    );

    return () => {
      unsubIssues();
      unsubTasks();
      unsubHospice();
      unsubRecalls();
      unsubImports();
      unsubImportJobs();
    };
  }, []);

  const loading = !Object.values(loaded).every(Boolean);

  const importedReports = useMemo(
    () => mergeCommandImports(importedReportDocs, importJobDocs),
    [importedReportDocs, importJobDocs]
  );

  const stats: CommandCenterStats = useMemo(() => {
    const openIssues = issues.filter((issue) => issue.status !== "resolved");

    const criticalIssues = openIssues.filter(
      (issue) => issue.severity === "critical"
    );

    const missingCmns = openIssues.filter(
      (issue) => issue.issueType === "missing_cmn"
    );

    const expiredPars = openIssues.filter(
      (issue) => issue.issueType === "expired_par"
    );

    const missingSerials = openIssues.filter(
      (issue) => issue.issueType === "missing_serial"
    );

    const escalatedTasks = tasks.filter(
      (task) => (task.escalationLevel ?? 0) > 0 || task.priority === "urgent"
    );

    return {
      openIssues: openIssues.length,
      criticalIssues: criticalIssues.length,
      missingCmns: missingCmns.length,
      expiredPars: expiredPars.length,
      missingSerials: missingSerials.length,
      openTasks: tasks.length,
      escalatedTasks: escalatedTasks.length,
      hospiceRecords: hospice.length,
      activeRecalls: recalls.length,
      importedReportFiles: importedReports.length,
      importedReportRows: importedReports.reduce(
        (sum, report) => sum + reportRowCount(report),
        0
      ),
      uploadedReportTypes: new Set(
        importedReports.map((report) => reportType(report))
      ).size,
    };
  }, [issues, tasks, hospice, recalls, importedReports]);

  const topIssues = useMemo(() => {
    return [...issues]
      .filter((issue) => issue.status !== "resolved")
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
      .slice(0, 8);
  }, [issues]);

  const topTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => task.status !== "completed")
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
      .slice(0, 8);
  }, [tasks]);

  return {
    issues,
    tasks,
    hospice,
    recalls,
    importedReports,
    topIssues,
    topTasks,
    stats,
    loading,
  };
}