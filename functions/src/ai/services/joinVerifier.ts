import type { Firestore } from "firebase-admin/firestore";

import {
  type JoinCountMethod,
  normalizeKeyValue,
  type TargetKeyVerificationInput,
  type ValueJoinVerification,
  verifyValueJoin,
} from "../types/reporting";
import { safeFirestoreId } from "../../imports/utils/hash";

export interface ValueJoinDefinition {
  sourceCollection: string;
  sourceKey: string;
  targetCollection: string;
  targetKey: string;
  scanLimit: number;
  targetLookup: "document_id_from_safe_patient_id" | "field_equality";
}

interface ScannedJoinSide {
  values: unknown[];
  actualCount: number | null;
  countMethod: JoinCountMethod;
  complete: boolean;
  docsRead: number;
}

interface JoinScanCache {
  scans: Map<string, Promise<ScannedJoinSide>>;
  counts: Map<string, Promise<number | null>>;
  targetLookups: Map<string, Promise<TargetKeyVerificationInput>>;
}

export const DEFAULT_VALUE_JOIN_LIMIT = 1000;

export const DEFAULT_VALUE_JOIN_DEFINITIONS: ValueJoinDefinition[] = [
  {
    sourceCollection: "patientAuthorizations",
    sourceKey: "patientId",
    targetCollection: "patients",
    targetKey: "id",
    scanLimit: DEFAULT_VALUE_JOIN_LIMIT,
    targetLookup: "document_id_from_safe_patient_id",
  },
  {
    sourceCollection: "rentals",
    sourceKey: "patientId",
    targetCollection: "patients",
    targetKey: "id",
    scanLimit: DEFAULT_VALUE_JOIN_LIMIT,
    targetLookup: "document_id_from_safe_patient_id",
  },
];

async function getAggregateCount(
  db: Firestore,
  collectionName: string
): Promise<number | null> {
  try {
    const snapshot = await db.collection(collectionName).count().get();
    const count = snapshot.data().count;
    return typeof count === "number" && Number.isFinite(count)
      ? Math.max(0, Math.trunc(count))
      : null;
  } catch {
    return null;
  }
}

function readJoinValue(
  docId: string,
  data: Record<string, unknown>,
  key: string
): unknown {
  if (key === "id") return docId;
  if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
    return data[key];
  }
  if (key === "patientId") {
    return docId;
  }
  return data[key];
}

async function scanJoinSide(
  db: Firestore,
  collectionName: string,
  key: string,
  limit: number,
  cache?: JoinScanCache
): Promise<ScannedJoinSide> {
  const cacheKey = `${collectionName}.${key}.${limit}`;
  const cached = cache?.scans.get(cacheKey);
  if (cached) return cached;

  const sentinelLimit = limit + 1;
  const scanPromise = (async () => {
    let countPromise = cache?.counts.get(collectionName);
    if (!countPromise) {
      countPromise = getAggregateCount(db, collectionName);
      cache?.counts.set(collectionName, countPromise);
    }
    const [snapshot, actualCount] = await Promise.all([
      db.collection(collectionName).select(key).limit(sentinelLimit).get(),
      countPromise,
    ]);

    const docsForComparison = snapshot.docs.slice(0, limit);
    const values = docsForComparison.map((doc) =>
      readJoinValue(doc.id, doc.data(), key)
    );

    return {
      values,
      actualCount,
      countMethod: actualCount === null
        ? ("unavailable" as const)
        : ("aggregate_count" as const),
      complete: snapshot.docs.length <= limit,
      docsRead: snapshot.docs.length,
    };
  })();
  cache?.scans.set(cacheKey, scanPromise);
  return scanPromise;
}

function getCachedAggregateCount(
  db: Firestore,
  collectionName: string,
  cache?: JoinScanCache
): Promise<number | null> {
  let countPromise = cache?.counts.get(collectionName);
  if (!countPromise) {
    countPromise = getAggregateCount(db, collectionName);
    cache?.counts.set(collectionName, countPromise);
  }
  return countPromise;
}

function uniqueNormalizedKeys(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeKeyValue(value))
        .filter((value) => value.length > 0)
    )
  );
}

async function verifyTargetDocumentIds(
  db: Firestore,
  collectionName: string,
  sourceValues: unknown[]
): Promise<TargetKeyVerificationInput> {
  const keys = uniqueNormalizedKeys(sourceValues);
  if (keys.length === 0) {
    return {
      complete: true,
      method: "document_id",
      matchCountsBySourceKey: new Map(),
      recordsRead: 0,
      queryOperations: 0,
      duplicateKeysStructurallyImpossible: true,
    };
  }

  const refs = keys.map((key) =>
    db.collection(collectionName).doc(safeFirestoreId(key, "patient"))
  );
  const snapshots = await db.getAll(...refs);
  const matchCountsBySourceKey = new Map<string, number>();

  keys.forEach((key, index) => {
    matchCountsBySourceKey.set(key, snapshots[index]?.exists ? 1 : 0);
  });

  return {
    complete: true,
    method: "document_id",
    matchCountsBySourceKey,
    recordsRead: refs.length,
    queryOperations: 0,
    duplicateKeysStructurallyImpossible: true,
  };
}

const FIRESTORE_IN_QUERY_LIMIT = 30;

async function verifyTargetFieldEquality(
  db: Firestore,
  collectionName: string,
  targetKey: string,
  sourceValues: unknown[]
): Promise<TargetKeyVerificationInput> {
  const keys = uniqueNormalizedKeys(sourceValues);
  const matchCountsBySourceKey = new Map(keys.map((key) => [key, 0]));
  let recordsRead = 0;
  let queryOperations = 0;

  for (let index = 0; index < keys.length; index += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = keys.slice(index, index + FIRESTORE_IN_QUERY_LIMIT);
    if (chunk.length === 0) continue;

    queryOperations += 1;
    const snapshot = await db
      .collection(collectionName)
      .where(targetKey, "in", chunk)
      .get();
    recordsRead += snapshot.docs.length;

    for (const doc of snapshot.docs) {
      const key = normalizeKeyValue(doc.data()[targetKey]);
      if (!matchCountsBySourceKey.has(key)) continue;
      matchCountsBySourceKey.set(key, (matchCountsBySourceKey.get(key) ?? 0) + 1);
    }
  }

  return {
    complete: true,
    method: "field_equality",
    matchCountsBySourceKey,
    recordsRead,
    queryOperations,
    duplicateKeysStructurallyImpossible: false,
  };
}

async function verifyTargetKeys(
  db: Firestore,
  definition: ValueJoinDefinition,
  sourceValues: unknown[],
  cache?: JoinScanCache
): Promise<TargetKeyVerificationInput> {
  const cacheKey = [
    definition.targetCollection,
    definition.targetKey,
    definition.targetLookup,
    ...uniqueNormalizedKeys(sourceValues).sort(),
  ].join("|");
  const cached = cache?.targetLookups.get(cacheKey);
  if (cached) return cached;

  const lookupPromise =
    definition.targetLookup === "document_id_from_safe_patient_id"
      ? verifyTargetDocumentIds(db, definition.targetCollection, sourceValues)
      : verifyTargetFieldEquality(
          db,
          definition.targetCollection,
          definition.targetKey,
          sourceValues
        );
  cache?.targetLookups.set(cacheKey, lookupPromise);
  return lookupPromise;
}

export async function verifyValueJoinDefinition(
  db: Firestore,
  definition: ValueJoinDefinition,
  cache: JoinScanCache = { scans: new Map(), counts: new Map(), targetLookups: new Map() }
): Promise<ValueJoinVerification> {
  const source = await scanJoinSide(
    db,
    definition.sourceCollection,
    definition.sourceKey,
    definition.scanLimit,
    cache
  );
  const [targetActualCount, targetVerification] = await Promise.all([
    getCachedAggregateCount(db, definition.targetCollection, cache),
    verifyTargetKeys(db, definition, source.values, cache),
  ]);

  return verifyValueJoin(
    {
      collection: definition.sourceCollection,
      key: definition.sourceKey,
      values: source.values,
      actualCount: source.actualCount,
      countMethod: source.countMethod,
      complete: source.complete,
    },
    {
      collection: definition.targetCollection,
      key: definition.targetKey,
      values: [],
      actualCount: targetActualCount,
      countMethod: targetActualCount === null
        ? ("unavailable" as const)
        : ("aggregate_count" as const),
      complete: targetVerification.complete,
    },
    targetVerification
  );
}

export async function verifyDefaultValueJoins(
  db: Firestore,
  definitions: ValueJoinDefinition[] = DEFAULT_VALUE_JOIN_DEFINITIONS
): Promise<ValueJoinVerification[]> {
  const cache: JoinScanCache = { scans: new Map(), counts: new Map(), targetLookups: new Map() };
  return Promise.all(
    definitions.map((definition) =>
      verifyValueJoinDefinition(db, definition, cache)
    )
  );
}

const RELATIONSHIP_EVIDENCE_PATTERN =
  /\b(join|joins|linkage|linked|relationship|relationships|orphan(?:ed|s)?|unmatched|patient\s*id|foreign[- ]key|integrity)\b/i;

export function selectValueJoinDefinitions(
  prompt: string
): ValueJoinDefinition[] {
  if (!RELATIONSHIP_EVIDENCE_PATTERN.test(prompt)) return [];

  const asksForAuthorizations =
    /patient\s*authorizations?|authorizations?/i.test(prompt);
  const asksForRentals = /\brentals?\b/i.test(prompt);

  if (asksForAuthorizations || asksForRentals) {
    return DEFAULT_VALUE_JOIN_DEFINITIONS.filter((definition) =>
      (asksForAuthorizations && definition.sourceCollection === "patientAuthorizations") ||
      (asksForRentals && definition.sourceCollection === "rentals")
    );
  }

  return DEFAULT_VALUE_JOIN_DEFINITIONS;
}
