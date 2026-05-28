// lib/firebase/client.ts

import { getApps, initializeApp } from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

import {
  getFunctions,
} from "firebase/functions";

import {
  getStorage,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDdCH99JeVwSBbeSJ7ejYiUGi3qpNloerE",
  authDomain: "advanced-home-medical-55772.firebaseapp.com",
  projectId: "advanced-home-medical-55772",
  storageBucket: "advanced-home-medical-55772.firebasestorage.app",
  messagingSenderId: "416531467638",
  appId: "1:416531467638:web:2989f8d3e3fdeaf3bffe57",
  measurementId: "G-S4KF4N2EHN"
};

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

export { app };

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);

export const functions = getFunctions(
  app,
  "us-central1",
);