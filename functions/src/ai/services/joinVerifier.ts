import type { Firestore } from "firebase-admin/firestore";

import {
  type JoinCountMethod,
  type ValueJoinVerification,
  verifyValueJoin,
} from "../types/reporting";

export interface ValueJoinDefinition {
  sourceCollection: string;
  sourceKey: string;
  targetCollection: string;
  targetKey: string;
  scanLimit: number;
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
}

export const DEFAULT_VALUE_JOIN_LIMIT = 1000;

export const DEFAULT_VALUE_JOIN_DEFINITIONS: ValueJoinDefinition[] = [
  {
    sourceCollection: "patientAuthorizations",
    sourceKey: "patientId",
    targetCollection: "patients",
    targetKey: "patientId",
    scanLimit: DEFAULT_VALUE_JOIN_LIMIT,
  },
  {
    sourceCollection: "rentals",
    sourceKey: "patientId",
    targetCollection: "patients",
    targetKey: "patientId",
    scanLimit: DEFAULT_VALUE_JOIN_LIMIT,
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

export async function verifyValueJoinDefinition(
  db: Firestore,
  definition: ValueJoinDefinition,
  cache: JoinScanCache = { scans: new Map(), counts: new Map() }
): Promise<ValueJoinVerification> {
  const [source, target] = await Promise.all([
    scanJoinSide(
      db,
      definition.sourceCollection,
      definition.sourceKey,
      definition.scanLimit,
      cache
    ),
    scanJoinSide(
      db,
      definition.targetCollection,
      definition.targetKey,
      definition.scanLimit,
      cache
    ),
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
      values: target.values,
      actualCount: target.actualCount,
      countMethod: target.countMethod,
      complete: target.complete,
    }
  );
}

export async function verifyDefaultValueJoins(
  db: Firestore,
  definitions: ValueJoinDefinition[] = DEFAULT_VALUE_JOIN_DEFINITIONS
): Promise<ValueJoinVerification[]> {
  const cache: JoinScanCache = { scans: new Map(), counts: new Map() };
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
