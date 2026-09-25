import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";

import type {
  AskAdminAiResponse,
  FocusArea,
  InsuranceDoc,
  InsuranceBridgeState,
  PayerIssue,
  PayerIssueReport,
  PayerSummary,
  ReadinessItem,
} from "../types";

export const COLLECTION_LIMIT = 300;

export const initialBridgeState: InsuranceBridgeState = {
  payers: [],
  coverageRecords: [],
  insurancePatients: [],
  queueItems: [],
  authorizations: [],
  loading: true,
  error: "",
};

export const askAdminAi = httpsCallable<{ prompt: string }, AskAdminAiResponse>(
  functions,
  "askAdminAi"
);

export function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function readStatus(record: InsuranceDoc): string {
  return (
    readString(record.status) ||
    readString(record.insuranceStatus) ||
    readString(record.parStatus) ||
    "unknown"
  ).toLowerCase();
}

export function payerName(record: InsuranceDoc): string {
  return (
    readString(record.insuranceName) ||
    readString(record.payerName) ||
    readString(record.insurance) ||
    readString(record.primaryInsurance) ||
    "Unknown payer"
  );
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function patientKey(record: InsuranceDoc): string {
  return (
    readString(record.patientKey) ||
    readString(record.patientId) ||
    readString(record.patientName) ||
    readString(record.id)
  );
}

export function recordMatchesPayer(
  record: InsuranceDoc,
  targetPayer: string
): boolean {
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
    .some(
      (value) =>
        value === target || value.includes(target) || target.includes(value)
    );
}

export function isClosedStatus(status: string): boolean {
  return [
    "closed",
    "complete",
    "completed",
    "done",
    "resolved",
    "inactive",
  ].includes(status);
}

export function isCoverageIssue(record: InsuranceDoc): boolean {
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

export function isOpenQueueRecord(record: InsuranceDoc): boolean {
  return !isClosedStatus(readStatus(record));
}

export function hasDocumentationGap(record: InsuranceDoc): boolean {
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

export function getDateValue(record: InsuranceDoc): string {
  return (
    readString(record.dueDate) ||
    readString(record.parExpiration) ||
    readString(record.updatedAt) ||
    readString(record.createdAt)
  );
}

export function instructionForRecord(
  record: InsuranceDoc,
  source: string
): string {
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

  if (
    text.includes("auth") ||
    text.includes("par") ||
    source.includes("authorization")
  ) {
    return "Check payer prior authorization requirements for the ordered HCPCS, attach required clinical/order documentation, submit or refresh the PAR, and record the approval number and expiration date.";
  }

  if (
    text.includes("cmn") ||
    text.includes("document") ||
    text.includes("missing") ||
    text.includes("support")
  ) {
    return "Collect the missing CMN, order, chart note, or support file, attach it to the patient record, then rerun the insurance queue check before billing.";
  }

  return "Review this payer record against the upload source, verify eligibility and billing requirements, update the bridge data, and document the staff action taken.";
}

export function issueTitle(record: InsuranceDoc, fallback: string): string {
  return (
    readString(record.issue) ||
    readString(record.queueType) ||
    readString(record.message) ||
    readString(record.status) ||
    fallback
  );
}

export function buildPayerIssueReport(
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
    .map(
      (record): PayerIssue => ({
        title: issueTitle(record, "Coverage verification issue"),
        source: "insuranceRecords",
        status: readStatus(record),
        severity: readStatus(record) === "denied" ? "error" : "warning",
        instruction: instructionForRecord(record, "insuranceRecords"),
        date: getDateValue(record),
      })
    );

  const queueIssues = [...queueItems, ...authorizations]
    .filter(isOpenQueueRecord)
    .map(
      (record): PayerIssue => ({
        title: issueTitle(record, "Open insurance follow-up"),
        source: queueItems.includes(record)
          ? "insuranceQueue"
          : "patientAuthorizations",
        status: readStatus(record),
        severity: readStatus(record) === "denied" ? "error" : "warning",
        instruction: instructionForRecord(
          record,
          queueItems.includes(record)
            ? "insuranceQueue"
            : "patientAuthorizations"
        ),
        date: getDateValue(record),
      })
    );

  const documentationIssues = [...queueItems, ...authorizations]
    .filter(hasDocumentationGap)
    .map(
      (record): PayerIssue => ({
        title: issueTitle(record, "Documentation gap"),
        source: queueItems.includes(record)
          ? "insuranceQueue"
          : "patientAuthorizations",
        status: readStatus(record),
        severity: "warning",
        instruction: instructionForRecord(
          record,
          queueItems.includes(record)
            ? "insuranceQueue"
            : "patientAuthorizations"
        ),
        date: getDateValue(record),
      })
    );

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

export function buildReportText(report: PayerIssueReport): string {
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
    lines.push(
      "- No open issues were found in the loaded insurance bridge sample."
    );
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

export function buildPayerSummaries(
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

  const groups = new Map<
    string,
    PayerSummary & { patientIds: Set<string> }
  >();

  coverageRecords.forEach((record) => {
    const name = payerName(record);
    const key = name.toLowerCase();
    const current = groups.get(key) ?? {
      payerName: name,
      coverageCount: 0,
      patientCount: 0,
      activeCount: 0,
      issueCount: 0,
      source:
        readString(record.source) || payerSource.get(key) || "insuranceRecords",
      patientIds: new Set<string>(),
    };

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

export function metricButtonTone(tone: string): string {
  if (tone === "danger") return "text-red-300";
  if (tone === "warning") return "text-amber-200";
  if (tone === "success") return "text-emerald-300";
  return "text-sky-300";
}

export function buildReadinessItems(
  payersCount: number,
  coverageRecordsCount: number,
  openQueueItemsCount: number,
  coverageIssuesCount: number,
  documentationGapsCount: number
): ReadinessItem[] {
  return [
    {
      label: "Payer Records",
      value: payersCount.toLocaleString(),
      detail:
        "Fed by insurance master, patient profile, and rental imports.",
      tone: "info",
      href: "#insurance-bridge-table",
      actionLabel: "View Payer Records",
    },
    {
      label: "Coverage Records",
      value: coverageRecordsCount.toLocaleString(),
      detail:
        "Patient coverage rows written by the same insurance file routes.",
      tone: "success",
      href: "#insurance-bridge-table",
      actionLabel: "View Coverage Records",
    },
    {
      label: "Pending Authorizations",
      value: openQueueItemsCount.toLocaleString(),
      detail:
        "Open PAR and insurance queue records needing follow-up.",
      tone: openQueueItemsCount ? "warning" : "success",
      href: "#insurance-queue-issues",
      actionLabel: "View Authorizations",
    },
    {
      label: "Coverage Issues",
      value: coverageIssuesCount.toLocaleString(),
      detail:
        "Inactive, unknown, missing, expired, or denied coverage flags.",
      tone: coverageIssuesCount ? "danger" : "success",
      href: "#insurance-bridge-table",
      actionLabel: "View Coverage Issues",
    },
    {
      label: "Missing Documentation",
      value: documentationGapsCount.toLocaleString(),
      detail:
        "CMN, note, missing-document, and support-file queue signals.",
      tone: documentationGapsCount ? "warning" : "success",
      href: "#insurance-queue-issues",
      actionLabel: "View Missing Docs",
    },
  ];
}

export function buildFocusAreas(
  payersCount: number,
  insurancePatientsCount: number,
  openQueueItemsCount: number,
  coverageIssuesCount: number
): FocusArea[] {
  return [
    {
      label: "Payer Records",
      value: payersCount,
      description:
        "Insurance company and payer master rows from insurance uploads.",
      href: "#insurance-bridge-table",
      actionLabel: "View Payers",
      tone: "info",
    },
    {
      label: "Authorization Issues",
      value: openQueueItemsCount,
      description:
        "Open insurance queue and patient authorization records from PAR routes.",
      href: "#insurance-queue-issues",
      actionLabel: "View Issues",
      tone: openQueueItemsCount ? "warning" : "success",
    },
    {
      label: "Coverage Verification",
      value: coverageIssuesCount,
      description:
        "Coverage records requiring verification or payer cleanup.",
      href: "#insurance-bridge-table",
      actionLabel: "Verify Coverage",
      tone: coverageIssuesCount ? "danger" : "success",
    },
    {
      label: "Insurance Patients",
      value: insurancePatientsCount,
      description:
        "Patient-level insurance bridge records created by upload processors.",
      href: "#insurance-bridge-table",
      actionLabel: "View Patients",
      tone: "success",
    },
  ];
}
