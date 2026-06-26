import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Publicly exposable collection metadata for GPT Actions.
 * Each entry describes the collection, its fields, and access limitations.
 */
export const EXPOSED_COLLECTIONS = [
  {
    name: "analytics/dashboard",
    description: "Aggregated operational dashboard metrics",
    fields: ["totalPatients", "totalOrders", "activeRentals", "wipCount"],
  },
  {
    name: "analytics/reports",
    description: "Aggregated report and financial analytics",
    fields: [
      "retailFinancials",
      "importSummary",
      "generatedAtLabel",
    ],
  },
  {
    name: "patients",
    description:
      "Patient demographic records (PHI-redacted: names only, no SSN/DOB)",
    fields: ["patientName", "phone", "insurance", "status"],
    redactedFields: ["ssn", "dob", "address"],
  },
  {
    name: "patients_index",
    description: "Search-optimized patient index (PHI-redacted)",
    fields: ["patientName", "phone", "insuranceName"],
    redactedFields: ["ssn", "dob", "address"],
  },
  {
    name: "orders",
    description: "Patient orders and their current status",
    fields: [
      "patientName",
      "status",
      "productType",
      "createdAt",
      "total",
    ],
  },
  {
    name: "inventory",
    description: "Physical inventory records with quantities and locations",
    fields: [
      "name",
      "sku",
      "hcpc",
      "barcode",
      "quantityOnHand",
      "available",
      "onRent",
      "locationName",
      "binLocation",
    ],
  },
  {
    name: "products",
    description: "Product catalog with pricing and categorization",
    fields: [
      "name",
      "sku",
      "hcpcs",
      "category",
      "basePrice",
      "status",
    ],
  },
  {
    name: "rentals",
    description: "Active and historical rental records",
    fields: [
      "patientName",
      "productName",
      "monthlyRate",
      "status",
      "nextDueDate",
    ],
  },
  {
    name: "hospicePatients",
    description: "Hospice patient oversight records",
    fields: [
      "patientName",
      "nurseName",
      "nursePhone",
      "insuranceName",
      "status",
    ],
  },
  {
    name: "wipRecords",
    description: "Work-in-progress tasks and bottlenecks",
    fields: [
      "patientName",
      "assignedTo",
      "status",
      "daysOpen",
    ],
  },
  {
    name: "auditLogs",
    description: "Administrative audit trail (actions, actors, timestamps)",
    fields: ["action", "actorEmail", "severity", "createdAt"],
  },
  {
    name: "importJobs",
    description: "File import job status and results",
    fields: [
      "status",
      "fileName",
      "reportType",
      "rowCount",
      "failedRows",
    ],
  },
  {
    name: "insuranceRecords",
    description: "Insurance payer records and status",
    fields: ["insuranceName", "payerName", "status"],
  },
  {
    name: "shopItems",
    description: "Retail shop product items",
    fields: ["name", "sku", "category", "price"],
  },
  {
    name: "shopCostOfGoodsSold",
    description: "Retail cost-of-goods-sold records for financial analytics",
    fields: [
      "itemName",
      "revenue",
      "cost",
      "quantity",
      "grossProfit",
    ],
  },
] as const;

type CollectionName = (typeof EXPOSED_COLLECTIONS)[number]["name"];

export type QueryOptions = {
  collection: CollectionName;
  limit?: number;
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  filters?: Array<{
    field: string;
    operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "array-contains";
    value: string | number | boolean;
  }>;
};

/**
 * Execute a query against Firestore for the ChatGPT bridge.
 * Only allows querying collections listed in EXPOSED_COLLECTIONS.
 * Returns a response-safe object (no Firestore Timestamps — converted to ISO strings).
 */
export async function executeQuery(options: QueryOptions) {
  const { collection, limit = 50, orderByField, orderDirection = "desc", filters } = options;

  const allowedNames = EXPOSED_COLLECTIONS.map((c) => c.name);
  if (!allowedNames.includes(collection)) {
    return { error: `Collection "${collection}" is not exposed to ChatGPT.` };
  }

  try {
    let query: FirebaseFirestore.Query = adminDb.collection(collection);

    if (filters && filters.length > 0) {
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }
    }

    if (orderByField) {
      query = query.orderBy(orderByField, orderDirection);
    }

    query = query.limit(Math.min(limit, 100));

    const snapshot = await query.get();

    const docs = snapshot.docs.map((doc) => {
      const data = doc.data();
      const serialized: Record<string, unknown> = { id: doc.id };

      for (const [key, value] of Object.entries(data)) {
        serialized[key] = serializeValue(value);
      }

      return serialized;
    });

    return {
      collection,
      count: docs.length,
      docs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown query error";
    return { error: message };
  }
}

/**
 * Get a single document by ID from an exposed collection.
 */
export async function getDocument(collection: CollectionName, docId: string) {
  const allowedNames = EXPOSED_COLLECTIONS.map((c) => c.name);
  if (!allowedNames.includes(collection)) {
    return { error: `Collection "${collection}" is not exposed to ChatGPT.` };
  }

  try {
    const snap = await adminDb.collection(collection).doc(docId).get();
    if (!snap.exists) {
      return { error: "Document not found" };
    }

    const data = snap.data()!;
    const serialized: Record<string, unknown> = { id: snap.id };

    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeValue(value);
    }

    return { doc: serialized };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }
}

/**
 * Get a summary/scaffold of all exposed collections: name, description, fields, doc count.
 */
export async function getCollectionsSummary() {
  const results: Array<{
    name: string;
    description: string;
    fields: readonly string[];
    docCount: number;
  }> = [];

  for (const meta of EXPOSED_COLLECTIONS) {
    try {
      const snap = await adminDb.collection(meta.name).limit(1).get();
      results.push({
        name: meta.name,
        description: meta.description,
        fields: meta.fields,
        docCount: snap.size,
      });
    } catch {
      results.push({
        name: meta.name,
        description: meta.description,
        fields: meta.fields,
        docCount: 0,
      });
    }
  }

  return { collections: results };
}

/**
 * Perform a natural-language query via the existing askAdminAi callable function.
 * This requires the Cloud Function to be callable from the server context.
 */
export async function askAi(prompt: string): Promise<{ answer?: string; error?: string }> {
  if (!prompt || prompt.trim().length === 0) {
    return { error: "Prompt is required." };
  }

  if (prompt.length > 4000) {
    return { error: "Prompt exceeds 4000 character limit." };
  }

  try {
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    // Get a custom token for the server-to-function call
    const adminAuthInstance = getAuth();
    const customToken = await adminAuthInstance.createCustomToken("chatgpt-bridge", {
      role: "admin",
    });

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "advanced-home-medical-55772";
    const functionUrl = `https://askAdminAi-${projectId}.cloudfunctions.net/askAdminAi`;

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customToken}`,
      },
      body: JSON.stringify({ data: { prompt: prompt.trim() } }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `AI function returned ${response.status}: ${errorText}` };
    }

    const result = (await response.json()) as {
      result?: { answer?: string };
      error?: { message?: string };
    };

    if (result.error?.message) {
      return { error: result.error.message };
    }

    const answer = result.result?.answer;
    if (!answer) {
      return { error: "AI returned an empty response." };
    }

    return { answer };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }
}

/** Recursively convert Firestore values to JSON-safe primitives. */
function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    // Firestore Timestamp
    if (
      "toDate" in (value as Record<string, unknown>) &&
      typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }

    // Firestore GeoPoint
    if (
      "latitude" in (value as Record<string, unknown>) &&
      "longitude" in (value as Record<string, unknown>)
    ) {
      const gp = value as { latitude: number; longitude: number };
      return { _geo: true, lat: gp.latitude, lng: gp.longitude };
    }

    // Firestore DocumentReference — skip circular reference
    if ("id" in (value as Record<string, unknown>) && "path" in (value as Record<string, unknown>)) {
      return `__ref__:${(value as { path: string }).path}`;
    }

    // Array
    if (Array.isArray(value)) {
      return value.map(serializeValue);
    }

    // Plain object
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = serializeValue(v);
    }
    return result;
  }

  // Primitives: string, number, boolean
  return value;
}
