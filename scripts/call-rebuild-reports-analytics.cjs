require("dotenv").config({ path: ".env.local" });
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD first.");
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const functions = getFunctions(app, "us-central1");

  await signInWithEmailAndPassword(auth, email, password);

  const rebuildReportsAnalytics = httpsCallable(
    functions,
    "rebuildReportsAnalytics"
  );

  const result = await rebuildReportsAnalytics({});

  console.log("Rebuild result:");
  console.log(JSON.stringify(result.data, null, 2));
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});

