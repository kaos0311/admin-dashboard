import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:
    "AIzaSyDdCH99JeVwSBbeSJ7ejYiUGi3qpNloerE",

  authDomain:
    "advanced-home-medical-55772.firebaseapp.com",

  projectId:
    "advanced-home-medical-55772",

  storageBucket:
    "advanced-home-medical-55772.firebasestorage.app",

  messagingSenderId: "416531467638",

  appId:
    "1:416531467638:web:2989f8d3e3fdeaf3bffe57",

  measurementId: "G-S4KF4N2EHN",
};

const missingConfigKeys = Object.entries(
  firebaseConfig
)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfigKeys.length > 0) {
  throw new Error(
    `Missing Firebase config value(s): ${missingConfigKeys.join(
      ", "
    )}`
  );
}

const app: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

/*
|--------------------------------------------------------------------------
| FIRESTORE
|--------------------------------------------------------------------------
|
| initializeFirestore prevents duplicate internal cache creation
| issues that can trigger Firestore 12.x assertion failures.
|
*/

const db =
  getApps().length > 0
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager:
            persistentMultipleTabManager(),
        }),
      });

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

const auth = getAuth(app);

if (typeof window !== "undefined") {
  void setPersistence(
    auth,
    browserLocalPersistence
  ).catch((error: unknown) => {
    console.error(
      "AUTH PERSISTENCE ERROR:",
      error
    );
  });
}

/*
|--------------------------------------------------------------------------
| STORAGE + FUNCTIONS
|--------------------------------------------------------------------------
*/

const storage = getStorage(app);

const functions = getFunctions(
  app,
  "us-central1"
);

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

export {
  app,
  auth,
  db,
  storage,
  functions,
};

export default app;