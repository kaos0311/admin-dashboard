import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Lightweight Firebase connectivity probe for the /api/health endpoint.
 *
 * Safety constraints:
 * - READ-ONLY: never writes a document anywhere.
 * - TIMEOUT: bounded by a 5 s Promise.race so a stalled Firestore connection
 *   cannot hang the health route.
 * - CACHE: results are cached for 30 s to avoid hot-probing Firestore.
 * - FAIL-OPEN: any failure (timeout, permission, network) is converted to
 *   `healthy: false` — this function never throws.
 * - NO INFRASTRUCTURE LEAK: the returned payload contains only booleans and
 *   latency — no project id, hostname, credential, or configuration detail.
 */

const PROBE_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 30_000;

export type FirebaseProbeResult = {
  healthy: boolean;
  latencyMs?: number;
  checkedAt: string; // ISO timestamp
};

let cachedResult: FirebaseProbeResult | null = null;
let cacheExpiresAt = 0;

async function runProbe(): Promise<FirebaseProbeResult> {
  const startedAt = Date.now();

  const read = adminDb
    .collection("_healthProbe")
    .doc("probe")
    .get()
    .then(() => undefined);

  // Unref the timer so a fast Firestore reply does not keep the serverless
  // process alive waiting on the timeout.
  const timeout = new Promise<"timeout">((resolve) => {
    const handle = setTimeout(() => resolve("timeout"), PROBE_TIMEOUT_MS);
    handle.unref();
  });

  const outcome = await Promise.race([read, timeout]);
  const latencyMs = Date.now() - startedAt;

  if (outcome === "timeout") {
    return { healthy: false, latencyMs, checkedAt: new Date().toISOString() };
  }

  // A successful get() — regardless of whether the doc exists — proves
  // Firebase Admin connectivity.
  return { healthy: true, latencyMs, checkedAt: new Date().toISOString() };
}

export async function checkFirebaseHealth(): Promise<FirebaseProbeResult> {
  const now = Date.now();

  if (cachedResult && now < cacheExpiresAt) {
    return cachedResult;
  }

  try {
    cachedResult = await runProbe();
  } catch {
    cachedResult = {
      healthy: false,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  }

  return cachedResult;
}
