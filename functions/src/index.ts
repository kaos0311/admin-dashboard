import { getApps, initializeApp } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp();
}

/* IMPORT STORAGE TRIGGER */
export { importFileFromStorage } from "./imports/importFileFromStorage.js";

/* MAINTENANCE */
export { cleanDatabase } from "./maintenance/cleanDatabase.js";
export { rebuildEverything } from "./maintenance/rebuildEverything.js";
export { rebuildReportsAnalytics } from "./maintenance/rebuildReportsAnalytics.js";
export { reprocessImportJob } from "./maintenance/reprocessImportJob.js";
export { softResetReports } from "./maintenance/softResetReports.js";