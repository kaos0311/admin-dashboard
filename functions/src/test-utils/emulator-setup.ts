/**
 * Emulator test setup for Firestore integration tests.
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set (e.g. "localhost:8080")
 *   - FIREBASE_AUTH_EMULATOR_HOST must be set (e.g. "localhost:9099")
 *   - GCLOUD_PROJECT must be set (e.g. "advanced-home-medical-55772")
 *   - FIRESTORE_EMULATOR_HOST must not point to production
 *
 * This module FAILS FAST if any of these are missing — it never
 * silently falls back to production credentials.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Validate that emulator environment is properly configured. */
export function requireEmulatorEnv(): void {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT;

  if (!firestoreHost) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. " +
      "Integration tests require a running Firestore emulator. " +
      "Run: firebase emulators:exec --only firestore,auth 'npm run test:integration'"
    );
  }

  if (!authHost) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST is not set. " +
      "Integration tests require a running Auth emulator."
    );
  }

  if (!projectId) {
    throw new Error(
      "GCLOUD_PROJECT is not set. " +
      "Set it to your Firebase project ID (e.g. advanced-home-medical-55772)."
    );
  }

  // Safety check: ensure we're NOT pointing at production
  if (
    firestoreHost !== "localhost:8080" &&
    !firestoreHost.includes("localhost") &&
    !firestoreHost.includes("127.0.0.1")
  ) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST is set to "${firestoreHost}" which does not look ` +
      "like a local emulator. Refusing to run integration tests against a non-local target."
    );
  }

  // Check for service account key file in the functions directory
  const serviceAccountPath = resolve(__dirname, "../../serviceAccountKey.json");
  if (existsSync(serviceAccountPath)) {
    throw new Error(
      "serviceAccountKey.json found in functions directory. " +
      "Remove it before running integration tests. " +
      "Emulator tests must never load production credentials."
    );
  }

  console.log("[emulator-setup] Emulator environment validated:");
  console.log(`  FIRESTORE_EMULATOR_HOST=${firestoreHost}`);
  console.log(`  FIREBASE_AUTH_EMULATOR_HOST=${authHost}`);
  console.log(`  GCLOUD_PROJECT=${projectId}`);
  console.log(`  serviceAccountKey.json: NOT PRESENT (safe)`);
}

/**
 * Clear all Firestore emulator data between tests.
 * Uses the Firestore emulator REST API to delete all documents.
 */
export async function clearEmulatorData(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
  const projectId = process.env.GCLOUD_PROJECT || "advanced-home-medical-55772";

  const collections = [
    "inventory",
    "inventoryTransactions",
    "inventoryOperations",
    "auditLogs",
    "users",
  ];

  for (const collectionId of collections) {
    const url = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/${collectionId}`;

    try {
      // Get all document IDs in the collection
      const response = await fetch(url);
      if (!response.ok) continue; // Collection may not exist

      const body = (await response.json()) as { documents?: Array<{ name: string }> };
      if (!body.documents) continue;

      for (const doc of body.documents) {
        const docName = doc.name;
        const deleteUrl = `http://${host}/v1/${docName}`;
        await fetch(deleteUrl, { method: "DELETE" });
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Verify no production credentials are loaded.
 * Call this at the top of every integration test file.
 */
export function assertNoProductionCredentials(): void {
  // Check env vars
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is set. " +
      "Integration tests must not use production credentials."
    );
  }

  // Check for service account files in common locations
  const pathsToCheck = [
    resolve(__dirname, "../../serviceAccountKey.json"),
    resolve(__dirname, "../../../serviceAccountKey.json"),
  ];

  for (const filePath of pathsToCheck) {
    if (existsSync(filePath)) {
      throw new Error(
        `Production service account file found at ${filePath}. Remove it before running integration tests.`
      );
    }
  }
}

/** Default emulator ports used by this test suite. */
export const EMULATOR_PORTS = {
  firestore: 8080,
  auth: 9099,
} as const;
