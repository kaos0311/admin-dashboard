"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DatabaseZap,
  FileWarning,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { alerts, buttons, colors, typography } from "@/theme";

type SafetyIssueKind = "phi" | "compliance" | "import";

type SafetyIssue = {
  id: string;
  kind: SafetyIssueKind;
  title: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  sourceLabel: string;
  route: string;
  correctiveMeasures: string[];
};

const DISMISSED_KEY = "jarvisSafetyInterlockDismissed";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function severityRank(severity: SafetyIssue["severity"]): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function normalizeSeverity(value: unknown): SafetyIssue["severity"] {
  const normalized = text(value).toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(DISMISSED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(values: Set<string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...values]));
}

function issueIcon(kind: SafetyIssueKind) {
  if (kind === "phi") {
    return <ShieldAlert className="h-7 w-7" aria-hidden="true" />;
  }

  if (kind === "import") {
    return <FileWarning className="h-7 w-7" aria-hidden="true" />;
  }

  return <DatabaseZap className="h-7 w-7" aria-hidden="true" />;
}

function issueRoute(kind: SafetyIssueKind): string {
  if (kind === "phi") return "/command-center";
  if (kind === "import") return "/reports/upload";
  return "/command-center";
}

function issueIntro(kind: SafetyIssueKind): string {
  if (kind === "import") {
    return "Jarvis found a failed import that needs review before the report data is relied on downstream.";
  }

  return "Jarvis halted forward progress because this item could affect data accuracy, compliance, or patient information safety.";
}

export function JarvisSafetyInterlock() {
  const [phiIssues, setPhiIssues] = useState<SafetyIssue[]>([]);
  const [complianceIssues, setComplianceIssues] = useState<SafetyIssue[]>([]);
  const [importIssues, setImportIssues] = useState<SafetyIssue[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

  useEffect(() => {
    const phiQuery = query(
      collection(db, "phiAlerts"),
      where("status", "==", "open"),
      limit(10),
    );

    const unsubscribe = onSnapshot(
      phiQuery,
      (snapshot) => {
        setPhiIssues(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            const sourceCollection = text(data.sourceCollection);
            const sourceFieldPath = text(data.sourceFieldPath);
            const detectedTypes = stringArray(data.detectedTypes);

            return {
              id: `phi:${doc.id}`,
              kind: "phi",
              title: "Potential PHI/HIPAA Exposure",
              reason:
                text(data.recommendation) ||
                "Jarvis found patient-sensitive information in a field that may be too broad for safe operational use.",
              severity: normalizeSeverity(data.severity),
              sourceLabel: [sourceCollection, sourceFieldPath]
                .filter(Boolean)
                .join(" / ") || "PHI alert",
              route: issueRoute("phi"),
              correctiveMeasures:
                stringArray(data.correctiveMeasures).length > 0
                  ? stringArray(data.correctiveMeasures)
                  : [
                      "Review the flagged field before exporting or sharing reports.",
                      "Move legitimate patient-specific detail into the protected patient chart or document record.",
                      "Remove PHI from operational notes, raw text, search text, and summaries unless it is required.",
                      detectedTypes.length
                        ? `Detected type(s): ${detectedTypes.join(", ")}.`
                        : "Run the PHI scan again after correcting the field.",
                    ],
            };
          }),
        );
      },
      (error) => {
        console.error("JARVIS PHI INTERLOCK SNAPSHOT ERROR:", error);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const complianceQuery = query(
      collection(db, "complianceIssues"),
      where("status", "in", ["open", "blocked"]),
      limit(10),
    );

    const unsubscribe = onSnapshot(
      complianceQuery,
      (snapshot) => {
        setComplianceIssues(
          snapshot.docs.map((doc) => {
            const data = doc.data();

            return {
              id: `compliance:${doc.id}`,
              kind: "compliance",
              title: text(data.title) || "Compliance Issue Requires Review",
              reason:
                text(data.description) ||
                text(data.message) ||
                "Jarvis found an open compliance issue that should be reviewed before relying on downstream data.",
              severity: normalizeSeverity(data.severity || data.priority),
              sourceLabel: text(data.source) || "Compliance issue",
              route: issueRoute("compliance"),
              correctiveMeasures:
                stringArray(data.correctiveMeasures).length > 0
                  ? stringArray(data.correctiveMeasures)
                  : [
                      "Open Command Center and review the issue details.",
                      "Correct the source record or document the reason it is acceptable.",
                      "Mark the issue reviewed or resolved once the correction is complete.",
                    ],
            };
          }),
        );
      },
      (error) => {
        console.error("JARVIS COMPLIANCE INTERLOCK SNAPSHOT ERROR:", error);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const importQuery = query(
      collection(db, "importJobs"),
      where("jarvisScreening.status", "==", "failed"),
      limit(10),
    );

    const unsubscribe = onSnapshot(
      importQuery,
      (snapshot) => {
        setImportIssues(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            const screening =
              data.jarvisScreening && typeof data.jarvisScreening === "object"
                ? (data.jarvisScreening as Record<string, unknown>)
                : {};
            return {
              id: `import:${doc.id}:failed`,
              kind: "import",
              title: "Import Pipeline Failed Screening",
              reason:
                text(screening.message) ||
                "Jarvis found a report import that may not have safely reached every destination.",
              severity: "high",
              sourceLabel: text(data.fileName || data.originalFileName) || doc.id,
              route: issueRoute("import"),
              correctiveMeasures:
                stringArray(screening.recommendations).length > 0
                  ? stringArray(screening.recommendations)
                  : [
                      "Open Upload & Index.",
                      "Click the report tracker to see where the data did or did not write.",
                      "Fix the source report or mapping issue, then reprocess the import.",
                      "Click the Jarvis badge again after correction.",
                    ],
            };
          }),
        );
      },
      (error) => {
        console.error("JARVIS IMPORT INTERLOCK SNAPSHOT ERROR:", error);
      },
    );

    return unsubscribe;
  }, []);

  const activeIssue = useMemo(() => {
    return [...phiIssues, ...complianceIssues, ...importIssues]
      .filter((issue) => !dismissed.has(issue.id))
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  }, [complianceIssues, dismissed, importIssues, phiIssues]);

  if (!activeIssue) return null;

  function acknowledgeIssue() {
    if (!activeIssue) return;

    setDismissed((current) => {
      const next = new Set(current);
      next.add(activeIssue.id);
      writeDismissed(next);
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jarvis-safety-title"
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-red-300/20 bg-[#090d14]/95 p-6 text-white shadow-2xl shadow-black/50">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-red-300/20 bg-red-500/15 p-3 text-red-100">
            {issueIcon(activeIssue.kind)}
          </div>

          <div className="min-w-0 flex-1">
            <p className={typography.eyebrow}>Jarvis Safety Interlock</p>
            <h2 id="jarvis-safety-title" className="mt-2 text-2xl font-bold tracking-tight">
              {activeIssue.title}
            </h2>
            <p className={`mt-2 ${typography.bodyMuted}`}>
              {issueIntro(activeIssue.kind)}
            </p>
          </div>
        </div>

        <div className={`mt-5 ${alerts.danger}`}>
          <p className="font-semibold">Why Jarvis stopped you</p>
          <p className="mt-1">{activeIssue.reason}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className={typography.formLabel}>Source</p>
          <p className={`mt-1 ${typography.bodyStrong}`}>{activeIssue.sourceLabel}</p>
          <p className={`mt-2 ${colors.textFaint}`}>
            Severity: {activeIssue.severity.toUpperCase()}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-cyan-200" aria-hidden="true" />
            <p className={typography.cardTitle}>Steps To Fix Before Proceeding</p>
          </div>

          <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
            {activeIssue.correctiveMeasures.map((measure, index) => (
              <li key={`${measure}-${index}`} className="flex gap-2">
                <span className="font-semibold text-cyan-200">{index + 1}.</span>
                <span>{measure}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={acknowledgeIssue}
            className={buttons.secondary}
          >
            I Understand
          </button>

          <Link
            href={activeIssue.route}
            onClick={acknowledgeIssue}
            className={buttons.primary}
          >
            Open Fix Page
          </Link>
        </div>
      </section>
    </div>
  );
}
