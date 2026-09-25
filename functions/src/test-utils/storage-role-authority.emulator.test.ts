/**
 * Storage emulator tests proving profile-authoritative role policy.
 *
 * These tests use existing Storage paths:
 *   - reports/{file}: staff/admin read and CSV upload
 *   - generated-reports/{file}: staff/admin read
 *   - ai-generated/{file}: admin-only delete
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import type firebase from "firebase/compat/app";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
  EMULATOR_PORTS,
  validateEmulatorSafety,
} from "./emulator-setup.js";

const PROJECT_ID = "demo-advanced-home-medical";
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`;
const REPORT_PATH = "reports/authority/report.csv";
const GENERATED_REPORT_PATH = "generated-reports/authority/summary.json";
const ADMIN_ONLY_DELETE_PATH = "ai-generated/authority/admin-note.txt";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  validateEmulatorSafety();

  const firestoreRules = readFileSync(
    resolve(__dirname, "../../../firestore.rules"),
    "utf8",
  );
  const storageRules = readFileSync(
    resolve(__dirname, "../../../storage.rules"),
    "utf8",
  );

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: "127.0.0.1",
      port: EMULATOR_PORTS.firestore,
    },
    storage: {
      rules: storageRules,
      host: "127.0.0.1",
      port: EMULATOR_PORTS.storage,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

async function seedProfile(
  uid: string,
  data: Record<string, unknown>,
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("users").doc(uid).set({
      role: "staff",
      active: true,
      disabled: false,
      deleted: false,
      ...data,
    });
  });
}

async function seedObject(
  path: string,
  contentType = "text/plain",
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context
      .storage(BUCKET_URL)
      .ref(path)
      .putString("seed", "raw", { contentType });
  });
}

function storageFor(uid: string, claims: Record<string, unknown>) {
  return testEnv.authenticatedContext(uid, claims).storage(BUCKET_URL);
}

function reportUpload(storage: firebase.storage.Storage) {
  return Promise.resolve(
    storage
      .ref(REPORT_PATH)
      .putString("Patient,Order\nJane Example,SO-1\n", "raw", {
        contentType: "text/csv",
      }),
  );
}

function readGeneratedReport(storage: firebase.storage.Storage) {
  return storage.ref(GENERATED_REPORT_PATH).getMetadata();
}

function deleteAdminOnlyObject(storage: firebase.storage.Storage) {
  return storage.ref(ADMIN_ONLY_DELETE_PATH).delete();
}

describe("Storage rules - profile-authoritative role policy", () => {
  it("permits ACTIVE ADMIN PROFILE where Storage policy allows admin", async () => {
    await seedProfile("uid-admin", { role: "admin" });
    await seedObject(GENERATED_REPORT_PATH, "application/json");
    await seedObject(ADMIN_ONLY_DELETE_PATH);

    const storage = storageFor("uid-admin", { role: "admin" });

    await assertSucceeds(readGeneratedReport(storage));
    await assertSucceeds(reportUpload(storage));
    await assertSucceeds(deleteAdminOnlyObject(storage));
  });

  it("permits ACTIVE STAFF PROFILE where Storage policy allows staff", async () => {
    await seedProfile("uid-staff", { role: "staff" });
    await seedObject(GENERATED_REPORT_PATH, "application/json");

    const storage = storageFor("uid-staff", { role: "staff" });

    await assertSucceeds(readGeneratedReport(storage));
    await assertSucceeds(reportUpload(storage));
  });

  it("denies ADMIN CLAIM + MISSING PROFILE", async () => {
    await seedObject(GENERATED_REPORT_PATH, "application/json");

    const storage = storageFor("uid-missing", { role: "admin" });

    await assertFails(readGeneratedReport(storage));
    await assertFails(reportUpload(storage));
  });

  it("denies ADMIN CLAIM + DISABLED PROFILE", async () => {
    await seedProfile("uid-disabled", { role: "admin", disabled: true });
    await seedObject(GENERATED_REPORT_PATH, "application/json");
    await seedObject(ADMIN_ONLY_DELETE_PATH);

    const storage = storageFor("uid-disabled", { role: "admin" });

    await assertFails(readGeneratedReport(storage));
    await assertFails(deleteAdminOnlyObject(storage));
  });

  it("denies ADMIN CLAIM + DELETED PROFILE", async () => {
    await seedProfile("uid-deleted", { role: "admin", deleted: true });
    await seedObject(GENERATED_REPORT_PATH, "application/json");

    const storage = storageFor("uid-deleted", { role: "admin" });

    await assertFails(readGeneratedReport(storage));
  });

  it("denies ADMIN CLAIM + INACTIVE PROFILE", async () => {
    await seedProfile("uid-inactive", { role: "admin", active: false });
    await seedObject(GENERATED_REPORT_PATH, "application/json");

    const storage = storageFor("uid-inactive", { role: "admin" });

    await assertFails(readGeneratedReport(storage));
  });

  it("limits ADMIN CLAIM + STAFF PROFILE to staff authority only", async () => {
    await seedProfile("uid-stale-admin", { role: "staff" });
    await seedObject(GENERATED_REPORT_PATH, "application/json");
    await seedObject(ADMIN_ONLY_DELETE_PATH);

    const storage = storageFor("uid-stale-admin", { role: "admin" });

    await assertSucceeds(readGeneratedReport(storage));
    await assertSucceeds(reportUpload(storage));
    await assertFails(deleteAdminOnlyObject(storage));
  });

  it("grants STAFF CLAIM + ADMIN PROFILE admin authority according to profile", async () => {
    await seedProfile("uid-staff-claim-admin-profile", { role: "admin" });
    await seedObject(ADMIN_ONLY_DELETE_PATH);

    const storage = storageFor("uid-staff-claim-admin-profile", {
      role: "staff",
    });

    await assertSucceeds(deleteAdminOnlyObject(storage));
  });

  it("denies stale admin claim admin-only access immediately after profile downgrade", async () => {
    await seedProfile("uid-downgrade", { role: "admin" });
    await seedObject(GENERATED_REPORT_PATH, "application/json");
    await seedObject(ADMIN_ONLY_DELETE_PATH);

    const storage = storageFor("uid-downgrade", { role: "admin" });

    await seedProfile("uid-downgrade", { role: "staff" });

    await assertSucceeds(readGeneratedReport(storage));
    await assertFails(deleteAdminOnlyObject(storage));
  });

  it("denies stale admin claim immediately after profile disable", async () => {
    await seedProfile("uid-disable", { role: "admin" });
    await seedObject(GENERATED_REPORT_PATH, "application/json");

    const storage = storageFor("uid-disable", { role: "admin" });

    await seedProfile("uid-disable", { role: "admin", disabled: true });

    await assertFails(readGeneratedReport(storage));
    await assertFails(reportUpload(storage));
  });
});
