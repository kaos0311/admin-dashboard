"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Download,
  FileSearch,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import OpenUploadCenterButton from "../components/OpenUploadCenterButton";
import { badges, buttons, colors, glass, tables, typography } from "@/theme";
import { db, functions } from "@/lib/firebase";

type InsuranceDoc = Record<string, unknown> & {
  id: string;
};

type InsuranceBridgeState = {
  payers: InsuranceDoc[];
  coverageRecords: InsuranceDoc[];
  insurancePatients: InsuranceDoc[];
  queueItems: InsuranceDoc[];
  authorizations: InsuranceDoc[];
  loading: boolean;
  error: string;
};

type PayerSummary = {
  payerName: string;
  coverageCount: number;
  patientCount: number;
  activeCount: number;
  issueCount: number;
  source: string;
};

type PayerIssueReport = {
  payerName: string;
  generatedAt: string;
  coverageRecords: InsuranceDoc[];
  insurancePatients: InsuranceDoc[];
  queueItems: InsuranceDoc[];
  authorizations: InsuranceDoc[];
  issues: PayerIssue[];
};

type PayerIssue = {
  title: string;
  source: string;
  status: string;
  severity: "info" | "warning" | "error";
  instruction: string;
  date: string;
};

type AskAdminAiResponse = {
  answer?: string;
};

const COLLECTION_LIMIT = 300;

const askAdminAi = httpsCallable<{ prompt: string }, AskAdminAiResponse>(
  functions,
  "askAdminAi"
);

const initialBridgeState: InsuranceBridgeState = {
  payers: [],
  coverageRecords: [],
  insurancePatients: [],
  queueItems: [],
  authorizations: [],
  loading: true,
  error: "",
};

function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readStatus(record: InsuranceDoc): string {
  return (
    readString(record.status) ||
    readString(record.insuranceStatus) ||
    readString(record.parStatus) ||
    "unknown"
  ).toLowerCase();
}

function payerName(record: InsuranceDoc): string {
  return (
    readString(record.insuranceName) ||
    readString(record.payerName) ||
    readString(record.insurance) ||
    readString(record.primaryInsurance) ||
    "Unknown payer"
  );
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function patientKey(record: InsuranceDoc): string {
  return (
    readString(record.patientKey) ||
    readString(record.patientId) ||
    readString(record.patientName) ||
    readString(record.id)
  );
}

function recordMatchesPayer(record: InsuranceDoc, targetPayer: string): boolean {
  const target = normalizeKey(targetPayer);
  if (!target) return false;

  return [
    payerName(record),
    readString(record.primaryInsurance),
    readString(record.secondaryInsurance),
    readString(record.insuranceNameWithKey),
    readString(record.payor),
    readString(record.payer),
  ]
    .map(normalizeKey)
    .filter(Boolean)
    .some((value) => value === target || value.includes(target) || target.includes(value));
}

function isClosedStatus(status: string): boolean {
  return [
    "closed",
    "complete",
    "completed",
    "done",
    "resolved",
    "inactive",
  ].includes(status);
}

function isCoverageIssue(record: InsuranceDoc): boolean {
  const status = readStatus(record);
  return (
    !payerName(record) ||
    status === "inactive" ||
    status === "missing" ||
    status === "expired" ||
    status === "denied" ||
    status === "unknown"
  );
}

function isOpenQueueRecord(record: InsuranceDoc): boolean {
  return !isClosedStatus(readStatus(record));
}

function hasDocumentationGap(record: InsuranceDoc): boolean {
  const text = [
    record.issue,
    record.queueType,
    record.sourceReport,
    record.notes,
    record.status,
  ]
    .map(readString)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("cmn") ||
    text.includes("document") ||
    text.includes("note") ||
    text.includes("missing") ||
    text.includes("support")
  );
}

function getDateValue(record: InsuranceDoc): string {
  return (
    readString(record.dueDate) ||
    readString(record.parExpiration) ||
    readString(record.updatedAt) ||
    readString(record.createdAt)
  );
}

function instructionForRecord(record: InsuranceDoc, source: string): string {
  const status = readStatus(record);
  const text = [
    record.issue,
    record.queueType,
    record.notes,
    record.message,
    record.status,
    record.parStatus,
  ]
    .map(readString)
    .join(" ")
    .toLowerCase();

  if (!payerName(record) || payerName(record) === "Unknown payer") {
    return "Fix the source upload row by assigning the correct payer name, then re-import or update the payer mapping before billing.";
  }

  if (status === "denied") {
    return "Review the denial reason, confirm the billed HCPCS/modifier and diagnosis support, correct the claim or authorization record, and resubmit with payer-required documentation.";
  }

  if (status === "expired") {
    return "Obtain updated eligibility or authorization dates from the payer portal, update the authorization/coverage record, and hold billing until the valid date range is confirmed.";
  }

  if (status === "inactive" || status === "missing" || status === "unknown") {
    return "Run eligibility verification, confirm the active payer and policy status, correct the insurance bridge record, and document verification before releasing billing.";
  }

  if (text.includes("auth") || text.includes("par") || source.includes("authorization")) {
    return "Check payer prior authorization requirements for the ordered HCPCS, attach required clinical/order documentation, submit or refresh the PAR, and record the approval number and expiration date.";
  }

  if (text.includes("cmn") || text.includes("document") || text.includes("missing") || text.includes("support")) {
    return "Collect the missing CMN, order, chart note, or support file, attach it to the patient record, then rerun the insurance queue check before billing.";
  }

  return "Review this payer record against the upload source, verify eligibility and billing requirements, update the bridge data, and document the staff action taken.";
}

function issueTitle(record: InsuranceDoc, fallback: string): string {
  return (
    readString(record.issue) ||
    readString(record.queueType) ||
    readString(record.message) ||
    readString(record.status) ||
    fallback
  );
}

function buildPayerIssueReport(
  payerNameValue: string,
  bridge: InsuranceBridgeState
): PayerIssueReport {
  const coverageRecords = bridge.coverageRecords.filter((record) =>
    recordMatchesPayer(record, payerNameValue)
  );
  const insurancePatients = bridge.insurancePatients.filter((record) =>
    recordMatchesPayer(record, payerNameValue)
  );
  const queueItems = bridge.queueItems.filter((record) =>
    recordMatchesPayer(record, payerNameValue)
  );
  const authorizations = bridge.authorizations.filter((record) =>
    recordMatchesPayer(record, payerNameValue)
  );

  const coverageIssues = coverageRecords
    .filter(isCoverageIssue)
    .map((record): PayerIssue => ({
      title: issueTitle(record, "Coverage verification issue"),
      source: "insuranceRecords",
      status: readStatus(record),
      severity: readStatus(record) === "denied" ? "error" : "warning",
      instruction: instructionForRecord(record, "insuranceRecords"),
      date: getDateValue(record),
    }));

  const queueIssues = [...queueItems, ...authorizations]
    .filter(isOpenQueueRecord)
    .map((record): PayerIssue => ({
      title: issueTitle(record, "Open insurance follow-up"),
      source: queueItems.includes(record) ? "insuranceQueue" : "patientAuthorizations",
      status: readStatus(record),
      severity: readStatus(record) === "denied" ? "error" : "warning",
      instruction: instructionForRecord(
        record,
        queueItems.includes(record) ? "insuranceQueue" : "patientAuthorizations"
      ),
      date: getDateValue(record),
    }));

  const documentationIssues = [...queueItems, ...authorizations]
    .filter(hasDocumentationGap)
    .map((record): PayerIssue => ({
      title: issueTitle(record, "Documentation gap"),
      source: queueItems.includes(record) ? "insuranceQueue" : "patientAuthorizations",
      status: readStatus(record),
      severity: "warning",
      instruction: instructionForRecord(
        record,
        queueItems.includes(record) ? "insuranceQueue" : "patientAuthorizations"
      ),
      date: getDateValue(record),
    }));

  const seen = new Set<string>();
  const issues = [...coverageIssues, ...queueIssues, ...documentationIssues].filter(
    (issue) => {
      const key = [
        issue.title,
        issue.source,
        issue.status,
        issue.date,
        issue.instruction,
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }
  );

  return {
    payerName: payerNameValue,
    generatedAt: new Date().toISOString(),
    coverageRecords,
    insurancePatients,
    queueItems,
    authorizations,
    issues,
  };
}

function buildReportText(report: PayerIssueReport): string {
  const lines = [
    `Insurance Upload Bridge Report`,
    `Payer: ${report.payerName}`,
    `Generated: ${report.generatedAt}`,
    ``,
    `Bridge Counts`,
    `- Coverage records: ${report.coverageRecords.length}`,
    `- Insurance patient records: ${report.insurancePatients.length}`,
    `- Queue records: ${report.queueItems.length}`,
    `- Authorization records: ${report.authorizations.length}`,
    `- Issues requiring action: ${report.issues.length}`,
    ``,
    `Issues and Direct Fix Instructions`,
  ];

  if (report.issues.length === 0) {
    lines.push("- No open issues were found in the loaded insurance bridge sample.");
  } else {
    report.issues.forEach((issue, index) => {
      lines.push(
        ``,
        `${index + 1}. ${issue.title}`,
        `   Source: ${issue.source}`,
        `   Status: ${issue.status || "unknown"}`,
        `   Severity: ${issue.severity}`,
        `   Date: ${issue.date || "not listed"}`,
        `   Fix: ${issue.instruction}`
      );
    });
  }

  lines.push(
    ``,
    `Staff Verification`,
    `- Verify payer portal policy before changing billing workflow.`,
    `- Keep policy numbers, member IDs, DOBs, and patient identifiers inside protected patient records.`,
    `- Document the payer portal, representative, or policy source used for the fix.`
  );

  return lines.join("\n");
}

function useInsuranceBridge(): InsuranceBridgeState {
  const [state, setState] = useState<InsuranceBridgeState>(initialBridgeState);

  useEffect(() => {
    const loaded = {
      payers: false,
      coverageRecords: false,
      insurancePatients: false,
      queueItems: false,
      authorizations: false,
    };

    function markLoaded(key: keyof typeof loaded) {
      loaded[key] = true;
      if (Object.values(loaded).every(Boolean)) {
        setState((current) => ({ ...current, loading: false }));
      }
    }

    function subscribe(
      collectionName: string,
      key: keyof Omit<InsuranceBridgeState, "loading" | "error">
    ) {
      return onSnapshot(
        query(collection(db, collectionName), limit(COLLECTION_LIMIT)),
        (snapshot) => {
          setState((current) => ({
            ...current,
            [key]: snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            })),
            error: "",
          }));
          markLoaded(key);
        },
        (error) => {
          console.error(`INSURANCE BRIDGE ${collectionName} SNAPSHOT ERROR:`, error);
          setState((current) => ({
            ...current,
            loading: false,
            error: "Unable to load one or more insurance bridge collections.",
          }));
        }
      );
    }

    const unsubscribers = [
      subscribe("insurance", "payers"),
      subscribe("insuranceRecords", "coverageRecords"),
      subscribe("insurancePatients", "insurancePatients"),
      subscribe("insuranceQueue", "queueItems"),
      subscribe("patientAuthorizations", "authorizations"),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return state;
}

function buildPayerSummaries(
  payers: InsuranceDoc[],
  coverageRecords: InsuranceDoc[]
): PayerSummary[] {
  const payerSource = new Map<string, string>();

  payers.forEach((payer) => {
    payerSource.set(
      payerName(payer).toLowerCase(),
      readString(payer.source) || "insurance"
    );
  });

  const groups = new Map<string, PayerSummary & { patientIds: Set<string> }>();

  coverageRecords.forEach((record) => {
    const name = payerName(record);
    const key = name.toLowerCase();
    const current =
      groups.get(key) ??
      ({
        payerName: name,
        coverageCount: 0,
        patientCount: 0,
        activeCount: 0,
        issueCount: 0,
        source: readString(record.source) || payerSource.get(key) || "insuranceRecords",
        patientIds: new Set<string>(),
      } satisfies PayerSummary & { patientIds: Set<string> });

    current.coverageCount += 1;
    current.patientIds.add(patientKey(record));
    if (readStatus(record) === "active") current.activeCount += 1;
    if (isCoverageIssue(record)) current.issueCount += 1;

    groups.set(key, current);
  });

  payers.forEach((payer) => {
    const name = payerName(payer);
    const key = name.toLowerCase();
    if (groups.has(key)) return;

    groups.set(key, {
      payerName: name,
      coverageCount: 0,
      patientCount: 0,
      activeCount: 0,
      issueCount: isCoverageIssue(payer) ? 1 : 0,
      source: readString(payer.source) || "insurance",
      patientIds: new Set<string>(),
    });
  });

  return Array.from(groups.values())
    .map(({ patientIds, ...summary }) => ({
      ...summary,
      patientCount: patientIds.size,
    }))
    .sort(
      (a, b) =>
        b.issueCount - a.issueCount ||
        b.coverageCount - a.coverageCount ||
        a.payerName.localeCompare(b.payerName)
    );
}

export default function InsuranceReportPage() {
  const bridge = useInsuranceBridge();
  const [jarvisInsuranceScanLoading, setJarvisInsuranceScanLoading] =
    useState(false);
  const [jarvisInsuranceScanAnswer, setJarvisInsuranceScanAnswer] =
    useState("");
  const [jarvisInsuranceScanError, setJarvisInsuranceScanError] = useState("");
  const [selectedPayerReportName, setSelectedPayerReportName] = useState("");

  const payerSummaries = useMemo(
    () => buildPayerSummaries(bridge.payers, bridge.coverageRecords),
    [bridge.coverageRecords, bridge.payers]
  );

  const openQueueItems = useMemo(
    () =>
      [...bridge.queueItems, ...bridge.authorizations]
        .filter(isOpenQueueRecord)
        .sort((a, b) => getDateValue(a).localeCompare(getDateValue(b)))
        .slice(0, 10),
    [bridge.authorizations, bridge.queueItems]
  );

  const coverageIssues = useMemo(
    () => bridge.coverageRecords.filter(isCoverageIssue),
    [bridge.coverageRecords]
  );

  const documentationGaps = useMemo(
    () =>
      [...bridge.queueItems, ...bridge.authorizations].filter(
        hasDocumentationGap
      ),
    [bridge.authorizations, bridge.queueItems]
  );

  const selectedPayerReport = useMemo(
    () =>
      selectedPayerReportName
        ? buildPayerIssueReport(selectedPayerReportName, bridge)
        : null,
    [bridge, selectedPayerReportName]
  );

  const readinessItems = [
    {
      label: "Payer Records",
      value: bridge.payers.length.toLocaleString(),
      detail: "Fed by insurance master, patient profile, and rental imports.",
      tone: "info",
      href: "#insurance-bridge-table",
      actionLabel: "View Payer Records",
    },
    {
      label: "Coverage Records",
      value: bridge.coverageRecords.length.toLocaleString(),
      detail: "Patient coverage rows written by the same insurance file routes.",
      tone: "success",
      href: "#insurance-bridge-table",
      actionLabel: "View Coverage Records",
    },
    {
      label: "Pending Authorizations",
      value: openQueueItems.length.toLocaleString(),
      detail: "Open PAR and insurance queue records needing follow-up.",
      tone: openQueueItems.length ? "warning" : "success",
      href: "#insurance-queue-issues",
      actionLabel: "View Authorizations",
    },
    {
      label: "Coverage Issues",
      value: coverageIssues.length.toLocaleString(),
      detail: "Inactive, unknown, missing, expired, or denied coverage flags.",
      tone: coverageIssues.length ? "danger" : "success",
      href: "#insurance-bridge-table",
      actionLabel: "View Coverage Issues",
    },
    {
      label: "Missing Documentation",
      value: documentationGaps.length.toLocaleString(),
      detail: "CMN, note, missing-document, and support-file queue signals.",
      tone: documentationGaps.length ? "warning" : "success",
      href: "#insurance-queue-issues",
      actionLabel: "View Missing Docs",
    },
  ];

  const focusAreas = [
    {
      label: "Payer Records",
      value: bridge.payers.length,
      description:
        "Insurance company and payer master rows from insurance uploads.",
      icon: WalletCards,
      tone: "info",
      href: "#insurance-bridge-table",
      actionLabel: "View Payers",
    },
    {
      label: "Authorization Issues",
      value: openQueueItems.length,
      description:
        "Open insurance queue and patient authorization records from PAR routes.",
      icon: AlertTriangle,
      tone: openQueueItems.length ? "warning" : "success",
      href: "#insurance-queue-issues",
      actionLabel: "View Issues",
    },
    {
      label: "Coverage Verification",
      value: coverageIssues.length,
      description:
        "Coverage records requiring verification or payer cleanup.",
      icon: BadgeCheck,
      tone: coverageIssues.length ? "danger" : "success",
      href: "#insurance-bridge-table",
      actionLabel: "Verify Coverage",
    },
    {
      label: "Insurance Patients",
      value: bridge.insurancePatients.length,
      description:
        "Patient-level insurance bridge records created by upload processors.",
      icon: ClipboardCheck,
      tone: "success",
      href: "#insurance-bridge-table",
      actionLabel: "View Patients",
    },
  ];

  function metricButtonTone(tone: string): string {
    if (tone === "danger") return "text-red-300";
    if (tone === "warning") return "text-amber-200";
    if (tone === "success") return "text-emerald-300";
    return "text-sky-300";
  }

  async function handleRunInsuranceWebScan() {
    if (jarvisInsuranceScanLoading) return;

    setJarvisInsuranceScanLoading(true);
    setJarvisInsuranceScanError("");

    try {
      const result = await askAdminAi({
        prompt:
          "Insurance web scan: search reliable internet sources for current insurance changes, payer updates, DME/HME authorization requirements, prior authorization changes, documentation requirements, and billing requirements. Prioritize CMS, Medicare, Medicaid, DME MACs, state Medicaid programs, and official payer provider policy pages. Return source organization, topic, change or requirement, effective date if visible, billing or authorization impact, direct URL, date checked, and what staff should verify before changing workflow.",
      });

      setJarvisInsuranceScanAnswer(
        result.data.answer?.trim() || "Jarvis did not return a scan result."
      );
    } catch (error) {
      console.error("INSURANCE JARVIS WEB SCAN ERROR:", error);
      setJarvisInsuranceScanError(
        error instanceof Error
          ? error.message
          : "Jarvis insurance web scan failed."
      );
    } finally {
      setJarvisInsuranceScanLoading(false);
    }
  }

  function handleDownloadPayerReport(report: PayerIssueReport) {
    const safeName = report.payerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "payer";
    const blob = new Blob([buildReportText(report)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `insurance-bridge-${safeName}-issues.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} aria-hidden="true" />

      <div className={`${glass.shell} relative z-10`}>
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={badges.neutral}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Insurance Oversight
              </div>

              <h1 className={`${typography.pageTitle} mt-4`}>
                Insurance Reports
              </h1>

              <p className={`mt-3 max-w-3xl ${typography.body}`}>
                Live bridge for insurance uploads, payer records, coverage
                rows, authorization queues, and protected follow-up work.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <OpenUploadCenterButton
                reportType="insurance"
                label="Upload Insurance Report"
              />

              <a href="/reports/upload" className={buttons.secondary}>
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Upload Center
              </a>
            </div>
          </div>
        </section>

        {bridge.error ? (
          <section className={glass.alertWarning}>{bridge.error}</section>
        ) : null}

        <section
          aria-label="Insurance readiness summary"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {readinessItems.map((item) => (
            <article key={item.label} className={`${glass.card} p-5`}>
              <div className="flex min-w-0 items-start justify-between gap-4">
                <p className={`${typography.caption} min-w-0 break-words`}>
                  {item.label}
                </p>

                <a
                  href={item.href}
                  aria-label={`${item.actionLabel}: ${item.value}`}
                  className={`${buttons.secondary} shrink-0 whitespace-nowrap px-3 py-2 text-xs`}
                >
                  <span className={`tabular-nums ${metricButtonTone(item.tone)}`}>
                    {item.value}
                  </span>
                  <span>{item.actionLabel}</span>
                </a>
              </div>

              <p className={`mt-4 ${typography.bodyMuted}`}>{item.detail}</p>
            </article>
          ))}
        </section>

        <section
          aria-label="Insurance bridge focus areas"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {focusAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article key={area.label} className={`${glass.card} p-5`}>
                <div className={glass.iconBox}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <h2 className={typography.bodyStrong}>
                    {area.label}
                  </h2>

                  <a
                    href={area.href}
                    aria-label={`${area.actionLabel}: ${area.value.toLocaleString()}`}
                    className={`${buttons.secondary} shrink-0 whitespace-nowrap px-3 py-2 text-xs`}
                  >
                    <span className={`tabular-nums ${metricButtonTone(area.tone)}`}>
                      {area.value.toLocaleString()}
                    </span>
                    <span>{area.actionLabel}</span>
                  </a>
                </div>

                <p className={`mt-2 ${typography.bodyMuted}`}>
                  {area.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className={badges.info}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Jarvis Insurance Intelligence
              </div>

              <h2 className={`${typography.sectionTitle} mt-4`}>
                Insurance Change Scan
              </h2>

              <p className={`mt-2 max-w-4xl ${typography.bodyMuted}`}>
                Ask Jarvis to search reliable internet sources for payer
                updates, insurance changes, authorization requirements,
                documentation requirements, and billing requirements for DME/HME
                workflows.
              </p>
            </div>

            <button
              type="button"
              className={buttons.primary}
              onClick={() => void handleRunInsuranceWebScan()}
              disabled={jarvisInsuranceScanLoading}
            >
              {jarvisInsuranceScanLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileSearch className="h-4 w-4" aria-hidden="true" />
              )}
              Scan Insurance Updates
            </button>
          </div>

          {jarvisInsuranceScanError ? (
            <div className={`${glass.alertWarning} mt-5`}>
              {jarvisInsuranceScanError}
            </div>
          ) : null}

          {jarvisInsuranceScanAnswer ? (
            <div className={`${glass.insetPadded} mt-5`}>
              <h3 className={typography.subTitle}>Jarvis Scan Results</h3>
              <pre
                className={`mt-3 whitespace-pre-wrap break-words font-sans ${typography.bodyMuted}`}
              >
                {jarvisInsuranceScanAnswer}
              </pre>
            </div>
          ) : (
            <div className={`${glass.insetPadded} mt-5 ${typography.bodyMuted}`}>
              Results will appear here with source links and human verification
              steps after Jarvis completes the scan.
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <article className={glass.panel}>
            <div className="relative z-10 p-6">
              <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={glass.iconBox}>
                      <FileSearch className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                      <h2 id="insurance-bridge-table" className={typography.sectionTitle}>
                        Insurance Upload Bridge
                      </h2>
                      <p className={typography.bodyMuted}>
                        Reading from insurance, insuranceRecords,
                        insurancePatients, insuranceQueue, and
                        patientAuthorizations.
                      </p>
                    </div>
                  </div>
                </div>

                {bridge.loading ? (
                  <div className={`${badges.neutral} shrink-0`}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading
                  </div>
                ) : (
                  <div className={`${badges.success} shrink-0`}>Live</div>
                )}
              </div>

              <div className={tables.wrapper}>
                <div className="max-h-[520px] overflow-auto">
                  <table className={tables.table}>
                    <thead className={tables.head}>
                      <tr>
                        <th className={tables.headCell}>Payer</th>
                        <th className={tables.headCell}>Coverage</th>
                        <th className={tables.headCell}>Patients</th>
                        <th className={tables.headCell}>Active</th>
                        <th className={tables.headCell}>Issues</th>
                        <th className={tables.headCell}>Source</th>
                        <th className={tables.headCell}>Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payerSummaries.length === 0 ? (
                        <tr className={tables.row}>
                          <td className={tables.cell} colSpan={7}>
                            No insurance bridge rows loaded yet.
                          </td>
                        </tr>
                      ) : (
                        payerSummaries.slice(0, 60).map((payer) => (
                          <tr key={payer.payerName} className={tables.row}>
                            <td className={tables.cell}>
                              <span className={typography.bodyStrong}>
                                {payer.payerName}
                              </span>
                            </td>
                            <td className={tables.cell}>
                              {payer.coverageCount.toLocaleString()}
                            </td>
                            <td className={tables.cell}>
                              {payer.patientCount.toLocaleString()}
                            </td>
                            <td className={tables.cell}>
                              {payer.activeCount.toLocaleString()}
                            </td>
                            <td className={tables.cell}>
                              <button
                                type="button"
                                className={`${buttons.secondary} px-3 py-2 text-xs`}
                                onClick={() =>
                                  setSelectedPayerReportName(payer.payerName)
                                }
                                aria-label={`Open issue report for ${payer.payerName}: ${payer.issueCount.toLocaleString()} issues`}
                              >
                                <span
                                  className={`tabular-nums ${
                                    payer.issueCount ? "text-amber-200" : "text-emerald-300"
                                  }`}
                                >
                                  {payer.issueCount.toLocaleString()}
                                </span>
                                <span>Open Issues</span>
                              </button>
                            </td>
                            <td className={tables.cell}>{payer.source}</td>
                            <td className={tables.cell}>
                              <button
                                type="button"
                                className={buttons.secondary}
                                onClick={() =>
                                  setSelectedPayerReportName(payer.payerName)
                                }
                              >
                                <FileSearch className="h-4 w-4" aria-hidden="true" />
                                Open report
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedPayerReport ? (
                <div className={`${glass.insetPadded} mt-5`}>
                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className={badges.info}>
                        <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                        Payer Issue Report
                      </div>
                      <h3 className={`${typography.sectionTitle} mt-3`}>
                        {selectedPayerReport.payerName}
                      </h3>
                      <p className={`mt-2 ${typography.bodyMuted}`}>
                        Built from insuranceRecords, insurancePatients,
                        insuranceQueue, and patientAuthorizations. Patient
                        identifiers stay out of this operational report.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={buttons.primary}
                      onClick={() => handleDownloadPayerReport(selectedPayerReport)}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download Report
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {[
                      ["Coverage", selectedPayerReport.coverageRecords.length],
                      ["Patients", selectedPayerReport.insurancePatients.length],
                      ["Queue", selectedPayerReport.queueItems.length],
                      ["Authorizations", selectedPayerReport.authorizations.length],
                      ["Issues", selectedPayerReport.issues.length],
                    ].map(([label, value]) => (
                      <div key={label} className={glass.card}>
                        <div className="p-4">
                          <p className={typography.caption}>{label}</p>
                          <p className={`${typography.metricCompact} mt-2`}>
                            {Number(value).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-3">
                    {selectedPayerReport.issues.length === 0 ? (
                      <div className={`${glass.emptyState} text-center`}>
                        No open issues found for this insurance company in the
                        loaded bridge sample.
                      </div>
                    ) : (
                      selectedPayerReport.issues.map((issue, index) => (
                        <article
                          key={`${issue.source}-${issue.title}-${issue.date}-${index}`}
                          className={glass.card}
                        >
                          <div className="p-4">
                            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <h4 className={typography.bodyStrong}>
                                  {issue.title}
                                </h4>
                                <p className={`mt-2 ${typography.smallMuted}`}>
                                  {[issue.source, issue.status, issue.date]
                                    .filter(Boolean)
                                    .join(" | ")}
                                </p>
                              </div>

                              <span
                                className={
                                  issue.severity === "error"
                                    ? badges.danger
                                    : issue.severity === "warning"
                                      ? badges.warning
                                      : badges.info
                                }
                              >
                                {issue.severity}
                              </span>
                            </div>

                            <div className={`${glass.insetPadded} mt-4`}>
                              <p className={typography.caption}>Direct Fix</p>
                              <p className={`mt-2 ${typography.bodyMuted}`}>
                                {issue.instruction}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </article>

          <article className={glass.panel}>
            <div className="relative z-10 p-6">
              <div className="mb-4 flex min-w-0 items-center gap-3">
                <div className={glass.iconBox}>
                  <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <h2 id="insurance-queue-issues" className={typography.sectionTitle}>Queue Feed</h2>
                  <p className={typography.bodyMuted}>
                    Insurance follow-up from upload-created queues.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {openQueueItems.length === 0 ? (
                  <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                    No open insurance queue items in the loaded bridge sample.
                  </div>
                ) : (
                  openQueueItems.map((item, index) => (
                    <div
                      key={`${item.id}-${readString(item.sourceReport)}-${index}`}
                      className={`${glass.insetPadded} ${typography.body}`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <span className={`min-w-0 break-words ${typography.bodyStrong}`}>
                          {readString(item.issue) ||
                            readString(item.queueType) ||
                            "Insurance review"}
                        </span>
                        <ArrowRight
                          className={`h-4 w-4 shrink-0 ${typography.smallMuted}`}
                          aria-hidden="true"
                        />
                      </div>

                      <p className={`mt-2 ${typography.smallMuted}`}>
                        {[payerName(item), readStatus(item), getDateValue(item)]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className={`${glass.card} mt-5 p-4`}>
                <div className="flex min-w-0 items-start gap-3">
                  <div className={glass.iconBox}>
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h3 className={typography.subTitle}>PHI display rule</h3>

                    <p className={`mt-1 ${typography.bodyMuted}`}>
                      This bridge shows payer and operational status only. Full
                      policy numbers, member IDs, DOBs, and patient identifiers
                      stay behind protected patient detail views.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
