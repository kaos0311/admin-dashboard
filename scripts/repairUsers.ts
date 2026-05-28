import { cert, getApps, initializeApp } from "firebase-admin/app";

import {
  FieldValue,
  getFirestore,
  type WriteBatch,
} from "firebase-admin/firestore";

import * as fs from "fs";
import * as path from "path";

type UserRole = "admin" | "staff";

type UserTheme = "light" | "dark" | "system";

type ServiceAccountFile = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type UserDoc = {
  uid?: unknown;
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
  active?: unknown;
  phone?: unknown;
  theme?: unknown;
  notifications?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DRY_RUN = process.argv.includes("--dry-run");

const MAX_BATCH_SIZE = 450;

function loadServiceAccount() {
  const envProjectId = process.env.FIREBASE_PROJECT_ID;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (
    envProjectId &&
    envClientEmail &&
    envPrivateKey
  ) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const filePath = path.resolve(
    process.cwd(),
    "serviceAccountKey.json",
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing serviceAccountKey.json at ${filePath}`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");

  const parsed = JSON.parse(
    raw,
  ) as ServiceAccountFile;

  if (
    typeof parsed.project_id !== "string" ||
    typeof parsed.client_email !== "string" ||
    typeof parsed.private_key !== "string"
  ) {
    throw new Error(
      "Invalid Firebase service account.",
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey:
      parsed.private_key.replace(
        /\\n/g,
        "\n",
      ),
  };
}

function normalizeString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeRole(
  value: unknown,
): UserRole {
  return value === "admin" ||
    value === "staff"
    ? value
    : "staff";
}

function normalizeTheme(
  value: unknown,
): UserTheme {
  return value === "light" ||
    value === "system"
    ? value
    : "dark";
}

function normalizeNotifications(
  value: unknown,
): {
  email: boolean;
  sms: boolean;
} {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      email: true,
      sms: false,
    };
  }

  const data = value as {
    email?: unknown;
    sms?: unknown;
  };

  return {
    email:
      typeof data.email === "boolean"
        ? data.email
        : true,

    sms:
      typeof data.sms === "boolean"
        ? data.sms
        : false,
  };
}

function toUserDoc(
  value: unknown,
): UserDoc {
  if (
    value &&
    typeof value === "object"
  ) {
    return value as UserDoc;
  }

  return {};
}

async function commitBatch(
  batch: WriteBatch,
  operationCount: number,
) {
  if (operationCount <= 0) {
    return;
  }

  if (DRY_RUN) {
    console.log(
      `[DRY RUN] Would commit ${operationCount} operations.`,
    );

    return;
  }

  await batch.commit();

  console.log(
    `Committed ${operationCount} operations.`,
  );
}

async function main() {
  console.log(
    `Starting user repair script ${
      DRY_RUN
        ? "(DRY RUN MODE)"
        : ""
    }`,
  );

  const serviceAccount =
    loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:
          serviceAccount.projectId,

        clientEmail:
          serviceAccount.clientEmail,

        privateKey:
          serviceAccount.privateKey,
      }),
    });
  }

  const db = getFirestore();

  const usersRef =
    db.collection("users");

  const snapshot =
    await usersRef.get();

  if (snapshot.empty) {
    console.log(
      "No user documents found.",
    );

    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let duplicateEmailCount = 0;
  let invalidRoleCount = 0;

  const seenEmails =
    new Set<string>();

  let batch = db.batch();

  let batchOpCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = toUserDoc(
      docSnap.data(),
    );

    const updates: Record<
      string,
      unknown
    > = {};

    const safeUid =
      normalizeString(data.uid) ||
      docSnap.id;

    const safeEmail =
      normalizeString(
        data.email,
      ).toLowerCase();

    const safeDisplayName =
      normalizeString(
        data.displayName,
      );

    const safeRole =
      normalizeRole(data.role);

    const safeActive =
      typeof data.active ===
      "boolean"
        ? data.active
        : true;

    const safePhone =
      normalizeString(data.phone);

    const safeTheme =
      normalizeTheme(data.theme);

    const safeNotifications =
      normalizeNotifications(
        data.notifications,
      );

    if (
      data.role !== "admin" &&
      data.role !== "staff"
    ) {
      invalidRoleCount++;

      console.warn(
        `Invalid role detected for ${docSnap.id}:`,
        data.role,
      );
    }

    if (safeEmail) {
      if (
        seenEmails.has(
          safeEmail,
        )
      ) {
        duplicateEmailCount++;

        console.warn(
          `Duplicate email detected: ${safeEmail}`,
        );
      }

      seenEmails.add(
        safeEmail,
      );
    }

    if (
      data.uid !== safeUid
    ) {
      updates.uid = safeUid;
    }

    if (
      data.email !== safeEmail
    ) {
      updates.email =
        safeEmail;
    }

    if (
      data.displayName !==
      safeDisplayName
    ) {
      updates.displayName =
        safeDisplayName;
    }

    if (
      data.role !== safeRole
    ) {
      updates.role =
        safeRole;
    }

    if (
      data.active !==
      safeActive
    ) {
      updates.active =
        safeActive;
    }

    if (
      data.phone !==
      safePhone
    ) {
      updates.phone =
        safePhone;
    }

    if (
      data.theme !==
      safeTheme
    ) {
      updates.theme =
        safeTheme;
    }

    const currentNotifications =
      data.notifications &&
      typeof data.notifications ===
        "object"
        ? (data.notifications as {
            email?: unknown;
            sms?: unknown;
          })
        : null;

    if (
      !currentNotifications ||
      currentNotifications.email !==
        safeNotifications.email ||
      currentNotifications.sms !==
        safeNotifications.sms
    ) {
      updates.notifications =
        safeNotifications;
    }

    if (
      !(
        "createdAt" in data
      ) ||
      data.createdAt ==
        null
    ) {
      updates.createdAt =
        FieldValue.serverTimestamp();
    }

    if (
      Object.keys(updates)
        .length > 0
    ) {
      updates.updatedAt =
        FieldValue.serverTimestamp();

      batch.set(
        docSnap.ref,
        updates,
        {
          merge: true,
        },
      );

      batchOpCount++;
      updatedCount++;

      console.log(
        `Queued update for user: ${docSnap.id}`,
      );

      if (
        batchOpCount >=
        MAX_BATCH_SIZE
      ) {
        await commitBatch(
          batch,
          batchOpCount,
        );

        batch = db.batch();

        batchOpCount = 0;
      }
    } else {
      skippedCount++;

      console.log(
        `Skipped user: ${docSnap.id}`,
      );
    }
  }

  await commitBatch(
    batch,
    batchOpCount,
  );

  console.log("\nRepair complete.");
  console.log(
    `Updated: ${updatedCount}`,
  );

  console.log(
    `Skipped: ${skippedCount}`,
  );

  console.log(
    `Duplicate emails: ${duplicateEmailCount}`,
  );

  console.log(
    `Invalid roles corrected: ${invalidRoleCount}`,
  );
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error(
      "Repair failed:",
      error,
    );

    process.exitCode = 1;
  },
);