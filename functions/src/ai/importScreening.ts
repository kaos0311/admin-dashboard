import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

type JarvisScreeningStatus = "passed" | "review" | "pending" | "failed";

type DestinationCounts = {
  processed?: number;
  written?: number;
  skipped?: number;
  issues?: number;
};

type RouteDestination = {
  collection: string;
  label?: string;
  page?: string;
  required: boolean;
  condition?: string;
};

type LandingAuditEntry = RouteDestination &
  DestinationCounts & {
    status: "landed" | "missing" | "conditional" | "issue";
    message: string;
  };

type ImportScreeningResult = {
  status: JarvisScreeningStatus;
  message: string;
  findings: string[];
  resolvedFindings: string[];
  remainingFindingCount: number;
  recommendations: string[];
  landingAudit: LandingAuditEntry[];
  handoffReport: string;
  checkedAt: FirebaseFirestore.FieldValue;
  checkedBy: "jarvis";
};

type ImportScreeningDraft = Omit<
  ImportScreeningResult,
  "resolvedFindings" | "remainingFindingCount"
>;

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function destinationSummary(
  value: unknown
): Record<string, DestinationCounts> {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, DestinationCounts>
  >((summary, [collectionName, counts]) => {
    if (!counts || typeof counts !== "object") return summary;

    const source = counts as Record<string, unknown>;
    summary[collectionName] = {
      processed: numberValue(source.processed),
      written: numberValue(source.written),
      skipped: numberValue(source.skipped),
      issues: numberValue(source.issues),
    };

    return summary;
  }, {});
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function isConditionalDestination(collectionName: string): boolean {
  return ["hospicePatients", "hcpcsCodes"].includes(collectionName);
}

function routeDestinations(job: Record<string, unknown>): RouteDestination[] {
  const importRoute =
    job.importRoute && typeof job.importRoute === "object"
      ? (job.importRoute as Record<string, unknown>)
      : {};

  return Array.isArray(importRoute.destinations)
    ? importRoute.destinations
        .flatMap((destination): RouteDestination[] => {
          if (!destination || typeof destination !== "object") return [];

          const source = destination as Record<string, unknown>;
          const collection = String(source.collection ?? "").trim();
          if (!collection) return [];

          return [
            {
              collection,
              label: String(source.label ?? "").trim() || undefined,
              page: String(source.page ?? "").trim() || undefined,
              required:
                source.required === false || isConditionalDestination(collection)
                  ? false
                  : true,
              condition: String(source.condition ?? "").trim() || undefined,
            },
          ];
        })
    : [];
}

function expectedCollections(
  job: Record<string, unknown>,
  options: { requiredOnly?: boolean } = {}
): string[] {
  const route = routeDestinations(job);
  const routeCollections = route
    .filter((destination) => !options.requiredOnly || destination.required)
    .map((destination) => destination.collection);

  if (routeCollections.length > 0) {
    return Array.from(new Set(routeCollections));
  }

  const processors = Array.isArray(job.processors)
    ? job.processors.map((item) => String(item))
    : [];
  const kind = String(job.detectedReportKind || job.reportType || "");
  const values = new Set<string>();

  if (processors.includes("patients") || kind === "patients") {
    values.add("patients");
    values.add("patients_index");
  }

  if (processors.includes("hospice") || kind === "hospice") {
    values.add("hospicePatients");
  }

  if (processors.includes("orders") || kind === "orders") {
    values.add("orders");
  }

  const shopMap: Record<string, string[]> = {
    active_rentals: [
      "rentals",
      "patients",
      "patients_index",
      "hospicePatients",
      "products",
      "inventory",
      "insurance",
      "insuranceRecords",
      "patientPhysicians",
      "rolodexContacts",
    ],
    patient_profile_enrichment: [
      "patients",
      "patients_index",
      "hospicePatients",
      "insurance",
      "insuranceRecords",
    ],
    patient_demographics: ["patients", "patients_index"],
    patient_contact: ["patients", "patients_index"],
    patient_physicians: ["patients", "patients_index", "patientPhysicians"],
    patient_referrals: ["patients", "patients_index", "patientReferrals"],
    hospice_clinical_status: ["hospicePatients", "patients", "patients_index"],
    item_detail: ["products", "shopItems"],
    lot_numbers: ["inventory", "shopInventoryLots"],
    serial_number_availability: ["inventory", "shopInventorySerials"],
    insurance: ["insurance", "insuranceRecords"],
    par_report: ["patientAuthorizations", "insuranceQueue", "patients", "patients_index"],
    work_in_progress: ["wipRecords", "patients"],
    gl_account_groups: ["shopGlAccountGroups"],
    gl_detail: ["shopGlDetails"],
    cost_of_goods_sold: ["shopCostOfGoodsSold"],
  };

  for (const collectionName of shopMap[kind] ?? []) {
    values.add(collectionName);
  }

  return Array.from(values);
}

function labelForCollection(collectionName: string): string {
  return collectionName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildLandingAudit(
  job: Record<string, unknown>,
  destinations: Record<string, DestinationCounts>,
  expectedWrittenRows: number
): LandingAuditEntry[] {
  const route = routeDestinations(job);
  const routeCollections = new Set(route.map((destination) => destination.collection));
  const expectedFallback = expectedCollections(job).map<RouteDestination>(
    (collection) => ({
      collection,
      label: labelForCollection(collection),
      required: !isConditionalDestination(collection),
    })
  );
  const checks = route.length > 0 ? route : expectedFallback;
  const summaryOnly = Object.keys(destinations)
    .filter((collection) => !routeCollections.has(collection))
    .map<RouteDestination>((collection) => ({
      collection,
      label: labelForCollection(collection),
      required: !isConditionalDestination(collection),
      condition: "Destination was recorded by the processor.",
    }));

  return [...checks, ...summaryOnly].map((destination) => {
    const counts = destinations[destination.collection] ?? {};
    const written = numberValue(counts.written);
    const processed = numberValue(counts.processed);
    const skipped = numberValue(counts.skipped);
    const issues = numberValue(counts.issues);
    const missingRequired = destination.required && written <= 0;
    const underFilled =
      destination.required &&
      expectedWrittenRows > 0 &&
      written > 0 &&
      written < expectedWrittenRows;
    const status =
      issues > 0
        ? "issue"
        : missingRequired || underFilled
          ? "missing"
          : written > 0
            ? "landed"
            : "conditional";
    const message =
      status === "landed"
        ? `${destination.label || destination.collection} received ${written.toLocaleString()} write(s).`
        : status === "issue"
          ? `${destination.label || destination.collection} recorded ${issues.toLocaleString()} issue(s).`
          : status === "missing"
            ? underFilled
              ? `${destination.label || destination.collection} received fewer writes than expected.`
              : `${destination.label || destination.collection} did not confirm any database writes.`
            : destination.condition ||
              `${destination.label || destination.collection} is conditional for this report.`;

    return {
      processed,
      written,
      skipped,
      issues,
      status,
      message,
      collection: destination.collection,
      required: destination.required,
      ...(destination.label ? { label: destination.label } : {}),
      ...(destination.page ? { page: destination.page } : {}),
      ...(destination.condition ? { condition: destination.condition } : {}),
    };
  });
}

function reportValue(value: unknown, fallback = "Unknown"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildHandoffReport(
  job: Record<string, unknown>,
  screening: ImportScreeningDraft
): string {
  const importRoute =
    job.importRoute && typeof job.importRoute === "object"
      ? (job.importRoute as Record<string, unknown>)
      : {};
  const headerValidation =
    job.headerValidation && typeof job.headerValidation === "object"
      ? (job.headerValidation as Record<string, unknown>)
      : {};
  const matchedHeaders = stringArray(headerValidation.matchedRequiredLabels);
  const missingHeaders = stringArray(headerValidation.missingRequiredLabels);
  const fileName = reportValue(job.fileName || job.originalName || job.originalFileName);
  const importId = reportValue(job.importId || job.id);
  const detectedKind = reportValue(
    job.detectedReportKind || importRoute.detectedKind || job.reportType
  );
  const detectedLabel = reportValue(
    job.detectedReportLabel || importRoute.detectedLabel
  );
  const totalRows = numberValue(job.totalRows);
  const processedRows = numberValue(job.processedRows || job.rowsProcessed);
  const writtenRows = numberValue(job.writtenRows || job.rowsWritten);
  const skippedRows = numberValue(job.skippedRows || job.rowsSkipped);
  const issueCount = numberValue(job.issueCount);
  const queueFailures =
    numberValue(job.failedQueueJobs) + numberValue(job.deadLetteredQueueJobs);
  const destinationLines = screening.landingAudit.length
    ? screening.landingAudit.map((destination) =>
        `- ${destination.label || destination.collection} (${destination.collection}) -> ${destination.status.toUpperCase()}: ${numberValue(destination.written).toLocaleString()} written, ${numberValue(destination.processed).toLocaleString()} processed, ${numberValue(destination.skipped).toLocaleString()} skipped, ${numberValue(destination.issues).toLocaleString()} issues. ${destination.message}`
      )
    : ["- No destination audit was available."];
  const findingLines = screening.findings.length
    ? screening.findings.map((finding) => `- ${finding}`)
    : ["- None. Jarvis did not find a blocking problem."];
  const recommendationLines = screening.recommendations.length
    ? screening.recommendations.map((recommendation, index) => `${index + 1}. ${recommendation}`)
    : ["1. No correction needed."];
  const matchedLine = matchedHeaders.length ? matchedHeaders.join(", ") : "None recorded";
  const missingLine = missingHeaders.length ? missingHeaders.join(", ") : "None";

  return [
    "JARVIS IMPORT HANDOFF REPORT",
    `File: ${fileName}`,
    `Import ID: ${importId}`,
    `Status: ${screening.status.toUpperCase()}`,
    `Message: ${screening.message}`,
    `Detected Report: ${detectedLabel} (${detectedKind})`,
    "",
    "Row Counts",
    `- Total rows: ${totalRows.toLocaleString()}`,
    `- Processed rows: ${processedRows.toLocaleString()}`,
    `- Written rows: ${writtenRows.toLocaleString()}`,
    `- Skipped rows: ${skippedRows.toLocaleString()}`,
    `- Import issues: ${issueCount.toLocaleString()}`,
    `- Failed queue chunks: ${queueFailures.toLocaleString()}`,
    "",
    "Header Check",
    `- Matched required header groups: ${matchedLine}`,
    `- Missing required header groups: ${missingLine}`,
    "",
    "Destination Audit",
    ...destinationLines,
    "",
    "What Failed Or Needs Review",
    ...findingLines,
    "",
    "Shortest Fix Path",
    ...recommendationLines,
    "",
    "Paste this full report into Codex if the shortest fix path needs code or pipeline repair.",
  ].join("\n");
}

async function countDestinationWrites(
  collectionName: string,
  importId: string
): Promise<number> {
  try {
    const snapshot = await db
      .collection(collectionName)
      .where("lastImportId", "==", importId)
      .count()
      .get();

    return snapshot.data().count;
  } catch {
    return 0;
  }
}

async function backfillDestinationSummary(
  importId: string,
  job: Record<string, unknown>
): Promise<Record<string, DestinationCounts>> {
  const currentSummary = destinationSummary(job.destinationSummary);
  const currentWritten = Object.values(currentSummary).reduce(
    (sum, counts) => sum + numberValue(counts.written),
    0
  );
  const writtenRows = numberValue(job.writtenRows || job.rowsWritten);

  if (currentWritten > 0 || writtenRows <= 0) return currentSummary;

  const totalRows = numberValue(job.totalRows);
  const collections = expectedCollections(job);
  const entries = await Promise.all(
    collections.map(async (collectionName) => ({
      collectionName,
      written: await countDestinationWrites(collectionName, importId),
    }))
  );
  const repairedSummary = entries.reduce<Record<string, DestinationCounts>>(
    (summary, entry) => {
      summary[entry.collectionName] = {
        processed: totalRows,
        written: entry.written,
        skipped: 0,
        issues: 0,
      };

      return summary;
    },
    {}
  );
  const repairedWritten = Object.values(repairedSummary).reduce(
    (sum, counts) => sum + numberValue(counts.written),
    0
  );

  return repairedWritten > 0 ? repairedSummary : currentSummary;
}

export function evaluateImportJobForJarvis(
  job: Record<string, unknown>
): ImportScreeningDraft {
  const status = String(job.status || "unknown");
  const totalRows = numberValue(job.totalRows);
  const processedRows = numberValue(job.processedRows || job.rowsProcessed);
  const writtenRows = numberValue(job.writtenRows || job.rowsWritten);
  const skippedRows = numberValue(job.skippedRows || job.rowsSkipped);
  const issueCount = numberValue(job.issueCount);
  const failedQueueJobs = numberValue(job.failedQueueJobs);
  const deadLetteredQueueJobs = numberValue(job.deadLetteredQueueJobs);
  const destinations = destinationSummary(job.destinationSummary);
  const headerValidation =
    job.headerValidation && typeof job.headerValidation === "object"
      ? (job.headerValidation as Record<string, unknown>)
      : {};
  const missingRequiredHeaders = stringArray(
    headerValidation.missingRequiredLabels
  );
  const missingHeaderExamples = stringArray(headerValidation.missingHeaders);
  const destinationEntries = Object.keys(destinations);
  const destinationWritten = Object.values(destinations).reduce(
    (sum, counts) => sum + numberValue(counts.written),
    0
  );
  const destinationIssues = Object.values(destinations).reduce(
    (sum, counts) => sum + numberValue(counts.issues),
    0
  );
  const landingAudit = buildLandingAudit(job, destinations, writtenRows);
  const missingDestinations = landingAudit.filter(
    (destination) =>
      destination.required &&
      (destination.status === "missing" || destination.status === "issue")
  );
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (status === "failed") {
    findings.push("Import job is marked failed.");
    recommendations.push("Open the tracker, review failed queue chunks, and reprocess the report after correcting the source file or mapping.");
  }

  if (failedQueueJobs > 0 || deadLetteredQueueJobs > 0) {
    findings.push(`${failedQueueJobs + deadLetteredQueueJobs} queue chunk(s) failed or dead-lettered.`);
    recommendations.push("Refresh or reprocess the import job and inspect worker logs if failures repeat.");
  }

  if (missingRequiredHeaders.length > 0) {
    findings.push(
      `Missing expected header group(s): ${missingRequiredHeaders.join(", ")}.`
    );
    recommendations.push(
      missingHeaderExamples.length > 0
        ? `Confirm the Brightree export includes these headers or approved equivalents: ${missingHeaderExamples.join(", ")}.`
        : "Confirm the Brightree export includes the required headers for this report type."
    );
  }

  if (totalRows > 0 && processedRows < totalRows) {
    findings.push(`Only ${processedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows have been processed.`);
    recommendations.push("Wait for processing to finish or re-run the queue worker if the job appears stuck.");
  }

  if (writtenRows <= 0 && destinationWritten <= 0 && totalRows > 0) {
    findings.push("No database writes were confirmed for this report.");
    recommendations.push("Verify report type detection and confirm the Brightree export headers match the supported mappings.");
  }

  if (
    status === "completed" &&
    totalRows > 0 &&
    destinationEntries.length === 0
  ) {
    findings.push("No destination tracker was recorded for this completed report.");
    recommendations.push("Reprocess this report so the pipeline can confirm exactly which database collections received the rows.");
  }

  if (skippedRows > 0) {
    findings.push(`${skippedRows.toLocaleString()} row(s) were skipped.`);
    recommendations.push("Review skipped rows for missing patient, item, order, or payer identifiers.");
  }

  if (issueCount > 0 || destinationIssues > 0) {
    findings.push(`${Math.max(issueCount, destinationIssues).toLocaleString()} issue(s) were flagged during processing.`);
    recommendations.push("Review import issues before trusting downstream reports or dashboards.");
  }

  if (missingDestinations.length > 0) {
    findings.push(
      `Required destination(s) need attention: ${missingDestinations
        .map((destination) => destination.label || destination.collection)
        .join(", ")}.`
    );
    recommendations.push("Use the tracker to confirm each required page received rows, then reprocess if a destination is missing.");
  }

  if (status !== "completed" && status !== "completed_with_errors" && status !== "failed") {
    const draft: ImportScreeningDraft = {
      status: "pending",
      message: "Jarvis is waiting for the import pipeline to finish before passing this report.",
      findings: findings.length ? findings : ["Import is still in progress."],
      recommendations: recommendations.length
        ? recommendations
        : ["Let the processing queue finish, then re-check the Jarvis column."],
      landingAudit,
      handoffReport: "",
      checkedAt: FieldValue.serverTimestamp(),
      checkedBy: "jarvis",
    };

    return {
      ...draft,
      handoffReport: buildHandoffReport(job, draft),
    };
  }

  if (status === "failed" || failedQueueJobs > 0 || deadLetteredQueueJobs > 0) {
    const draft: ImportScreeningDraft = {
      status: "failed",
      message: "Jarvis screening failed because the import pipeline reported failed work.",
      findings,
      recommendations,
      landingAudit,
      handoffReport: "",
      checkedAt: FieldValue.serverTimestamp(),
      checkedBy: "jarvis",
    };

    return {
      ...draft,
      handoffReport: buildHandoffReport(job, draft),
    };
  }

  if (findings.length > 0) {
    const draft: ImportScreeningDraft = {
      status: "review",
      message: "Jarvis recommends review before relying on this report.",
      findings,
      recommendations,
      landingAudit,
      handoffReport: "",
      checkedAt: FieldValue.serverTimestamp(),
      checkedBy: "jarvis",
    };

    return {
      ...draft,
      handoffReport: buildHandoffReport(job, draft),
    };
  }

  const draft: ImportScreeningDraft = {
    status: "passed",
    message: "Jarvis screening passed. The report completed and database writes were confirmed.",
    findings: [],
    recommendations: ["Spot-check the destination page after first-time uploads or new Brightree report formats."],
    landingAudit,
    handoffReport: "",
    checkedAt: FieldValue.serverTimestamp(),
    checkedBy: "jarvis",
  };

  return {
    ...draft,
    handoffReport: buildHandoffReport(job, draft),
  };
}

export async function applyJarvisImportScreening(
  importId: string
): Promise<ImportScreeningResult | null> {
  const jobRef = db.collection("importJobs").doc(importId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) return null;

  const job = jobSnap.data() ?? {};
  const repairedDestinationSummary = await backfillDestinationSummary(
    importId,
    job
  );
  const repairedJob =
    Object.keys(repairedDestinationSummary).length > 0
      ? {
          ...job,
          destinationSummary: repairedDestinationSummary,
        }
      : job;
  const previousScreening =
    job.jarvisScreening && typeof job.jarvisScreening === "object"
      ? (job.jarvisScreening as Record<string, unknown>)
      : {};
  const previousFindings = Array.isArray(previousScreening.findings)
    ? previousScreening.findings.map((item) => String(item)).filter(Boolean)
    : [];
  const previousResolved = Array.isArray(previousScreening.resolvedFindings)
    ? previousScreening.resolvedFindings.map((item) => String(item)).filter(Boolean)
    : [];
  const screeningDraft = evaluateImportJobForJarvis(repairedJob);
  const currentFindingSet = new Set(screeningDraft.findings);
  const resolvedFindings = Array.from(
    new Set([
      ...previousResolved,
      ...previousFindings.filter((finding) => !currentFindingSet.has(finding)),
    ])
  );
  const screening: ImportScreeningResult = {
    ...screeningDraft,
    resolvedFindings,
    remainingFindingCount:
      screeningDraft.status === "passed" ? 0 : screeningDraft.findings.length,
  };

  await Promise.all([
    jobRef.set(
      {
        jarvisScreening: screening,
        ...(repairedJob !== job
          ? { destinationSummary: repairedDestinationSummary }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection("importedReports").doc(importId).set(
      {
        jarvisScreening: screening,
        ...(repairedJob !== job
          ? { destinationSummary: repairedDestinationSummary }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return screening;
}
