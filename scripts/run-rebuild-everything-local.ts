import admin from "firebase-admin";
import fs from "fs";
import path from "path";

function loadServiceAccount() {
  const possiblePaths = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(process.cwd(), "scripts/serviceAccountKey.json"),
    path.resolve(process.cwd(), "functions/serviceAccountKey.json"),
  ];

  const filePath = possiblePaths.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      `Missing service account key. Checked: ${possiblePaths.join(", ")}`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount()),
      storageBucket: "advanced-home-medical-55772.firebasestorage.app",
    });
  }

  const { runRebuildEverything } = await import(
    "../functions/src/maintenance/rebuildEverything"
  );

  const result = await runRebuildEverything({
    clearDerivedData: true,
    requestedByUid: "local-rebuild-script",
    requestedByEmail: "local-rebuild-script@advanced-home-medical.local",
  });

  console.log("Local rebuild result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Local rebuild failed:", error);
  process.exit(1);
});
