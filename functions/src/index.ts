import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

export { createDashboardUser } from "./adminUsers";
export { importFileFromStorage } from "./imports/importFileFromStorage";
export { askAdminAi } from "./ai/askAdminAi";