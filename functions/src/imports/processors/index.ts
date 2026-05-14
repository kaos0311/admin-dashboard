// functions/src/imports/processors/index.ts

import { logger } from "firebase-functions";

import { writeAuditLog } from "../../audit/auditLogger.js";

import { processHospiceRows } from "./hospiceProcessor.js";
import { processOrdersFromRows } from "./orderProcessor.js";
import { processPatientsFromRows } from "./patientProcessor.js";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

export interface ProcessorInput {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];
}

type ProcessorName = "patients" | "orders" | "hospice";

type ProcessorConfig = {
  name: ProcessorName;
  shouldRun: boolean;
  required: boolean;
  run: () => Promise<void>;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").toLowerCase().trim();
}

function textContainsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildRowSearchText(rows: ParsedImportRow[], maxRows = 35): string {
  return rows
    .slice(0, maxRows)
    .flatMap((row) => {
      const data = row.data ?? {};

      return [
        ...Object.keys(data),
        ...Object.values(data).map((value) => normalizeText(value)),
      ];
    })
    .join(" ")
    .toLowerCase();
}

function buildSearchText(input: ProcessorInput): string {
  return [
    input.reportType,
    input.fileName,
    input.storagePath,
    buildRowSearchText(input.rows),
  ]
    .map(normalizeText)
    .join(" ");
}

const HOSPICE_KEYWORDS = [
  "hospice",
  "pennyroyal",
  "terminal",
  "deceased",
  "discharged",
  "date of death",
  "date_of_death",
  "death date",
  "death_date",
  "dod",
  "next of kin",
  "next_of_kin",
  "nok",
  "case manager",
  "case_manager",
  "assigned nurse",
  "assigned_nurse",
  "nurse",
  "rn",
  "caregiver",
  "pending pickup",
  "pending_pickup",
];

const ORDER_KEYWORDS = [
  "sales_order",
  "sales order",
  "sales order number",
  "order_number",
  "order number",
  "so_number",
  "so number",
  "ticket",
  "ticket_number",
  "invoice",
  "invoice_number",
  "item",
  "product",
  "product_name",
  "hcpcs",
  "quantity",
  "qty",
  "amount",
  "balance",
  "charge",
  "purchase_cost",
];

function shouldRunHospice(input: ProcessorInput): boolean {
  const searchText = buildSearchText(input);

  return textContainsAny(searchText, HOSPICE_KEYWORDS);
}

function shouldRunOrders(input: ProcessorInput): boolean {
  const searchText = buildSearchText(input);

  return textContainsAny(searchText, ORDER_KEYWORDS);
}

async function logProcessorFailure(params: {
  input: ProcessorInput;
  processor: ProcessorConfig;
  message: string;
}): Promise<void> {
  const { input, processor, message } = params;

  await writeAuditLog({
    action: "import_failed",

    actorUid: "system",
    actorEmail: "system",

    targetType: "importJob",
    targetId: input.importId,

    safeSummary: `Import processor failed: ${processor.name}`,

    metadata: {
      processor: processor.name,
      required: processor.required,
      reportType: input.reportType,
      fileName: input.fileName,
      rowCount: input.rows.length,
      message,
    },
  });
}

async function logProcessorCompletion(params: {
  input: ProcessorInput;
  processor: ProcessorConfig;
  durationMs: number;
}): Promise<void> {
  const { input, processor, durationMs } = params;

  await writeAuditLog({
    action: "system_event",

    actorUid: "system",
    actorEmail: "system",

    targetType: "importJob",
    targetId: input.importId,

    safeSummary: `Import processor completed: ${processor.name}`,

    metadata: {
      processor: processor.name,
      reportType: input.reportType,
      fileName: input.fileName,
      rowCount: input.rows.length,
      durationMs,
    },
  });
}

export async function runProcessors(input: ProcessorInput): Promise<void> {
  const hospiceDetected = shouldRunHospice(input);
  const ordersDetected = shouldRunOrders(input);

  const processors: ProcessorConfig[] = [
    {
      name: "patients",
      shouldRun: true,
      required: true,
      run: () => processPatientsFromRows(input),
    },
    {
      name: "orders",
      shouldRun: ordersDetected && !hospiceDetected,
      required: false,
      run: () => processOrdersFromRows(input),
    },
    {
      name: "hospice",
      shouldRun: hospiceDetected,
      required: false,
      run: () => processHospiceRows(input),
    },
  ];

  const selected = processors.filter((processor) => processor.shouldRun);

  logger.info("Import processors selected", {
    importId: input.importId,
    reportType: input.reportType,
    fileName: input.fileName,
    storagePath: input.storagePath,
    rowCount: input.rows.length,
    hospiceDetected,
    ordersDetected,
    processors: selected.map((processor) => processor.name),
  });

  await writeAuditLog({
    action: "system_event",

    actorUid: "system",
    actorEmail: "system",

    targetType: "importJob",
    targetId: input.importId,

    safeSummary: "Import processors selected.",

    metadata: {
      reportType: input.reportType,
      fileName: input.fileName,
      rowCount: input.rows.length,
      hospiceDetected,
      ordersDetected,
      processors: selected.map((processor) => processor.name),
    },
  });

  for (const processor of selected) {
    const startedAt = Date.now();

    try {
      logger.info("Import processor started", {
        importId: input.importId,
        processor: processor.name,
        rowCount: input.rows.length,
      });

      await processor.run();

      const durationMs = Date.now() - startedAt;

      logger.info("Import processor completed", {
        importId: input.importId,
        processor: processor.name,
        durationMs,
      });

      await logProcessorCompletion({
        input,
        processor,
        durationMs,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processor error.";

      logger.error("Import processor failed", {
        importId: input.importId,
        processor: processor.name,
        required: processor.required,
        message,
      });

      await logProcessorFailure({
        input,
        processor,
        message,
      });

      if (processor.required) {
        throw error;
      }
    }
  }
}