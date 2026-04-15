import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDdCH99JeVwSBbeSJ7ejYiUGi3qpNloerE",
  authDomain: "advanced-home-medical-55772.firebaseapp.com",
  projectId: "advanced-home-medical-55772",
  storageBucket: "advanced-home-medical-55772.firebasestorage.app",
  messagingSenderId: "416531467638",
  appId: "1:416531467638:web:2989f8d3e3fdeaf3bffe57",
  measurementId: "G-S4KF4N2EHN"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);