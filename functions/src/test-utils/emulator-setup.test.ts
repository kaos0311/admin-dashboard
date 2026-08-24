import { describe, expect, it } from "vitest";

import {
  assertNoProductionCredentialEnv,
  DEFAULT_EMULATOR_PROJECT_ID,
  findRepositoryServiceAccountFiles,
  getEmulatorProjectId,
  requireEmulatorEnv,
} from "./emulator-setup";

const validEnv = {
  FIRESTORE_EMULATOR_HOST: "localhost:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
  GCLOUD_PROJECT: DEFAULT_EMULATOR_PROJECT_ID,
};

describe("emulator safety setup", () => {
  it("accepts credential-free local emulator configuration", () => {
    expect(() => requireEmulatorEnv({ ...validEnv })).not.toThrow();
    expect(getEmulatorProjectId({ ...validEnv })).toBe(DEFAULT_EMULATOR_PROJECT_ID);
  });

  it("fails when required emulator hosts are missing", () => {
    expect(() =>
      requireEmulatorEnv({
        FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
        GCLOUD_PROJECT: DEFAULT_EMULATOR_PROJECT_ID,
      })
    ).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it("rejects nonlocal emulator hosts", () => {
    expect(() =>
      requireEmulatorEnv({
        ...validEnv,
        FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com",
      })
    ).toThrow(/local emulator host/);
  });

  it("rejects production project IDs", () => {
    expect(() =>
      requireEmulatorEnv({
        ...validEnv,
        GCLOUD_PROJECT: "advanced-home-medical-55772",
      })
    ).toThrow(/demo-\*/);
  });

  it("blocks production credential environment variables without leaking values", () => {
    const secretPath = "C:\\secret\\service-account.json";

    expect(() =>
      assertNoProductionCredentialEnv({
        ...validEnv,
        GOOGLE_APPLICATION_CREDENTIALS: secretPath,
      })
    ).toThrow("GOOGLE_APPLICATION_CREDENTIALS must not be set for emulator tests.");
  });

  it("allows external credentials only when explicitly requested", () => {
    expect(() =>
      assertNoProductionCredentialEnv({
        ...validEnv,
        ALLOW_EXTERNAL_CREDENTIALS_FOR_EMULATOR_TESTS: "true",
        GOOGLE_APPLICATION_CREDENTIALS:
          "C:\\Users\\pboyl\\.firebase-credentials\\advanced-home-medical-service-account.json",
      })
    ).not.toThrow();
  });

  it("detects repository-local service account files", () => {
    expect(
      findRepositoryServiceAccountFiles(
        ["D:\\projects\\admin-dashboard\\serviceAccountKey.json"],
        () => true
      )
    ).toEqual(["D:\\projects\\admin-dashboard\\serviceAccountKey.json"]);
  });
});
