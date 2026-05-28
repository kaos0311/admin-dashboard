import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TEMP_PASSWORD = "TempPassword123!";

function readRequiredEnv(name) {
  const value = process.env[name];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "";
}

function loadServiceAccount() {
  const envProjectId = readRequiredEnv("FIREBASE_PROJECT_ID");
  const envClientEmail = readRequiredEnv("FIREBASE_CLIENT_EMAIL");
  const envPrivateKey = readRequiredEnv("FIREBASE_PRIVATE_KEY");

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const possiblePaths = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(__dirname, "serviceAccountKey.json"),
    path.resolve(__dirname, "../serviceAccountKey.json"),
  ];

  const filePath = possiblePaths.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      `Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, or provide serviceAccountKey.json. Checked: ${possiblePaths.join(", ")}`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (
    typeof parsed.project_id !== "string" ||
    typeof parsed.client_email !== "string" ||
    typeof parsed.private_key !== "string"
  ) {
    throw new Error(
      "Invalid serviceAccountKey.json. It must include project_id, client_email, and private_key."
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function getEmail() {
  const email = process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL;

  if (!email || !email.trim()) {
    throw new Error(
      "Provide an email: node scripts/bootstrapAdmin.js admin@email.com"
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error(`Invalid email address: ${normalizedEmail}`);
  }

  return normalizedEmail;
}

function getDisplayName() {
  return (
    process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() ||
    "Admin"
  );
}

function getTempPassword() {
  return (
    process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() ||
    DEFAULT_TEMP_PASSWORD
  );
}

function validatePassword(password) {
  if (password.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
  }
}

function initAdmin() {
  if (admin.apps.length) return;

  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

async function getOrCreateUser(email) {
  try {
    const existingUser = await admin.auth().getUserByEmail(email);

    return {
      user: existingUser,
      created: false,
    };
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }

    const password = getTempPassword();
    validatePassword(password);

    console.log(`Creating Firebase Auth user: ${email}`);

    const createdUser = await admin.auth().createUser({
      email,
      password,
      displayName: getDisplayName(),
      emailVerified: true,
      disabled: false,
    });

    return {
      user: createdUser,
      created: true,
    };
  }
}

async function run() {
  initAdmin();

  const email = getEmail();
  const displayName = getDisplayName();

  const db = admin.firestore();

  const { user, created } = await getOrCreateUser(email);

  await admin.auth().updateUser(user.uid, {
    emailVerified: true,
    disabled: false,
    displayName: user.displayName || displayName,
  });

  await admin.auth().setCustomUserClaims(user.uid, {
    role: "admin",
  });

  const userRef = db.collection("users").doc(user.uid);
  const userSnap = await userRef.get();

  const now = admin.firestore.FieldValue.serverTimestamp();

  await userRef.set(
    {
      uid: user.uid,
      email: user.email || email,
      displayName: user.displayName || displayName,
      role: "admin",
      active: true,
      phone: "",
      theme: "dark",
      notifications: {
        email: true,
        sms: false,
      },
      updatedAt: now,
      ...(userSnap.exists
        ? {}
        : {
            createdAt: now,
          }),
    },
    { merge: true }
  );

  console.log("\nAdmin ready:");
  console.log(`Email: ${email}`);
  console.log(`UID: ${user.uid}`);
  console.log("Role claim: admin");
  console.log("Firestore user doc: active admin");

  if (created) {
    console.log("\nTemporary password:");
    console.log(getTempPassword());
    console.log("\nChange it after first login. Leaving default passwords around is how raccoons get admin access.");
  } else {
    console.log("\nExisting user upgraded to admin.");
  }
}

run().catch((error) => {
  console.error("Failed:", error);
  process.exitCode = 1;
});