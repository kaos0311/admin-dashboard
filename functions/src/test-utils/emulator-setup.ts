/**
 * Emulator test setup for Firestore integration tests.
 *
 * Emulator tests are credential-free. They must run against local emulator
 * hosts and an isolated demo project ID, and they must fail before any test
 * can accidentally connect to production Firebase services.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";

export const DEFAULT_EMULATOR_PROJECT_ID = "demo-advanced-home-medical";

export type EmulatorEnv = NodeJS.ProcessEnv;

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]|::1):\d+$/;
const REPOSITORY_ROOT = resolve(__dirname, "../../..");
const EXTERNAL_CREDENTIAL_FLAG = "ALLOW_EXTERNAL_CREDENTIALS_FOR_EMULATOR_TESTS";

function envValue(env: EmulatorEnv, name: string): string | undefined {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireLocalHost(env: EmulatorEnv, name: string): string {
  const value = envValue(env, name);
  if (!value) {
    throw new Error(`${name} is required for emulator tests.`);
  }

  if (!LOCAL_HOST_RE.test(value)) {
    throw new Error(`${name} must point to a local emulator host.`);
  }

  return value;
}

function pathIsInsideRepository(filePath: string): boolean {
  const resolved = resolve(filePath);
  return (
    resolved === REPOSITORY_ROOT ||
    resolved.startsWith(`${REPOSITORY_ROOT}\\`) ||
    resolved.startsWith(`${REPOSITORY_ROOT}/`)
  );
}

export function getEmulatorProjectId(env: EmulatorEnv = process.env): string {
  const projectId = envValue(env, "GCLOUD_PROJECT");
  if (!projectId) {
    throw new Error("GCLOUD_PROJECT is required for emulator tests.");
  }

  if (!projectId.startsWith("demo-")) {
    throw new Error("GCLOUD_PROJECT must use an isolated demo-* project ID for emulator tests.");
  }

  return projectId;
}

export function requireEmulatorEnv(env: EmulatorEnv = process.env): void {
  requireLocalHost(env, "FIRESTORE_EMULATOR_HOST");
  requireLocalHost(env, "FIREBASE_AUTH_EMULATOR_HOST");

  const storageHost = envValue(env, "FIREBASE_STORAGE_EMULATOR_HOST");
  if (storageHost && !LOCAL_HOST_RE.test(storageHost)) {
    throw new Error("FIREBASE_STORAGE_EMULATOR_HOST must point to a local emulator host.");
  }

  getEmulatorProjectId(env);
}

export function assertNoProductionCredentialEnv(env: EmulatorEnv = process.env): void {
  const blockedCredentialEnv = [
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];

  for (const name of blockedCredentialEnv) {
    if (envValue(env, name)) {
      throw new Error(`${name} must not be set for emulator tests.`);
    }
  }

  const googleCredentials = envValue(env, "GOOGLE_APPLICATION_CREDENTIALS");
  if (!googleCredentials) return;

  if (envValue(env, EXTERNAL_CREDENTIAL_FLAG) !== "true") {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS must not be set for emulator tests.");
  }

  if (pathIsInsideRepository(googleCredentials)) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS must be outside the repository for emulator tests.");
  }
}

export function assertNoRepositoryServiceAccountFiles(): void {
  const pathsToCheck = [
    resolve(REPOSITORY_ROOT, "serviceAccountKey.json"),
    resolve(REPOSITORY_ROOT, "functions", "serviceAccountKey.json"),
  ];

  const found = findRepositoryServiceAccountFiles(pathsToCheck, existsSync);
  if (found.length > 0) {
    throw new Error(
      `Repository-local service account file found at ${found[0]}. Move it outside the repository before running emulator tests.`
    );
  }
}

export function findRepositoryServiceAccountFiles(
  pathsToCheck: string[],
  fileExists: (filePath: string) => boolean,
): string[] {
  return pathsToCheck.filter((filePath) => fileExists(filePath));
}

/**
 * Verify no production credentials are loaded.
 * Call this at the top of every integration test file.
 */
export function assertNoProductionCredentials(env: EmulatorEnv = process.env): void {
  assertNoProductionCredentialEnv(env);
  assertNoRepositoryServiceAccountFiles();
}

export function validateEmulatorSafety(env: EmulatorEnv = process.env): void {
  requireEmulatorEnv(env);
  assertNoProductionCredentials(env);
}

/**
 * Clear all Firestore emulator data between tests.
 * Uses the Firestore emulator REST API to delete all documents.
 */
export async function clearEmulatorData(): Promise<void> {
  const db = getFirestore();

  const collections = [
    "auditLogs",
    "domainWorkflowOperations",
    "inventory",
    "inventoryOperations",
    "inventoryGroupingRiskReviews",
    "inventoryTransactions",
    "orders",
    "patients",
    "products",
    "rateLimitBuckets",
    "rentals",
    "users",
  ];

  for (const collectionId of collections) {
    const snapshot = await db.collection(collectionId).get();
    const deletes = snapshot.docs.map((docSnap) => docSnap.ref.delete());
    await Promise.all(deletes);
  }
}

/** Default emulator ports used by this test suite. */
export const EMULATOR_PORTS = {
  firestore: 8085,
  auth: 9099,
} as const;

export function getFirestoreEmulatorHost(): { host: string; port: number } {
  const value = process.env.FIRESTORE_EMULATOR_HOST;
  if (!value) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required for emulator tests.");
  }

  const [host, rawPort] = value.split(":");
  const port = Number(rawPort);
  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new Error("FIRESTORE_EMULATOR_HOST must be formatted as host:port.");
  }

  return { host, port };
}
