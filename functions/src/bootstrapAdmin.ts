import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const BOOTSTRAP_UID = "njLGR1oBWdMw5SJjmZGzMb4xtcj2";

export const bootstrapAdminClaim = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth || request.auth.uid !== BOOTSTRAP_UID) {
      throw new HttpsError("permission-denied", "Bootstrap denied.");
    }

    await getAuth().setCustomUserClaims(BOOTSTRAP_UID, {
      role: "admin",
    });

    await getFirestore().collection("users").doc(BOOTSTRAP_UID).set(
      {
        uid: BOOTSTRAP_UID,
        role: "admin",
        active: true,
        disabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      success: true,
      uid: BOOTSTRAP_UID,
      role: "admin",
    };
  }
);