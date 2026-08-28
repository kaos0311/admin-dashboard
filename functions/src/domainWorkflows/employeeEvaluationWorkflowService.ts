import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  assertSafeDocId,
  claimWorkflowOperation,
  completeWorkflowOperation,
  type WorkflowResult,
  writeWorkflowAudit,
} from "./shared.js";
import type { MovementActor } from "../inventory/movementService.js";

export type EmployeeEvaluationAction = "save" | "snapshot" | "comment";

export type EmployeeEvaluationSaveInput = {
  operationId: string;
  action: "save";
  employeeId: string;
  employeeName: string;
  role: "front_office" | "tech";
  titles: string[];
  evaluationYear: number;
  recordAccuracy: number;
  highDollarSales: number;
  deliveryTimeScore: number;
  productivityScore: number;
  deliveryAccuracy: number;
  commentsQrUrl: string;
  reviewNotes: string;
};

export type EmployeeEvaluationSnapshotInput = {
  operationId: string;
  action: "snapshot";
  employeeId: string;
};

export type EmployeeEvaluationCommentInput = {
  operationId: string;
  action: "comment";
  employeeId: string;
  tone: "positive" | "corrective" | "neutral";
  comment: string;
};

export type EmployeeEvaluationWorkflowInput =
  | EmployeeEvaluationSaveInput
  | EmployeeEvaluationSnapshotInput
  | EmployeeEvaluationCommentInput;

const EMPLOYEE_TITLE_OPTIONS = new Set([
  "Manager",
  "Retail Specialist",
  "Auditor",
  "Delivery Tech",
  "IT Support",
  "Inventory Specialist",
  "CPAP Specialist",
  "Hospice Specialist",
]);

const TITLE_METRIC_FIELDS: Record<string, string[]> = {
  Manager: ["recordAccuracy", "highDollarSales", "deliveryTimeScore", "productivityScore", "deliveryAccuracy"],
  "Retail Specialist": ["recordAccuracy", "highDollarSales", "productivityScore"],
  Auditor: ["recordAccuracy", "deliveryAccuracy"],
  "Delivery Tech": ["deliveryTimeScore", "productivityScore", "deliveryAccuracy"],
  "IT Support": ["deliveryTimeScore", "productivityScore", "recordAccuracy"],
  "Inventory Specialist": ["recordAccuracy", "productivityScore", "deliveryAccuracy"],
  "CPAP Specialist": ["recordAccuracy", "highDollarSales", "productivityScore"],
  "Hospice Specialist": ["recordAccuracy", "deliveryTimeScore", "productivityScore"],
};

const MIN_EVALUATION_YEAR = 2000;
const MAX_EVALUATION_YEAR = 2100;
const METRIC_MIN = 0;
const METRIC_MAX = 100;
const RECENT_COMMENT_LIMIT = 12;
const MAX_COMMENT_QUERY_LIMIT = 1000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireFiniteMetric(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) {
    throw new HttpsError("invalid-argument", `${field} must be a finite number.`);
  }
  if (value < METRIC_MIN || value > METRIC_MAX) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be between ${METRIC_MIN} and ${METRIC_MAX}.`
    );
  }
  return value;
}

function requireValidYear(value: unknown): number {
  if (!isFiniteNumber(value) || !Number.isInteger(value)) {
    throw new HttpsError("invalid-argument", "evaluationYear must be an integer.");
  }
  if (value < MIN_EVALUATION_YEAR || value > MAX_EVALUATION_YEAR) {
    throw new HttpsError(
      "invalid-argument",
      `evaluationYear must be between ${MIN_EVALUATION_YEAR} and ${MAX_EVALUATION_YEAR}.`
    );
  }
  return value;
}

function normalizeTitles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "titles must be an array.");
  }
  const titles = value.map((item) => text(item));
  const invalid = titles.filter((title) => !title || !EMPLOYEE_TITLE_OPTIONS.has(title));
  if (invalid.length > 0) {
    throw new HttpsError("invalid-argument", `Unknown employee title: ${invalid[0]}.`);
  }
  if (titles.length === 0) {
    throw new HttpsError("invalid-argument", "At least one title is required for save.");
  }
  return Array.from(new Set(titles));
}

function roleFromTitles(titles: string[]): "front_office" | "tech" {
  return titles.includes("Delivery Tech") ? "tech" : "front_office";
}

function metricFieldsForTitles(titles: string[]): string[] {
  const fields = titles.flatMap((title) => TITLE_METRIC_FIELDS[title] ?? []);
  return Array.from(new Set(fields));
}

function gradeScore(titles: string[], record: Record<string, unknown>): number {
  const fields = metricFieldsForTitles(titles);
  if (!fields.length) return 0;
  const values = fields.map((field) => Number(record[field] ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.max(METRIC_MIN, Math.min(METRIC_MAX, Math.round(total / fields.length)));
}

function gradeLetter(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "Needs Review";
}

const WORKFLOW_TYPE = "employee_evaluation";

/**
 * Builds a deterministic fingerprint from the normalized server-side save
 * payload. Reusing an operationId with identical normalized input remains
 * idempotent; reusing it with materially different input conflicts.
 */
function saveFingerprint(input: EmployeeEvaluationSaveInput): Record<string, unknown> {
  return {
    action: "save",
    employeeId: text(input.employeeId),
    employeeName: text(input.employeeName),
    role: roleFromTitles(normalizeTitles(input.titles)),
    titles: normalizeTitles(input.titles),
    evaluationYear: requireValidYear(input.evaluationYear),
    recordAccuracy: requireFiniteMetric(input.recordAccuracy, "recordAccuracy"),
    highDollarSales: requireFiniteMetric(input.highDollarSales, "highDollarSales"),
    deliveryTimeScore: requireFiniteMetric(input.deliveryTimeScore, "deliveryTimeScore"),
    productivityScore: requireFiniteMetric(input.productivityScore, "productivityScore"),
    deliveryAccuracy: requireFiniteMetric(input.deliveryAccuracy, "deliveryAccuracy"),
    commentsQrUrl: text(input.commentsQrUrl),
    reviewNotes: text(input.reviewNotes),
  };
}

export async function employeeEvaluationWorkflow(
  input: EmployeeEvaluationWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  switch (input.action) {
    case "save":
      return saveEvaluation(input, actor, database);
    case "snapshot":
      return createSnapshot(input, actor, database);
    case "comment":
      return addComment(input, actor, database);
    default:
      throw new HttpsError("invalid-argument", "Unsupported employee evaluation action.");
  }
}

async function saveEvaluation(
  input: EmployeeEvaluationSaveInput,
  actor: MovementActor,
  database: Firestore
): Promise<WorkflowResult> {
  const workflowType = `${WORKFLOW_TYPE}.save`;
  const employeeId = text(input.employeeId);
  if (!employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }
  assertSafeDocId(employeeId, "employeeId");

  const employeeName = text(input.employeeName);
  if (!employeeName) {
    throw new HttpsError("invalid-argument", "employeeName is required for save.");
  }

  // Server-authoritative validation before idempotency claim so invalid
  // payloads are always rejected regardless of operationId reuse.
  const titles = normalizeTitles(input.titles);
  const role = roleFromTitles(titles);
  const evaluationYear = requireValidYear(input.evaluationYear);
  const recordAccuracy = requireFiniteMetric(input.recordAccuracy, "recordAccuracy");
  const highDollarSales = requireFiniteMetric(input.highDollarSales, "highDollarSales");
  const deliveryTimeScore = requireFiniteMetric(input.deliveryTimeScore, "deliveryTimeScore");
  const productivityScore = requireFiniteMetric(input.productivityScore, "productivityScore");
  const deliveryAccuracy = requireFiniteMetric(input.deliveryAccuracy, "deliveryAccuracy");

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint: saveFingerprint({
        ...input,
        employeeName,
        role,
        titles,
        evaluationYear,
        recordAccuracy,
        highDollarSales,
        deliveryTimeScore,
        productivityScore,
        deliveryAccuracy,
      }),
    });
    if (claimed.duplicate) return claimed.result;

    const score = gradeScore(titles, {
      recordAccuracy,
      highDollarSales,
      deliveryTimeScore,
      productivityScore,
      deliveryAccuracy,
    });
    const letter = gradeLetter(score);

    const evalRef = database.collection("employeeEvaluations").doc(employeeId);
    transaction.set(
      evalRef,
      {
        employeeName,
        role,
        titles,
        evaluationYear,
        recordAccuracy,
        highDollarSales,
        deliveryTimeScore,
        productivityScore,
        deliveryAccuracy,
        commentsQrUrl: text(input.commentsQrUrl),
        reviewNotes: text(input.reviewNotes),
        currentGradeScore: score,
        currentGradeLetter: letter,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: "employee_evaluation_updated",
      targetCollection: "employeeEvaluations",
      targetId: employeeId,
      details: {
        evaluationYear,
        gradeScore: score,
        gradeLetter: letter,
      },
    });

    const result: WorkflowResult = {
      status: "success",
      operationId: input.operationId,
      workflowType,
    };

    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    return result;
  });
}

async function createSnapshot(
  input: EmployeeEvaluationSnapshotInput,
  actor: MovementActor,
  database: Firestore
): Promise<WorkflowResult> {
  const workflowType = `${WORKFLOW_TYPE}.snapshot`;
  const employeeId = text(input.employeeId);
  if (!employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }
  assertSafeDocId(employeeId, "employeeId");

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint: { action: "snapshot", employeeId },
    });
    if (claimed.duplicate) return claimed.result;

    const evalRef = database.collection("employeeEvaluations").doc(employeeId);
    const evalSnap = await transaction.get(evalRef);
    if (!evalSnap.exists) {
      throw new HttpsError("not-found", "Employee evaluation was not found.");
    }
    const evaluation = evalSnap.data() ?? {};

    // Query actual top-level collection with deterministic ordering so
    // recentManagerComments truly represents the most recent comments.
    const commentsQuery = database
      .collection("employeeEvaluationComments")
      .where("employeeId", "==", employeeId)
      .orderBy("createdAt", "desc")
      .limit(MAX_COMMENT_QUERY_LIMIT);
    const commentsSnap = await transaction.get(commentsQuery);
    const employeeComments = commentsSnap.docs.map((doc) => doc.data() as Record<string, unknown>);

    const titles = Array.isArray(evaluation.titles)
      ? (evaluation.titles as unknown[])
          .filter((t): t is string => typeof t === "string" && EMPLOYEE_TITLE_OPTIONS.has(t))
      : [];
    const score = gradeScore(titles, evaluation);
    const letter = gradeLetter(score);

    // Counts are truthful for the query window. If the window is capped by
    // MAX_COMMENT_QUERY_LIMIT, expose the cap so consumers never treat a
    // truncated count as an exact unbounded total.
    const countIsCapped = employeeComments.length >= MAX_COMMENT_QUERY_LIMIT;
    const managerCommentCount = employeeComments.length;
    const positiveCommentCount = employeeComments.filter((c) => c.tone === "positive").length;
    const correctiveCommentCount = employeeComments.filter((c) => c.tone === "corrective").length;

    // Deterministic most-recent: the query is ordered desc by createdAt, so
    // the first slice is the newest comments.
    const recentManagerComments = employeeComments.slice(0, RECENT_COMMENT_LIMIT).map((c) => ({
      tone: c.tone,
      comment: c.comment,
      createdByEmail: c.createdByEmail,
      createdAt: c.createdAt,
    }));

    const snapshotId = `${employeeId}_${input.operationId}`;
    const snapshotRef = database.collection("employeeEvaluationSnapshots").doc(snapshotId);
    transaction.set(snapshotRef, {
      employeeId,
      employeeName: text(evaluation.employeeName),
      role: evaluation.role,
      titles,
      evaluationYear: Number.isInteger(Number(evaluation.evaluationYear))
        ? Number(evaluation.evaluationYear)
        : new Date().getFullYear(),
      recordAccuracy: Number.isFinite(Number(evaluation.recordAccuracy))
        ? Number(evaluation.recordAccuracy)
        : 0,
      highDollarSales: Number.isFinite(Number(evaluation.highDollarSales))
        ? Number(evaluation.highDollarSales)
        : 0,
      deliveryTimeScore: Number.isFinite(Number(evaluation.deliveryTimeScore))
        ? Number(evaluation.deliveryTimeScore)
        : 0,
      productivityScore: Number.isFinite(Number(evaluation.productivityScore))
        ? Number(evaluation.productivityScore)
        : 0,
      deliveryAccuracy: Number.isFinite(Number(evaluation.deliveryAccuracy))
        ? Number(evaluation.deliveryAccuracy)
        : 0,
      commentsQrUrl: text(evaluation.commentsQrUrl),
      reviewNotes: text(evaluation.reviewNotes),
      gradeScore: score,
      gradeLetter: letter,
      managerCommentCount,
      positiveCommentCount,
      correctiveCommentCount,
      countIsCapped,
      recentManagerComments,
      snapshotType: "yearly_evaluation",
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    const evaluationYear = Number.isInteger(Number(evaluation.evaluationYear))
      ? Number(evaluation.evaluationYear)
      : new Date().getFullYear();
    transaction.set(
      evalRef,
      {
        lastSnapshotAt: FieldValue.serverTimestamp(),
        lastSnapshotYear: evaluationYear,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: "employee_yearly_snapshot_created",
      targetCollection: "employeeEvaluationSnapshots",
      targetId: snapshotId,
      details: {
        evaluationYear,
        gradeScore: score,
        gradeLetter: letter,
      },
    });

    const result: WorkflowResult = {
      status: "success",
      operationId: input.operationId,
      workflowType,
    };

    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    return result;
  });
}

async function addComment(
  input: EmployeeEvaluationCommentInput,
  actor: MovementActor,
  database: Firestore
): Promise<WorkflowResult> {
  const workflowType = `${WORKFLOW_TYPE}.comment`;
  const employeeId = text(input.employeeId);
  const commentText = text(input.comment);
  if (!employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }
  assertSafeDocId(employeeId, "employeeId");
  if (!commentText) {
    throw new HttpsError("invalid-argument", "Comment text is required.");
  }
  const validTones = new Set(["positive", "corrective", "neutral"]);
  if (!validTones.has(input.tone)) {
    throw new HttpsError("invalid-argument", "Invalid comment tone.");
  }

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint: { action: "comment", employeeId, tone: input.tone, comment: commentText },
    });
    if (claimed.duplicate) return claimed.result;

    const evalRef = database.collection("employeeEvaluations").doc(employeeId);
    const evalSnap = await transaction.get(evalRef);
    if (!evalSnap.exists) {
      throw new HttpsError("not-found", "Employee evaluation was not found.");
    }
    const evaluation = evalSnap.data() ?? {};
    const employeeName = text(evaluation.employeeName) || employeeId;

    const commentId = `${employeeId}_${input.operationId}`;
    const commentRef = database.collection("employeeEvaluationComments").doc(commentId);
    transaction.set(commentRef, {
      employeeId,
      employeeName,
      tone: input.tone,
      comment: commentText,
      source: "manager_manual_entry",
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.set(
      evalRef,
      {
        latestManagerComment: commentText,
        latestManagerCommentTone: input.tone,
        latestManagerCommentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: "employee_evaluation_comment_added",
      targetCollection: "employeeEvaluationComments",
      targetId: commentId,
      details: {
        tone: input.tone,
        evaluationYear: Number.isInteger(Number(evaluation.evaluationYear))
          ? Number(evaluation.evaluationYear)
          : null,
        employeeId,
      },
    });

    const result: WorkflowResult = {
      status: "success",
      operationId: input.operationId,
      workflowType,
    };

    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    return result;
  });
}