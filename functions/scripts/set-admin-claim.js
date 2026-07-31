const admin = require("firebase-admin");

admin.initializeApp();

const uid = "njLGR1oBWdMw5SJjmZGzMb4xtcj2";

async function main() {
    const user = await admin.auth().getUser(uid);

    const claims = user.customClaims || {};

    await admin.auth().setCustomUserClaims(uid, {
        ...claims,
        role: "tank",
        admin: true,
    });

    const updated = await admin.auth().getUser(uid);

    console.log("SUCCESS");
    console.log(updated.customClaims);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });