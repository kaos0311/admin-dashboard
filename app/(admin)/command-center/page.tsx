"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  FileWarning,
  HeartPulse,
  Loader2,
  ShieldAlert,
  Stethoscope,
  Wrench,
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type Severity = "low" | "medium" | "high" | "critical";
type IssueStatus = "open" | "reviewed" | "resolved";
type TaskStatus = "open" | "in_progress" | "blocked" | "completed";

type ComplianceIssue = {
  id: string;
  patientId?: string;
  patientName?: string;
  dob?: string;
  issueType?: string;
  severity?: Severity;
  status?: IssueStatus;
  source?: string;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

type CommandTask = {
  id: string;
  title?: string;
  description?: string;
  patientId?: string;
  assignedTo?: string;
  department?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: TaskStatus;
  dueDate?: Timestamp | string | null;
  escalationLevel?: number;
  createdAt?: Timestamp | null;
};

type HospiceRecord = {
  id: string;
  patientName?: string;
  hospiceProvider?: string;
  status?: string;
  openIssues?: unknown[];
};

type EquipmentRecall = {
  id: string;
  recallTitle?: string;
  manufacturer?: string;
  model?: string;
  severity?: Severity;
  active?: boolean;
};

function formatIssueType(value?: string) {
  if (!value) return "Unknown Issue";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function severityRank(severity?: Severity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function priorityRank(priority?: CommandTask["priority"]) {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function badgeClass(value?: string) {
  switch (value) {
    case "critical":
    case "urgent":
    case "blocked":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/40 bg-orange-500/10 text-orange-300";
    case "medium":
    case "in_progress":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
    case "low":
    case "open":
      return "border-blue-500/40 bg-blue-500/10 text-blue-300";
    case "resolved":
    case "completed":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/5 text-neutral-300";
  }
}

export default function CommandCenterPage() {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [tasks, setTasks] = useState<CommandTask[]>([]);
  const [hospice, setHospice] = useState<HospiceRecord[]>([]);
  const [recalls, setRecalls] = useState<EquipmentRecall[]>([]);
  const [loading, setLoading] = useState(true);

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

    const hospiceQuery = query(
      collection(db, "hospiceOversight"),
      limit(50)
    );

    const recallQuery = query(
      collection(db, "equipmentRecalls"),
      where("active", "==", true),
      limit(50)
    );

    const unsubIssues = onSnapshot(issueQuery, (snapshot) => {
      setIssues(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ComplianceIssue[]
      );
      setLoading(false);
    });

    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      setTasks(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CommandTask[]
      );
    });

    const unsubHospice = onSnapshot(hospiceQuery, (snapshot) => {
      setHospice(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as HospiceRecord[]
      );
    });

    const unsubRecalls = onSnapshot(recallQuery, (snapshot) => {
      setRecalls(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as EquipmentRecall[]
      );
    });

    return () => {
      unsubIssues();
      unsubTasks();
      unsubHospice();
      unsubRecalls();
    };
  }, []);

  const stats = useMemo(() => {
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

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-white md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-red-950/30 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
                Operations Intelligence
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Command Center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
                Central oversight for compliance problems, task escalation,
                hospice risk, recalls, and patient operations. This is where
                the database stops being a junk drawer with Wi-Fi.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-300">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading command data
                </span>
              ) : (
                <span>
                  Monitoring{" "}
                  <strong className="text-white">{stats.openIssues}</strong>{" "}
                  open issues
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Open Compliance Issues"
            value={stats.openIssues}
            icon={<ShieldAlert className="h-5 w-5" />}
            tone="red"
          />

          <StatCard
            title="Critical Issues"
            value={stats.criticalIssues}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="orange"
          />

          <StatCard
            title="Open Tasks"
            value={stats.openTasks}
            icon={<ClipboardList className="h-5 w-5" />}
            tone="blue"
          />

          <StatCard
            title="Escalated Tasks"
            value={stats.escalatedTasks}
            icon={<FileWarning className="h-5 w-5" />}
            tone="yellow"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MiniCard title="Missing CMNs" value={stats.missingCmns} />
          <MiniCard title="Expired PARs" value={stats.expiredPars} />
          <MiniCard title="Missing Serials" value={stats.missingSerials} />
          <MiniCard title="Hospice Records" value={stats.hospiceRecords} />
          <MiniCard title="Active Recalls" value={stats.activeRecalls} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Priority Compliance Issues"
            subtitle="Highest-risk open issues first."
            icon={<Stethoscope className="h-5 w-5 text-red-300" />}
          >
            {topIssues.length === 0 ? (
              <EmptyState text="No open compliance issues found. Either things are clean, or the engine has not started doing its job yet." />
            ) : (
              <div className="space-y-3">
                {topIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">
                          {formatIssueType(issue.issueType)}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-400">
                          {issue.patientName || "Unknown patient"}
                          {issue.dob ? ` • DOB: ${issue.dob}` : ""}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                          issue.severity
                        )}`}
                      >
                        {issue.severity || "unknown"}
                      </span>
                    </div>

                    {issue.notes ? (
                      <p className="mt-3 text-sm leading-6 text-neutral-300">
                        {issue.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Task Escalation"
            subtitle="Open, blocked, and urgent work."
            icon={<ClipboardList className="h-5 w-5 text-blue-300" />}
          >
            {topTasks.length === 0 ? (
              <EmptyState text="No open tasks found. Suspiciously peaceful, which usually means nobody entered the work yet." />
            ) : (
              <div className="space-y-3">
                {topTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">
                          {task.title || "Untitled Task"}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-400">
                          {task.assignedTo || "Unassigned"}
                          {task.department ? ` • ${task.department}` : ""}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                          task.priority
                        )}`}
                      >
                        {task.priority || "normal"}
                      </span>
                    </div>

                    {task.description ? (
                      <p className="mt-3 text-sm leading-6 text-neutral-300">
                        {task.description}
                      </p>
                    ) : null}

                    {(task.escalationLevel ?? 0) > 0 ? (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-300">
                        Escalation Level {task.escalationLevel}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Hospice Oversight"
            subtitle="Active hospice monitoring."
            icon={<HeartPulse className="h-5 w-5 text-pink-300" />}
          >
            {hospice.length === 0 ? (
              <EmptyState text="No hospice oversight records found." />
            ) : (
              <div className="space-y-3">
                {hospice.slice(0, 6).map((record) => (
                  <div
                    key={record.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <h3 className="font-semibold text-white">
                      {record.patientName || "Unknown patient"}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-400">
                      {record.hospiceProvider || "Unknown provider"}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-neutral-400">Status</span>
                      <span className="font-semibold text-white">
                        {record.status || "unknown"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Active Equipment Recalls"
            subtitle="Recall records marked active."
            icon={<Wrench className="h-5 w-5 text-orange-300" />}
          >
            {recalls.length === 0 ? (
              <EmptyState text="No active recalls found." />
            ) : (
              <div className="space-y-3">
                {recalls.slice(0, 6).map((recall) => (
                  <div
                    key={recall.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">
                          {recall.recallTitle || "Untitled Recall"}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-400">
                          {recall.manufacturer || "Unknown manufacturer"}
                          {recall.model ? ` • ${recall.model}` : ""}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                          recall.severity
                        )}`}
                      >
                        {recall.severity || "unknown"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "red" | "orange" | "blue" | "yellow";
}) {
  const toneClass =
    tone === "red"
      ? "from-red-500/20 to-red-950/20 text-red-300"
      : tone === "orange"
        ? "from-orange-500/20 to-orange-950/20 text-orange-300"
        : tone === "yellow"
          ? "from-yellow-500/20 to-yellow-950/20 text-yellow-300"
          : "from-blue-500/20 to-blue-950/20 text-blue-300";

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-900/80 p-5 shadow-xl">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClass}`}
      >
        {icon}
      </div>

      <p className="text-sm text-neutral-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4">
      <p className="text-sm text-neutral-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-neutral-900/80 p-5 shadow-xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-neutral-400">
      {text}
    </div>
  );
}