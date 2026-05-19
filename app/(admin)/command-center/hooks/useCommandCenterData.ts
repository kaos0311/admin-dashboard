"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import type {
  CommandCenterStats,
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
};

const INITIAL_LOAD_STATE: LoadState = {
  issues: false,
  tasks: false,
  hospice: false,
  recalls: false,
};

function mapDoc<T extends { id: string }>(
  doc: { id: string; data: () => Record<string, unknown> }
): T {
  return {
    id: doc.id,
    ...doc.data(),
  } as T;
}

export function useCommandCenterData() {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [tasks, setTasks] = useState<CommandTask[]>([]);
  const [hospice, setHospice] = useState<HospiceRecord[]>([]);
  const [recalls, setRecalls] = useState<EquipmentRecall[]>([]);
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
    };
  }, []);

  const loading = !Object.values(loaded).every(Boolean);

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
    };
  }, [issues, tasks, hospice, recalls]);

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
    topIssues,
    topTasks,
    stats,
    loading,
  };
}