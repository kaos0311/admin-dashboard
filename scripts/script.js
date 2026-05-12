import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadServiceAccount() {
  const possiblePaths = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(__dirname, "serviceAccountKey.json"),
  ];

  const filePath = possiblePaths.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      `Missing serviceAccountKey.json. Checked: ${possiblePaths.join(", ")}`
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

  if (!email) {
    throw new Error(
      "Provide an email: node scripts/bootstrapAdmin.js admin@email.com"
    );
  }

  return email.trim().toLowerCase();
}

function getDisplayName() {
  return process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME || "Admin";
}

function getTempPassword() {
  return process.env.BOOTSTRAP_ADMIN_PASSWORD || "TempPassword123!";
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
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }

    console.log(`Creating Firebase Auth user: ${email}`);

    return admin.auth().createUser({
      email,
      password: getTempPassword(),
      displayName: getDisplayName(),
      emailVerified: true,
      disabled: false,
    });
  }
}

async function run() {
  initAdmin();

  const email = getEmail();
  const displayName = getDisplayName();

  const db = admin.firestore();
  const user = await getOrCreateUser(email);

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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(userSnap.exists
        ? {}
        : {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
    },
    { merge: true }
  );

  console.log("\nAdmin ready:");
  console.log(`Email: ${email}`);
  console.log(`UID: ${user.uid}`);
  console.log("Role claim: admin");
  console.log("Firestore user doc: active admin");
  console.log("\nIf this is a new user, temporary password is:");
  console.log(getTempPassword());
}

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});