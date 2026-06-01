import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyDdCH99JeVwSBbeSJ7ejYiUGi3qpNloerE",
  authDomain: "advanced-home-medical-55772.firebaseapp.com",
  projectId: "advanced-home-medical-55772",
  storageBucket: "advanced-home-medical-55772.firebasestorage.app",
  messagingSenderId: "416531467638",
  appId: "1:416531467638:web:2989f8d3e3fdeaf3bffe57",
  measurementId: "G-S4KF4N2EHN",
};

const appCheckSiteKey =
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY ?? "";

const appCheckDebugToken =
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN ?? "";

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfigKeys.length > 0) {
  throw new Error(
    `Missing Firebase config value(s): ${missingConfigKeys.join(", ")}`
  );
}

export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let appCheckStarted = false;

function initAppCheck(): void {
  if (typeof window === "undefined") return;
  if (appCheckStarted) return;

  if (!appCheckSiteKey) {
    console.warn("App Check skipped: missing NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY");
    return;
  }

  if (process.env.NODE_ENV === "development") {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken || true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });

  appCheckStarted = true;

  console.log("App Check initialized");
}

initAppCheck();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("AUTH PERSISTENCE ERROR:", error);
  });
}

export default app;
