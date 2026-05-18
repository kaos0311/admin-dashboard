// functions/src/imports/processors/index.ts

import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

import {
  writeAuditLog,
  type AuditAction,
} from "../../audit/auditLogger.js";

import { db } from "../utils/firestore.js";
import { cleanText } from "../utils/normalize.js";

import { processHospiceRows } from "./hospiceProcessor.js";
import { processOrdersFromRows } from "./orderProcessor.js";
import { processPatientsFromRows } from "./patientProcessor.js";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

export type ReportType = "patients" | "orders" | "hospice" | "unknown";

export type ImportMode = "append" | "overwrite_report_type";

export type ReplaceScope = "none" | "reportType";

export type ProcessorName = "patients" | "orders" | "hospice";

export interface ProcessorInput {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];

  importMode?: ImportMode;
  overwriteExistingData?: boolean;
  replaceScope?: ReplaceScope;
  forceReprocess?: boolean;
  refreshRequested?: boolean;
  reportVersion?: number;
  weeklyBatchKey?: string;
}

export interface ProcessorRunSummary {
  processor: ProcessorName;
  required: boolean;
  skipped: boolean;
  succeeded: boolean;
  failed: boolean;
  durationMs: number;
  message: string;
}

export interface ProcessorPipelineResult {
  importId: string;
  reportType: ReportType;
  originalReportType: string;
  fileName: string;
  rowCount: number;
  selectedProcessors: ProcessorName[];
  summaries: ProcessorRunSummary[];
  failedRequiredProcessor: boolean;
}

interface ProcessorConfig {
  name: ProcessorName;
  shouldRun: boolean;
  required: boolean;
  skipReason?: string;
  run: () => Promise<void>;
}

const PROCESSOR_TIMEOUT_MS = 1000 * 60 * 8;
const ROUTING_SAMPLE_ROW_LIMIT = 50;

function normalizeText(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function rowHasHospiceMarker(row: ParsedImportRow): boolean {
  return Object.values(row.data ?? {}).some((value) =>
    cleanText(value).includes("*"),
  );
}

function detectHospiceByMarker(rows: ParsedImportRow[]): boolean {
  return rows.some(rowHasHospiceMarker);
}

function buildSearchText(input: ProcessorInput): string {
  const rowText = input.rows
    .slice(0, ROUTING_SAMPLE_ROW_LIMIT)
    .flatMap((row) => {
      const data = row.data ?? {};

      return [
        ...Object.keys(data),
        ...Object.values(data).map(normalizeText),
      ];
    })
    .join(" ");

  return [
    input.reportType,
    input.fileName,
    input.storagePath,
    rowText,
  ]
    .map(normalizeText)
    .join(" ");
}

function detectOrders(searchText: string): boolean {
  const orderKeywords = [
    "sales order",
    "sales_order",
    "sales order number",
    "order number",
    "order_number",
    "so number",
    "so_number",
    "invoice",
    "invoice number",
    "invoice_number",
    "hcpcs",
    "quantity",
    "qty",
    "balance",
    "charge",
    "item",
    "product",
  ];

  return orderKeywords.some((keyword) => searchText.includes(keyword));
}

function determineReportType(input: ProcessorInput): ReportType {
  const explicitReportType = normalizeText(input.reportType)
    .replace(/[\s-]+/g, "_");

  if (
    explicitReportType === "hospice" ||
    explicitReportType === "patients" ||
    explicitReportType === "orders"
  ) {
    return explicitReportType;
  }

  const hospiceDetected = detectHospiceByMarker(input.rows);

  if (hospiceDetected) {
    return "hospice";
  }

  const searchText = buildSearchText(input);

  if (detectOrders(searchText)) {
    return "orders";
  }

  return "patients";
}

function getProcessorProgress(processorName: ProcessorName): number {
  switch (processorName) {
    case "patients":
      return 60;
    case "orders":
      return 75;
    case "hospice":
      return 85;
    default:
      return 45;
  }
}

function getProcessorMetadata(input: ProcessorInput): Record<string, unknown> {
  return {
    reportType: input.reportType,
    fileName: input.fileName,
    storagePath: input.storagePath,
    rowCount: input.rows.length,
    importMode: input.importMode ?? "append",
    overwriteExistingData: input.overwriteExistingData === true,
    replaceScope: input.replaceScope ?? "none",
    forceReprocess: input.forceReprocess === true,
    refreshRequested: input.refreshRequested === true,
    reportVersion: input.reportVersion ?? null,
    weeklyBatchKey: input.weeklyBatchKey ?? null,
  };
}

function timeoutAfter(
  ms: number,
  processorName: ProcessorName,
): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);

      reject(
        new Error(
          `Processor "${processorName}" timeout exceeded after ${ms}ms.`,
        ),
      );
    }, ms);
  });
}

async function updateImportJob(
  importId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await db.collection("importJobs").doc(importId).set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function writeProcessorAuditLog(params: {
  action: AuditAction;
  input: ProcessorInput;
  processor?: ProcessorName;
  metadata?: Record<string, unknown>;
  summary: string;
}): Promise<void> {
  const { action, input, processor, metadata = {}, summary } = params;

  await writeAuditLog({
    action,
    actorUid: "system",
    actorEmail: "system",
    targetType: "importJob",
    targetId: input.importId,
    safeSummary: summary,
    metadata: {
      ...getProcessorMetadata(input),
      processor: processor ?? null,
      ...metadata,
    },
  });
}

function buildProcessorConfigs(
  input: ProcessorInput,
  resolvedReportType: ReportType,
): ProcessorConfig[] {
  return [
    {
      name: "patients",
      shouldRun: true,
      required: true,
      run: () => processPatientsFromRows(input),
    },
    {
      name: "orders",
      shouldRun: resolvedReportType === "orders",
      required: false,
      skipReason: "Orders processor not selected.",
      run: () => processOrdersFromRows(input),
    },
    {
      name: "hospice",
      shouldRun: resolvedReportType === "hospice",
      required: false,
      skipReason: "Hospice processor not selected.",
      run: () => processHospiceRows(input),
    },
  ];
}

function buildSkippedSummaries(
  processorConfigs: ProcessorConfig[],
): ProcessorRunSummary[] {
  return processorConfigs
    .filter((processor) => !processor.shouldRun)
    .map((processor) => ({
      processor: processor.name,
      required: processor.required,
      skipped: true,
      succeeded: false,
      failed: false,
      durationMs: 0,
      message: processor.skipReason ?? "Skipped.",
    }));
}

export async function runProcessors(
  input: ProcessorInput,
): Promise<ProcessorPipelineResult> {
  const resolvedReportType = determineReportType(input);

  const processorConfigs = buildProcessorConfigs(input, resolvedReportType);

  const selectedProcessors = processorConfigs.filter(
    (processor) => processor.shouldRun,
  );

  const summaries: ProcessorRunSummary[] =
    buildSkippedSummaries(processorConfigs);

  logger.info("PROCESSORS SELECTED", {
    importId: input.importId,
    originalReportType: input.reportType,
    resolvedReportType,
    selectedProcessors: selectedProcessors.map((processor) => processor.name),
    skippedProcessors: summaries
      .filter((summary) => summary.skipped)
      .map((summary) => ({
        processor: summary.processor,
        message: summary.message,
      })),
  });

  await updateImportJob(input.importId, {
    status: "processing",
    processingStatus: "processors_selected",
    processingStage: "processors_selected",
    originalReportType: input.reportType,
    detectedReportType: resolvedReportType,
    currentProcessor: null,
    failedProcessor: null,
    failedProcessorMessage: null,
    progressPercent: 45,
    selectedProcessors: selectedProcessors.map((processor) => processor.name),
    skippedProcessors: summaries
      .filter((summary) => summary.skipped)
      .map((summary) => ({
        processor: summary.processor,
        message: summary.message,
      })),
    processorHeartbeatAt: FieldValue.serverTimestamp(),
  });

  await writeProcessorAuditLog({
    action: "system_event",
    input,
    summary: "Import processors selected.",
    metadata: {
      originalReportType: input.reportType,
      resolvedReportType,
      selectedProcessors: selectedProcessors.map((processor) => processor.name),
      skippedProcessors: summaries
        .filter((summary) => summary.skipped)
        .map((summary) => ({
          processor: summary.processor,
          message: summary.message,
        })),
    },
  });

  for (const processor of selectedProcessors) {
    const startedAt = Date.now();

    try {
      await updateImportJob(input.importId, {
        status: "processing",
        processingStatus: `running_${processor.name}_processor`,
        processingStage: `running_${processor.name}_processor`,
        currentProcessor: processor.name,
        progressPercent: getProcessorProgress(processor.name),
        processorHeartbeatAt: FieldValue.serverTimestamp(),
      });

      logger.info("PROCESSOR STARTED", {
        importId: input.importId,
        processor: processor.name,
        rowCount: input.rows.length,
      });

      await Promise.race([
        processor.run(),
        timeoutAfter(PROCESSOR_TIMEOUT_MS, processor.name),
      ]);

      const durationMs = Date.now() - startedAt;

      summaries.push({
        processor: processor.name,
        required: processor.required,
        skipped: false,
        succeeded: true,
        failed: false,
        durationMs,
        message: "Completed.",
      });

      logger.info("PROCESSOR COMPLETED", {
        importId: input.importId,
        processor: processor.name,
        durationMs,
      });

      await updateImportJob(input.importId, {
        status: "processing",
        currentProcessor: null,
        lastCompletedProcessor: processor.name,
        processorHeartbeatAt: FieldValue.serverTimestamp(),
        processorSummaries: summaries,
      });

      await writeProcessorAuditLog({
        action: "system_event",
        input,
        processor: processor.name,
        summary: `Processor completed: ${processor.name}`,
        metadata: {
          durationMs,
          resolvedReportType,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      const message =
        error instanceof Error ? error.message : "Unknown processor error.";

      summaries.push({
        processor: processor.name,
        required: processor.required,
        skipped: false,
        succeeded: false,
        failed: true,
        durationMs,
        message,
      });

      logger.error("PROCESSOR FAILED", {
        importId: input.importId,
        processor: processor.name,
        required: processor.required,
        durationMs,
        message,
      });

      await updateImportJob(input.importId, {
        status: "failed",
        processingStatus: "processor_failure",
        processingStage: "processor_failure",
        currentProcessor: null,
        failedProcessor: processor.name,
        failedProcessorMessage: message,
        progressPercent: 100,
        processorHeartbeatAt: FieldValue.serverTimestamp(),
        processorSummaries: summaries,
      });

      await writeProcessorAuditLog({
        action: "import_failed",
        input,
        processor: processor.name,
        summary: `Processor failed: ${processor.name}`,
        metadata: {
          durationMs,
          message,
          resolvedReportType,
          required: processor.required,
        },
      });

      if (processor.required) {
        return {
          importId: input.importId,
          reportType: resolvedReportType,
          originalReportType: input.reportType,
          fileName: input.fileName,
          rowCount: input.rows.length,
          selectedProcessors: selectedProcessors.map((item) => item.name),
          summaries,
          failedRequiredProcessor: true,
        };
      }
    }
  }

  await updateImportJob(input.importId, {
    status: "completed",
    processingStatus: "completed",
    processingStage: "completed",
    currentProcessor: null,
    progressPercent: 100,
    rowsProcessed: input.rows.length,
    processorHeartbeatAt: FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp(),
    processorSummaries: summaries,
  });

  return {
    importId: input.importId,
    reportType: resolvedReportType,
    originalReportType: input.reportType,
    fileName: input.fileName,
    rowCount: input.rows.length,
    selectedProcessors: selectedProcessors.map((item) => item.name),
    summaries,
    failedRequiredProcessor: false,
  };
}