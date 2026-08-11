import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  type App,
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

type ServiceAccountInput = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

type NormalizedServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export class FirebaseAdminInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseAdminInitializationError";
  }
}

const LOCAL_SERVICE_ACCOUNT_PATH_ENV = "FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH";

let adminApp: App | null = null;
let authService: Auth | null = null;
let firestoreService: Firestore | null = null;

function getProjectIdFromFirebaseConfig(): string | undefined {
  const rawConfig = process.env.FIREBASE_CONFIG;
  if (!rawConfig) return undefined;

  try {
    const config = JSON.parse(rawConfig) as { projectId?: unknown; project_id?: unknown };
    const projectId = config.projectId ?? config.project_id;
    return typeof projectId === "string" && projectId.trim()
      ? projectId.trim()
      : undefined;
  } catch {
    throw new FirebaseAdminInitializationError(
      "Invalid FIREBASE_CONFIG JSON for Firebase Admin initialization.",
    );
  }
}

function getConfiguredProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    getProjectIdFromFirebaseConfig()
  );
}

function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function normalizeServiceAccount(
  raw: ServiceAccountInput,
  sourceName: string,
): NormalizedServiceAccount {
  const projectId = raw.project_id ?? raw.projectId ?? "";
  const clientEmail = raw.client_email ?? raw.clientEmail ?? "";
  const privateKey = raw.private_key ?? raw.privateKey ?? "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAdminInitializationError(
      `${sourceName} is missing required Firebase Admin service-account fields.`,
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function parseServiceAccountJson(
  rawJson: string,
  sourceName: string,
): NormalizedServiceAccount {
  try {
    return normalizeServiceAccount(
      JSON.parse(rawJson) as ServiceAccountInput,
      sourceName,
    );
  } catch (error) {
    if (error instanceof FirebaseAdminInitializationError) {
      throw error;
    }

    throw new FirebaseAdminInitializationError(
      `${sourceName} must contain valid Firebase Admin service-account JSON.`,
    );
  }
}

function getServiceAccountFromEnv(): NormalizedServiceAccount | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return parseServiceAccountJson(rawJson, "FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId || clientEmail || privateKey) {
    return normalizeServiceAccount(
      {
        projectId,
        clientEmail,
        privateKey,
      },
      "Firebase Admin environment variables",
    );
  }

  return null;
}

function getServiceAccountFromLocalFile(): NormalizedServiceAccount | null {
  const configuredPath = process.env[LOCAL_SERVICE_ACCOUNT_PATH_ENV];
  if (!configuredPath) return null;

  if (process.env.NODE_ENV === "production") {
    throw new FirebaseAdminInitializationError(
      `${LOCAL_SERVICE_ACCOUNT_PATH_ENV} is local-development only and is refused in production.`,
    );
  }

  const resolvedPath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    configuredPath,
  );
  if (!existsSync(resolvedPath)) {
    throw new FirebaseAdminInitializationError(
      `${LOCAL_SERVICE_ACCOUNT_PATH_ENV} points to a missing Firebase Admin credential file.`,
    );
  }

  return parseServiceAccountJson(
    readFileSync(resolvedPath, "utf8"),
    LOCAL_SERVICE_ACCOUNT_PATH_ENV,
  );
}

function assertLocalFallbackAllowed(): void {
  if (
    process.env[LOCAL_SERVICE_ACCOUNT_PATH_ENV] &&
    process.env.NODE_ENV === "production"
  ) {
    throw new FirebaseAdminInitializationError(
      `${LOCAL_SERVICE_ACCOUNT_PATH_ENV} is local-development only and is refused in production.`,
    );
  }
}

function shouldUseApplicationDefaultCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      process.env.GAE_SERVICE ||
      process.env.FUNCTION_TARGET,
  );
}

export function initializeFirebaseAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  if (getApps().length) {
    adminApp = getApp();
    return adminApp;
  }

  assertLocalFallbackAllowed();

  if (shouldUseApplicationDefaultCredentials()) {
    const projectId = getConfiguredProjectId();
    adminApp = initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
    return adminApp;
  }

  const envServiceAccount = getServiceAccountFromEnv();
  if (envServiceAccount) {
    adminApp = initializeApp({
      credential: cert(envServiceAccount),
      projectId: envServiceAccount.projectId,
    });
    return adminApp;
  }

  const localServiceAccount = getServiceAccountFromLocalFile();
  if (localServiceAccount) {
    adminApp = initializeApp({
      credential: cert(localServiceAccount),
      projectId: localServiceAccount.projectId,
    });
    return adminApp;
  }

  throw new FirebaseAdminInitializationError(
    "Firebase Admin credentials are not configured. Use Application Default Credentials in the deployment runtime, set FIREBASE_SERVICE_ACCOUNT_JSON, or set FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH for local development only.",
  );
}

function getAdminAuth(): Auth {
  authService ??= getAuth(initializeFirebaseAdminApp());
  return authService;
}

function getAdminFirestore(): Firestore {
  firestoreService ??= getFirestore(initializeFirebaseAdminApp());
  return firestoreService;
}

function createLazyServiceProxy<T extends object>(getService: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const service = getService();
      const value = service[property as keyof T];
      return typeof value === "function" ? value.bind(service) : value;
    },
  });
}

export const adminAuth = createLazyServiceProxy(getAdminAuth);
export const adminDb = createLazyServiceProxy(getAdminFirestore);
