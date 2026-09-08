import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const BOOTSTRAP_UID = "njLGR1oBWdMw5SJjmZGzMb4xtcj2";

export const bootstrapAdminClaim = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth || request.auth.uid !== BOOTSTRAP_UID) {
      throw new HttpsError("permission-denied", "Bootstrap denied.");
    }

    // AUTHORITATIVE PROFILE FIRST:
    // Firestore is the single source of truth for dashboard authority. The
    // active admin profile is written before the claim mirror so a failed
    // claim sync can never create an orphan admin claim. The claim is only a
    // mirror/cache — no enforcement layer trusts it by itself.
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

    // CLAIM MIRROR SECOND:
    // Keep the custom claim as a mirror/cache/bootstrap metadata for the
    // initial UID. If this fails, authority remains correct (the profile is
    // authoritative) and the operator can retry reconciliation.
    let claimSynced = true;
    try {
      await getAuth().setCustomUserClaims(BOOTSTRAP_UID, {
        role: "admin",
      });
    } catch {
      claimSynced = false;
    }

    return {
      success: true,
      uid: BOOTSTRAP_UID,
      role: "admin",
      claimSynced,
    };
  }
);
