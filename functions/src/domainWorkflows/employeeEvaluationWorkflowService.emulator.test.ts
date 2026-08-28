import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "../test-utils/emulator-setup";
import {
  employeeEvaluationWorkflow,
  type EmployeeEvaluationSaveInput,
  type EmployeeEvaluationWorkflowInput,
} from "../domainWorkflows/employeeEvaluationWorkflowService";
import type { MovementActor } from "../inventory/movementService";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const tankActor: MovementActor = {
  uid: "ee-tank-001",
  email: "ee-tank@example.test",
  role: "tank",
};

const adminActor: MovementActor = {
  uid: "ee-admin-001",
  email: "ee-admin@example.test",
  role: "admin",
};

const staffActor: MovementActor = {
  uid: "ee-staff-001",
  email: "ee-staff@example.test",
  role: "staff",
};

const managerActor: MovementActor = {
  uid: "ee-manager-001",
  email: "ee-manager@example.test",
  role: "manager",
};

const technicianActor: MovementActor = {
  uid: "ee-technician-001",
  email: "ee-technician@example.test",
  role: "technician",
};

type CallableAuthContext = {
  uid: string;
  role: string;
  email?: string;
};

function callableRequest(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
  ip = "127.0.0.1"
) {
  return {
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: { "x-forwarded-for": ip },
    },
  };
}

async function invokeCallable(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext
) {
  const callable = (await import("../domainWorkflows/domainWorkflowFunctions.js"))
    .employeeEvaluationWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<ReturnType<typeof employeeEvaluationWorkflow>>;
  };
  return callable.run(callableRequest(data, authContext));
}

async function seedUser(uid: string, overrides: Record<string, unknown> = {}) {
  await db.collection("users").doc(uid).set({
    role: "tank",
    email: `${uid}@example.test`,
    active: true,
    disabled: false,
    deleted: false,
    ...overrides,
  });
}

async function seedEvaluation(employeeId: string, overrides: Record<string, unknown> = {}) {
  await db.collection("employeeEvaluations").doc(employeeId).set({
    employeeName: "Test Employee",
    role: "front_office",
    titles: ["Retail Specialist"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 80,
    highDollarSales: 70,
    deliveryTimeScore: 0,
    productivityScore: 75,
    deliveryAccuracy: 80,
    commentsQrUrl: "",
    reviewNotes: "",
    ...overrides,
  });
}

async function seedComment(
  employeeId: string,
  operationId: string,
  tone: "positive" | "corrective" | "neutral",
  comment: string,
  createdAtOffsetMs = 0
) {
  const createdAt = new Date(Date.now() + createdAtOffsetMs);
  await db.collection("employeeEvaluationComments").doc(`${employeeId}_${operationId}`).set({
    employeeId,
    employeeName: "Test Employee",
    tone,
    comment,
    source: "manager_manual_entry",
    createdByUid: tankActor.uid,
    createdByEmail: tankActor.email,
    createdAt: Timestamp.fromDate(createdAt),
  });
}

function validSaveInput(
  overrides: Partial<EmployeeEvaluationSaveInput> = {}
): EmployeeEvaluationSaveInput {
  return {
    operationId: "ee-save-001",
    action: "save",
    employeeId: "emp-1",
    employeeName: "Test Employee",
    role: "front_office",
    titles: ["Retail Specialist"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 80,
    highDollarSales: 70,
    deliveryTimeScore: 0,
    productivityScore: 75,
    deliveryAccuracy: 80,
    commentsQrUrl: "",
    reviewNotes: "",
    ...overrides,
  };
}

beforeEach(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("employeeEvaluations")),
    db.recursiveDelete(db.collection("employeeEvaluationComments")),
    db.recursiveDelete(db.collection("employeeEvaluationSnapshots")),
    db.recursiveDelete(db.collection("domainWorkflowOperations")),
    db.recursiveDelete(db.collection("auditLogs")),
    db.recursiveDelete(db.collection("users")),
  ]);
  await seedUser(tankActor.uid, { role: tankActor.role, email: tankActor.email });
  await seedUser(adminActor.uid, { role: adminActor.role, email: adminActor.email });
  await seedUser(staffActor.uid, { role: staffActor.role, email: staffActor.email });
  await seedUser(managerActor.uid, { role: managerActor.role, email: managerActor.email });
  await seedUser(technicianActor.uid, { role: technicianActor.role, email: technicianActor.email });
});

describe("employeeEvaluationWorkflow authorization", () => {
  it("allows tank role", async () => {
    const result = await employeeEvaluationWorkflow(
      validSaveInput(),
      tankActor,
      db
    );

    expect(result.status).toBe("success");
  });

  it("rejects admin role via callable", async () => {
    await expect(
      invokeCallable(
        validSaveInput({ operationId: "ee-auth-admin-001" }),
        { uid: adminActor.uid, role: adminActor.role, email: adminActor.email }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects staff role via callable", async () => {
    await expect(
      invokeCallable(
        validSaveInput({ operationId: "ee-auth-staff-001" }),
        { uid: staffActor.uid, role: staffActor.role, email: staffActor.email }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects manager role via callable", async () => {
    await expect(
      invokeCallable(
        validSaveInput({ operationId: "ee-auth-manager-001" }),
        { uid: managerActor.uid, role: managerActor.role, email: managerActor.email }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects technician role via callable", async () => {
    await expect(
      invokeCallable(
        validSaveInput({ operationId: "ee-auth-technician-001" }),
        { uid: technicianActor.uid, role: technicianActor.role, email: technicianActor.email }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects unauthenticated callable requests", async () => {
    await expect(
      invokeCallable(validSaveInput({ operationId: "ee-auth-unauth-001" }))
    ).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("derives actor UID/email/role from callable auth context, not client data", async () => {
    // The client could try to spoof actor data; the service must ignore it.
    const result = await employeeEvaluationWorkflow(
      {
        ...validSaveInput({ operationId: "ee-auth-actor-001" }),
        // These would be ignored because the actor comes from auth context.
      } as EmployeeEvaluationWorkflowInput,
      tankActor,
      db
    );

    expect(result.status).toBe("success");

    const evalSnap = await db.collection("employeeEvaluations").doc("emp-1").get();
    const data = evalSnap.data();
    expect(data?.updatedByUid).toBe(tankActor.uid); // Not a client-supplied uid
    expect(data?.updatedByEmail).toBe(tankActor.email);
  });

  it("rejects invalid tone through the callable boundary (not silently coerced)", async () => {
    await seedEvaluation("emp-callable-tone-001");

    await expect(
      invokeCallable(
        {
          operationId: "ee-callable-tone-001",
          action: "comment",
          employeeId: "emp-callable-tone-001",
          tone: "invalid-tone",
          comment: "Some comment",
        },
        { uid: tankActor.uid, role: tankActor.role, email: tankActor.email }
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects invalid evaluation year through the callable boundary (not silently defaulted)", async () => {
    await expect(
      invokeCallable(
        validSaveInput({
          operationId: "ee-callable-year-001",
          employeeId: "emp-callable-year-001",
          evaluationYear: 1999,
        }),
        { uid: tankActor.uid, role: tankActor.role, email: tankActor.email }
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects non-integer evaluation year through the callable boundary", async () => {
    await expect(
      invokeCallable(
        validSaveInput({
          operationId: "ee-callable-year-float-001",
          employeeId: "emp-callable-year-float-001",
          evaluationYear: 2025.5,
        }),
        { uid: tankActor.uid, role: tankActor.role, email: tankActor.email }
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});

describe("employeeEvaluationWorkflow save", () => {
  it("stores evaluation with authoritative actor fields and derives role from titles", async () => {
    const result = await employeeEvaluationWorkflow(
      validSaveInput({
        operationId: "ee-save-role-001",
        employeeId: "emp-save-role-001",
        employeeName: "Larry Tech",
        role: "front_office", // Client attempts to pass front_office
        titles: ["Delivery Tech"],
        evaluationYear: 2025,
        recordAccuracy: 90,
        highDollarSales: 80,
        deliveryTimeScore: 70,
        productivityScore: 85,
        deliveryAccuracy: 75,
        commentsQrUrl: "https://example.com/qr",
        reviewNotes: "Good year",
      }),
      tankActor,
      db
    );

    expect(result.status).toBe("success");

    const evalSnap = await db.collection("employeeEvaluations").doc("emp-save-role-001").get();
    const data = evalSnap.data();
    expect(data?.employeeName).toBe("Larry Tech");
    // Role must be derived from authoritative server titles, not client role.
    expect(data?.role).toBe("tech");
    expect(data?.titles).toEqual(["Delivery Tech"]);
    expect(data?.currentGradeScore).toBe(77); // (70+85+75)/3 = 230/3 = 76.67 -> round = 77
    expect(data?.updatedByUid).toBe(tankActor.uid);
    expect(data?.updatedByEmail).toBe(tankActor.email);
    expect(data?.updatedAt).toBeInstanceOf(Timestamp);
  });

  it("evaluation, operation record, and audit are atomic", async () => {
    const result = await employeeEvaluationWorkflow(
      validSaveInput({
        operationId: "ee-save-atomic-001",
        employeeId: "emp-save-atomic-001",
      }),
      tankActor,
      db
    );

    expect(result.status).toBe("success");

    const evalSnap = await db.collection("employeeEvaluations").doc("emp-save-atomic-001").get();
    expect(evalSnap.exists).toBe(true);

    const opSnap = await db
      .collection("domainWorkflowOperations")
      .doc(`${tankActor.uid}_ee-save-atomic-001`)
      .get();
    expect(opSnap.exists).toBe(true);
    expect(opSnap.data()?.status).toBe("completed");

    const auditSnap = await db.collection("auditLogs").get();
    const audits = auditSnap.docs.map((d) => d.data());
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "employee_evaluation_updated",
          actorUid: tankActor.uid,
          actorEmail: tankActor.email,
          targetId: "emp-save-atomic-001",
          targetCollection: "employeeEvaluations",
        }),
      ])
    );
  });

  it("returns duplicate_operation for identical retry with same operationId", async () => {
    const input = validSaveInput({
      operationId: "ee-save-dup-001",
      employeeId: "emp-save-dup-001",
    });

    const first = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(first.status).toBe("success");

    const second = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(second.status).toBe("duplicate_operation");
  });

  it("rejects conflicting reused operationId with materially different payload", async () => {
    const input = validSaveInput({
      operationId: "ee-save-conflict-001",
      employeeId: "emp-save-conflict-001",
    });

    await employeeEvaluationWorkflow(input, tankActor, db);

    await expect(
      employeeEvaluationWorkflow(
        { ...input, employeeName: "Different Name" },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejects invalid metric scores", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-invalid-metric-001",
          employeeId: "emp-save-invalid-metric-001",
          recordAccuracy: Number.NaN,
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects out-of-range metric scores", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-range-metric-001",
          employeeId: "emp-save-range-metric-001",
          recordAccuracy: 150,
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects invalid evaluation year", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-invalid-year-001",
          employeeId: "emp-save-invalid-year-001",
          evaluationYear: 1999,
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects non-integer evaluation year", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-float-year-001",
          employeeId: "emp-save-float-year-001",
          evaluationYear: 2025.5,
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects invalid titles", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-invalid-title-001",
          employeeId: "emp-save-invalid-title-001",
          titles: ["Unknown Title"],
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects empty titles", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-empty-title-001",
          employeeId: "emp-save-empty-title-001",
          titles: [],
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects missing employeeName", async () => {
    await expect(
      employeeEvaluationWorkflow(
        validSaveInput({
          operationId: "ee-save-no-name-001",
          employeeId: "emp-save-no-name-001",
          employeeName: "",
        }),
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});

describe("employeeEvaluationWorkflow snapshot", () => {
  it("creates snapshot and updates evaluation metadata atomically", async () => {
    await seedEvaluation("emp-snap-001", {
      employeeName: "Snap Test",
      evaluationYear: 2025,
    });

    const result = await employeeEvaluationWorkflow(
      {
        operationId: "ee-snap-001",
        action: "snapshot",
        employeeId: "emp-snap-001",
      },
      tankActor,
      db
    );

    expect(result.status).toBe("success");

    const snapshotSnap = await db
      .collection("employeeEvaluationSnapshots")
      .doc("emp-snap-001_ee-snap-001")
      .get();
    expect(snapshotSnap.exists).toBe(true);
    expect(snapshotSnap.data()?.employeeName).toBe("Snap Test");
    expect(snapshotSnap.data()?.snapshotType).toBe("yearly_evaluation");
    expect(snapshotSnap.data()?.createdByUid).toBe(tankActor.uid);

    const evalSnap = await db.collection("employeeEvaluations").doc("emp-snap-001").get();
    expect(evalSnap.data()?.lastSnapshotYear).toBe(2025);
    expect(evalSnap.data()?.lastSnapshotAt).toBeInstanceOf(Timestamp);

    const opSnap = await db
      .collection("domainWorkflowOperations")
      .doc(`${tankActor.uid}_ee-snap-001`)
      .get();
    expect(opSnap.exists).toBe(true);
    expect(opSnap.data()?.status).toBe("completed");

    const auditSnap = await db.collection("auditLogs").get();
    const audits = auditSnap.docs.map((d) => d.data());
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "employee_yearly_snapshot_created",
          actorUid: tankActor.uid,
          targetId: "emp-snap-001_ee-snap-001",
          targetCollection: "employeeEvaluationSnapshots",
        }),
      ])
    );
  });

  it("requires evaluation to exist", async () => {
    await expect(
      employeeEvaluationWorkflow(
        {
          operationId: "ee-snap-missing-001",
          action: "snapshot",
          employeeId: "emp-snap-missing-001",
        },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("captures deterministic most-recent comments", async () => {
    await seedEvaluation("emp-snap-recent-001", { employeeName: "Recent Test" });

    // Seed comments with increasing creation times.
    await seedComment("emp-snap-recent-001", "c-001", "positive", "First comment", -30000);
    await seedComment("emp-snap-recent-001", "c-002", "corrective", "Second comment", -20000);
    await seedComment("emp-snap-recent-001", "c-003", "positive", "Third comment", -10000);

    const result = await employeeEvaluationWorkflow(
      {
        operationId: "ee-snap-recent-001",
        action: "snapshot",
        employeeId: "emp-snap-recent-001",
      },
      tankActor,
      db
    );

    expect(result.status).toBe("success");

    const snapshotSnap = await db
      .collection("employeeEvaluationSnapshots")
      .doc("emp-snap-recent-001_ee-snap-recent-001")
      .get();
    const snapshot = snapshotSnap.data();
    expect(snapshot?.managerCommentCount).toBe(3);
    expect(snapshot?.positiveCommentCount).toBe(2);
    expect(snapshot?.correctiveCommentCount).toBe(1);
    expect(snapshot?.countIsCapped).toBe(false);

    // Most recent first.
    expect(snapshot?.recentManagerComments).toHaveLength(3);
    expect(snapshot?.recentManagerComments[0].comment).toBe("Third comment");
    expect(snapshot?.recentManagerComments[1].comment).toBe("Second comment");
    expect(snapshot?.recentManagerComments[2].comment).toBe("First comment");
  });

  it("does not create second snapshot or duplicate records on retry", async () => {
    await seedEvaluation("emp-snap-retry-001");

    const input: EmployeeEvaluationWorkflowInput = {
      operationId: "ee-snap-retry-001",
      action: "snapshot",
      employeeId: "emp-snap-retry-001",
    };

    const first = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(first.status).toBe("success");

    const second = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(second.status).toBe("duplicate_operation");

    const snapshots = await db.collection("employeeEvaluationSnapshots").get();
    expect(snapshots.size).toBe(1);

    const operations = await db.collection("domainWorkflowOperations").get();
    expect(operations.size).toBe(1);
  });

  it("rejects conflicting snapshot reuse", async () => {
    await seedEvaluation("emp-snap-conflict-001");

    await employeeEvaluationWorkflow(
      {
        operationId: "ee-snap-conflict-001",
        action: "snapshot",
        employeeId: "emp-snap-conflict-001",
      },
      tankActor,
      db
    );

    // Different employee with same operationId is a conflict.
    await seedEvaluation("emp-snap-conflict-002");
    await expect(
      employeeEvaluationWorkflow(
        {
          operationId: "ee-snap-conflict-001",
          action: "snapshot",
          employeeId: "emp-snap-conflict-002",
        },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});

describe("employeeEvaluationWorkflow comment", () => {
  it("creates comment and updates evaluation metadata atomically", async () => {
    await seedEvaluation("emp-comment-001");

    const result = await employeeEvaluationWorkflow(
      {
        operationId: "ee-comment-001",
        action: "comment",
        employeeId: "emp-comment-001",
        tone: "positive",
        comment: "Excellent work this quarter.",
      },
      tankActor,
      db
    );

    expect(result.status).toBe("success");

    const commentSnap = await db
      .collection("employeeEvaluationComments")
      .doc("emp-comment-001_ee-comment-001")
      .get();
    expect(commentSnap.exists).toBe(true);
    expect(commentSnap.data()?.comment).toBe("Excellent work this quarter.");
    expect(commentSnap.data()?.tone).toBe("positive");
    expect(commentSnap.data()?.createdByUid).toBe(tankActor.uid);
    expect(commentSnap.data()?.source).toBe("manager_manual_entry");

    const evalSnap = await db.collection("employeeEvaluations").doc("emp-comment-001").get();
    expect(evalSnap.data()?.latestManagerComment).toBe("Excellent work this quarter.");
    expect(evalSnap.data()?.latestManagerCommentTone).toBe("positive");
    expect(evalSnap.data()?.latestManagerCommentAt).toBeInstanceOf(Timestamp);

    const opSnap = await db
      .collection("domainWorkflowOperations")
      .doc(`${tankActor.uid}_ee-comment-001`)
      .get();
    expect(opSnap.exists).toBe(true);
    expect(opSnap.data()?.status).toBe("completed");

    const auditSnap = await db.collection("auditLogs").get();
    const audits = auditSnap.docs.map((d) => d.data());
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "employee_evaluation_comment_added",
          actorUid: tankActor.uid,
          targetId: "emp-comment-001_ee-comment-001",
          targetCollection: "employeeEvaluationComments",
        }),
      ])
    );
  });

  it("requires evaluation to exist", async () => {
    await expect(
      employeeEvaluationWorkflow(
        {
          operationId: "ee-comment-missing-001",
          action: "comment",
          employeeId: "emp-comment-missing-001",
          tone: "positive",
          comment: "Some comment",
        },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("rejects blank comment", async () => {
    await seedEvaluation("emp-comment-blank-001");

    await expect(
      employeeEvaluationWorkflow(
        {
          operationId: "ee-comment-blank-001",
          action: "comment",
          employeeId: "emp-comment-blank-001",
          tone: "positive",
          comment: "   ",
        },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects invalid tone", async () => {
    await seedEvaluation("emp-comment-tone-001");

    await expect(
      employeeEvaluationWorkflow(
        {
          operationId: "ee-comment-tone-001",
          action: "comment",
          employeeId: "emp-comment-tone-001",
          tone: "invalid" as "positive" | "corrective" | "neutral",
          comment: "Some comment",
        },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("does not create second comment on retry", async () => {
    await seedEvaluation("emp-comment-retry-001");

    const input: EmployeeEvaluationWorkflowInput = {
      operationId: "ee-comment-retry-001",
      action: "comment",
      employeeId: "emp-comment-retry-001",
      tone: "positive",
      comment: "Retry test comment",
    };

    const first = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(first.status).toBe("success");

    const second = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(second.status).toBe("duplicate_operation");

    const comments = await db.collection("employeeEvaluationComments").get();
    expect(comments.size).toBe(1);

    const operations = await db.collection("domainWorkflowOperations").get();
    expect(operations.size).toBe(1);
  });

  it("rejects changed comment with same operationId", async () => {
    await seedEvaluation("emp-comment-changed-001");

    const input: EmployeeEvaluationWorkflowInput = {
      operationId: "ee-comment-changed-001",
      action: "comment",
      employeeId: "emp-comment-changed-001",
      tone: "positive",
      comment: "Original comment",
    };

    const first = await employeeEvaluationWorkflow(input, tankActor, db);
    expect(first.status).toBe("success");

    await expect(
      employeeEvaluationWorkflow(
        { ...input, comment: "Changed comment" },
        tankActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});