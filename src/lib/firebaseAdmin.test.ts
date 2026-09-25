import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockState = {
  apps: unknown[];
  applicationDefault: ReturnType<typeof vi.fn>;
  cert: ReturnType<typeof vi.fn>;
  getApp: ReturnType<typeof vi.fn>;
  getApps: ReturnType<typeof vi.fn>;
  getAuth: ReturnType<typeof vi.fn>;
  getFirestore: ReturnType<typeof vi.fn>;
  initializeApp: ReturnType<typeof vi.fn>;
};

const ORIGINAL_ENV = { ...process.env };

let mockState: MockState;
let tempDirs: string[] = [];

function resetCredentialEnv(): void {
  delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_CONFIG;
  delete process.env.FIREBASE_PRIVATE_KEY;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.FUNCTION_TARGET;
  delete process.env.GAE_SERVICE;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.K_SERVICE;
}

function installFirebaseAdminMocks(apps: unknown[] = []): MockState {
  const app = { name: "initialized-admin-app" };
  const existingApp = { name: "existing-admin-app" };

  mockState = {
    apps,
    applicationDefault: vi.fn(() => ({ credentialType: "adc" })),
    cert: vi.fn((serviceAccount: unknown) => ({
      credentialType: "cert",
      serviceAccount,
    })),
    getApp: vi.fn(() => apps[0] ?? existingApp),
    getApps: vi.fn(() => apps),
    getAuth: vi.fn(() => ({ service: "auth" })),
    getFirestore: vi.fn(() => ({ service: "firestore" })),
    initializeApp: vi.fn(() => app),
  };

  vi.doMock("firebase-admin/app", () => ({
    applicationDefault: mockState.applicationDefault,
    cert: mockState.cert,
    getApp: mockState.getApp,
    getApps: mockState.getApps,
    initializeApp: mockState.initializeApp,
  }));

  vi.doMock("firebase-admin/auth", () => ({
    getAuth: mockState.getAuth,
  }));

  vi.doMock("firebase-admin/firestore", () => ({
    getFirestore: mockState.getFirestore,
  }));

  return mockState;
}

async function importFirebaseAdminModule(): Promise<
  typeof import("./firebaseAdmin")
> {
  return import("./firebaseAdmin");
}

function writeServiceAccountFile(data: Record<string, unknown>): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "firebase-admin-test-"));
  tempDirs.push(tempDir);
  const filePath = path.join(tempDir, "service-account.json");
  writeFileSync(filePath, JSON.stringify(data), "utf8");
  return filePath;
}

describe("firebaseAdmin initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    resetCredentialEnv();
    vi.stubEnv("NODE_ENV", "test");
    tempDirs = [];
  });

  afterEach(() => {
    vi.doUnmock("firebase-admin/app");
    vi.doUnmock("firebase-admin/auth");
    vi.doUnmock("firebase-admin/firestore");
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };

    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reuses an existing Admin app", async () => {
    const existingApp = { name: "already-initialized" };
    const mocks = installFirebaseAdminMocks([existingApp]);

    const firebaseAdminModule = await importFirebaseAdminModule();
    expect(firebaseAdminModule.initializeFirebaseAdminApp()).toBe(existingApp);
    expect((firebaseAdminModule.adminAuth as unknown as { service: string }).service).toBe(
      "auth",
    );
    expect((firebaseAdminModule.adminDb as unknown as { service: string }).service).toBe(
      "firestore",
    );

    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.getApp).toHaveBeenCalled();
    expect(mocks.getAuth).toHaveBeenCalledWith(existingApp);
    expect(mocks.getFirestore).toHaveBeenCalledWith(existingApp);
  });

  it("uses Application Default Credentials when configured", async () => {
    const mocks = installFirebaseAdminMocks();
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "configured-adc.json";
    process.env.GOOGLE_CLOUD_PROJECT = "project-from-adc";

    const firebaseAdminModule = await importFirebaseAdminModule();
    firebaseAdminModule.initializeFirebaseAdminApp();

    expect(mocks.applicationDefault).toHaveBeenCalled();
    expect(mocks.cert).not.toHaveBeenCalled();
    expect(mocks.initializeApp).toHaveBeenCalledWith({
      credential: { credentialType: "adc" },
      projectId: "project-from-adc",
    });
  });

  it("returns the same app on repeated initialization", async () => {
    const mocks = installFirebaseAdminMocks();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "env-project",
      client_email: "admin@example.com",
      private_key: "private-key",
    });

    const firebaseAdminModule = await importFirebaseAdminModule();
    const first = firebaseAdminModule.initializeFirebaseAdminApp();
    const second = firebaseAdminModule.initializeFirebaseAdminApp();

    expect(first).toBe(second);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("does not create duplicate apps during concurrent initialization calls", async () => {
    const mocks = installFirebaseAdminMocks();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "env-project",
      client_email: "admin@example.com",
      private_key: "private-key",
    });

    const firebaseAdminModule = await importFirebaseAdminModule();
    const apps = await Promise.all([
      Promise.resolve().then(() => firebaseAdminModule.initializeFirebaseAdminApp()),
      Promise.resolve().then(() => firebaseAdminModule.initializeFirebaseAdminApp()),
      Promise.resolve().then(() => firebaseAdminModule.initializeFirebaseAdminApp()),
    ]);

    expect(new Set(apps).size).toBe(1);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("retries lazy service access after initialization failure", async () => {
    const mocks = installFirebaseAdminMocks();

    const firebaseAdminModule = await importFirebaseAdminModule();
    expect(() => {
      void (firebaseAdminModule.adminAuth as unknown as { service: string }).service;
    }).toThrowError(
      expect.objectContaining({
        name: "FirebaseAdminInitializationError",
      }),
    );

    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "env-project",
      client_email: "admin@example.com",
      private_key: "private-key",
    });

    expect((firebaseAdminModule.adminAuth as unknown as { service: string }).service).toBe(
      "auth",
    );
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("uses explicit service-account JSON from the environment", async () => {
    const mocks = installFirebaseAdminMocks();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "env-project",
      client_email: "admin@example.com",
      private_key: "line-1\\nline-2",
    });

    const firebaseAdminModule = await importFirebaseAdminModule();
    firebaseAdminModule.initializeFirebaseAdminApp();

    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: "env-project",
      clientEmail: "admin@example.com",
      privateKey: "line-1\nline-2",
    });
    expect(mocks.initializeApp).toHaveBeenCalledWith({
      credential: expect.objectContaining({ credentialType: "cert" }),
      projectId: "env-project",
    });
  });

  it("uses explicit discrete service-account environment variables", async () => {
    const mocks = installFirebaseAdminMocks();
    process.env.FIREBASE_PROJECT_ID = "discrete-project";
    process.env.FIREBASE_CLIENT_EMAIL = "admin@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "private-key";

    const firebaseAdminModule = await importFirebaseAdminModule();
    firebaseAdminModule.initializeFirebaseAdminApp();

    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: "discrete-project",
      clientEmail: "admin@example.com",
      privateKey: "private-key",
    });
  });

  it("throws a controlled error when credentials are missing", async () => {
    installFirebaseAdminMocks();

    const firebaseAdminModule = await importFirebaseAdminModule();

    expect(() => firebaseAdminModule.initializeFirebaseAdminApp()).toThrowError(
      expect.objectContaining({
        name: "FirebaseAdminInitializationError",
        message: expect.stringContaining(
          "Firebase Admin credentials are not configured",
        ),
      }),
    );
  });

  it("throws a controlled error for invalid credential JSON without leaking the value", async () => {
    installFirebaseAdminMocks();
    const secretValue = "very-sensitive-private-key";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = `{ "private_key": "${secretValue}"`;

    const firebaseAdminModule = await importFirebaseAdminModule();

    try {
      firebaseAdminModule.initializeFirebaseAdminApp();
      throw new Error("Expected Firebase Admin initialization to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("FirebaseAdminInitializationError");
      expect((error as Error).message).toBe(
        "FIREBASE_SERVICE_ACCOUNT_JSON must contain valid Firebase Admin service-account JSON.",
      );
      expect((error as Error).message).not.toContain(secretValue);
    }
  });

  it("refuses local file fallback in production", async () => {
    installFirebaseAdminMocks();
    vi.stubEnv("NODE_ENV", "production");
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH = "serviceAccountKey.json";

    const firebaseAdminModule = await importFirebaseAdminModule();

    expect(() => firebaseAdminModule.initializeFirebaseAdminApp()).toThrowError(
      expect.objectContaining({
        name: "FirebaseAdminInitializationError",
        message: expect.stringContaining("refused in production"),
      }),
    );
  });

  it("uses explicit local-development file fallback outside production", async () => {
    const mocks = installFirebaseAdminMocks();
    const filePath = writeServiceAccountFile({
      project_id: "local-project",
      client_email: "local@example.com",
      private_key: "local-key",
    });
    vi.stubEnv("NODE_ENV", "development");
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH = filePath;

    const firebaseAdminModule = await importFirebaseAdminModule();
    firebaseAdminModule.initializeFirebaseAdminApp();

    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: "local-project",
      clientEmail: "local@example.com",
      privateKey: "local-key",
    });
  });

  it("fails clearly when the explicit local file is missing", async () => {
    installFirebaseAdminMocks();
    vi.stubEnv("NODE_ENV", "development");
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH = "missing-admin-key.json";

    const firebaseAdminModule = await importFirebaseAdminModule();

    expect(() => firebaseAdminModule.initializeFirebaseAdminApp()).toThrowError(
      expect.objectContaining({
        name: "FirebaseAdminInitializationError",
        message: expect.stringContaining("points to a missing"),
      }),
    );
  });
});

