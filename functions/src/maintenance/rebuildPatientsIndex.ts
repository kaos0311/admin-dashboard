import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  FieldPath,
  FieldValue,
  QueryDocumentSnapshot,
  getFirestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = getFirestore();

const PAGE_SIZE = 500;
const WRITE_BATCH_SIZE = 250;
const REGION = "us-central1";

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
};

function requireAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can rebuild patient indexes."
    );
  }
}

function cleanString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function asBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;

  const normalized = cleanString(value).toLowerCase();

  return normalized === "true" || normalized === "yes" || normalized === "1";
}

function buildSearchText(data: Record<string, unknown>): string {
  return [
    data.patientKey,
    data.patientId,
    data.customerId,
    data.fullName,
    data.displayName,
    data.patientName,
    data.firstName,
    data.lastName,
    data.dob,
    data.dateOfBirth,
    data.phone,
    data.email,
    data.address,
    data.city,
    data.state,
    data.zip,
    data.primaryInsurance,
    data.payor,
    data.searchText,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function splitName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const cleaned = cleanString(fullName).replace(/\s+/g, " ");

  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }

  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] ?? "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

function compactRecord(
  data: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    output[key] = value;
  }

  return output;
}

function buildPatientIndexDoc(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const fullName =
    cleanString(data.fullName) ||
    cleanString(data.displayName) ||
    cleanString(data.patientName) ||
    "Unnamed Patient";

  const names = splitName(fullName);

  const firstName = cleanString(data.firstName) || names.firstName;
  const lastName = cleanString(data.lastName) || names.lastName;

  const dob = cleanString(data.dob || data.dateOfBirth);

  const primaryInsurance =
    cleanString(data.primaryInsurance) ||
    cleanString((data.insurance as Record<string, unknown> | undefined)?.primaryInsurance) ||
    cleanString(data.payor);

  return compactRecord({
    patientKey: cleanString(data.patientKey) || id,
    id,

    patientId: cleanString(data.patientId),
    customerId: cleanString(data.customerId),

    fullName,
    displayName: cleanString(data.displayName) || fullName,
    patientName: cleanString(data.patientName) || fullName,

    firstName,
    lastName,
    normalizedFullName: fullName.toLowerCase(),

    dob,
    dateOfBirth: dob,

    phone: cleanString(data.phone),
    email: cleanString(data.email),
    address: cleanString(data.address),
    city: cleanString(data.city),
    state: cleanString(data.state),
    zip: cleanString(data.zip),

    hospice: asBoolean(data.hospice || data.isHospice),
    isHospice: asBoolean(data.isHospice || data.hospice),

    primaryInsurance,
    payor: cleanString(data.payor) || primaryInsurance,

    insurance: {
      primaryInsurance,
      payor: cleanString(data.payor) || primaryInsurance,
    },

    patientSnapshot: cleanString(data.patientSnapshot || data.snapshot),
    snapshot: cleanString(data.snapshot || data.patientSnapshot),

    active: data.active ?? true,
    archived: data.archived ?? false,

    searchText: buildSearchText({
      ...data,
      fullName,
      firstName,
      lastName,
      dob,
      primaryInsurance,
    }),

    sourceImportId: cleanString(data.sourceImportId || data.lastImportId),
    sourceReportType: cleanString(data.sourceReportType || data.lastReportType),
    sourceFileName: cleanString(data.sourceFileName || data.lastImportFileName),

    rebuiltAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function writeIndexBatch(
  docs: QueryDocumentSnapshot[]
): Promise<number> {
  let written = 0;

  for (let i = 0; i < docs.length; i += WRITE_BATCH_SIZE) {
    const chunk = docs.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      const data = doc.data();
      const indexRef = db.collection("patients_index").doc(doc.id);

      batch.set(indexRef, buildPatientIndexDoc(doc.id, data), {
        merge: true,
      });

      written += 1;
    }

    await batch.commit();
  }

  return written;
}

export const rebuildPatientsIndex = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    requireAdmin(request as CallableRequestLike);

    const uid = request.auth!.uid;
    const email =
      typeof request.auth!.token.email === "string"
        ? request.auth!.token.email
        : "";

    const jobRef = await db.collection("systemJobs").add({
      type: "rebuildPatientsIndex",
      status: "processing",
      stage: "starting",
      requestedBy: uid,
      requestedByEmail: email,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    let lastDoc: QueryDocumentSnapshot | undefined;
    let totalRead = 0;
    let totalWritten = 0;

    try {
      while (true) {
        let patientsQuery = db
          .collection("patients")
          .orderBy(FieldPath.documentId())
          .limit(PAGE_SIZE);

        if (lastDoc) {
          patientsQuery = patientsQuery.startAfter(lastDoc);
        }

        const snap = await patientsQuery.get();

        if (snap.empty) break;

        const written = await writeIndexBatch(snap.docs);

        totalRead += snap.size;
        totalWritten += written;
        lastDoc = snap.docs.at(-1);

        await jobRef.set(
          {
            stage: "rebuilding",
            totalRead,
            totalWritten,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (snap.size < PAGE_SIZE) break;
      }

      await jobRef.set(
        {
          status: "completed",
          stage: "completed",
          totalRead,
          totalWritten,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("rebuildPatientsIndex completed", {
        totalRead,
        totalWritten,
      });

      return {
        ok: true,
        message: "Patients index rebuilt.",
        totalRead,
        totalWritten,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed rebuilding index.";

      await jobRef.set(
        {
          status: "failed",
          stage: "failed",
          error: message,
          failedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new HttpsError("internal", message);
    }
  }
);