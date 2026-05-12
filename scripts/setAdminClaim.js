import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadServiceAccount() {
  const filePath = path.resolve(__dirname, "serviceAccountKey.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing serviceAccountKey.json at ${filePath}`
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (
    !parsed.project_id ||
    !parsed.client_email ||
    !parsed.private_key
  ) {
    throw new Error("Invalid serviceAccountKey.json");
  }

  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

function getEmail() {
  const arg = process.argv[2];
  const env = process.env.BOOTSTRAP_ADMIN_EMAIL;

  const email = arg || env;

  if (!email) {
    throw new Error(
      "Provide email: node script.js you@email.com"
    );
  }

  return email.trim().toLowerCase();
}

function initAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

async function getOrCreateUser(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.log("Creating user:", email);

      return await admin.auth().createUser({
        email,
        password: "TempPassword123!",
        displayName: "Admin",
        emailVerified: true,
      });
    }
    throw err;
  }
}

async function run() {
  initAdmin();

  const email = getEmail();
  const db = admin.firestore();

  const user = await getOrCreateUser(email);

  // Set admin claim
  await admin.auth().setCustomUserClaims(user.uid, { role: "admin" });

  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();

  let data = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "Admin",
    role: "admin",
    active: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    data = {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  }

  await ref.set(data, { merge: true });

  console.log("Admin ready:", email);
}

run().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});